// Dịch vụ render thẻ PeaPod qua HTTP. Chạy nền trên máy, PeaPod (worker) gọi khi cần thẻ.
// Khởi động: đóng gói project một lần và mở một trình duyệt dùng chung. Mỗi yêu cầu chỉ render một khung hình.
// Dùng: RENDER_TOKEN=<≥32 ký tự> npx tsx src/render-service.ts
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { bundle } from '@remotion/bundler';
import { makeCancelSignal, openBrowser, renderMedia, renderStill, selectComposition, type HeadlessBrowser } from '@remotion/renderer';
import { cardSchema, reelRequestSchema, type ReelProps } from './schema.ts';
import { buildPlan, planSeconds, type RenderPlan, type SceneAudio } from './engine/plan.ts';
import { reviewRender, type RenderReport, type Verdict } from './engine/review.ts';
import { prepareAudio, sceneWords, type PreparedAudio, type VoiceSource } from './engine/prepare.ts';
import { splitNarration } from './engine/split.ts';
import { stripBeats } from './spec/beats.ts';
import { compileStoryboard, storyboardIssues, storyIndexMap, storyNarration, StoryboardSchema, storyPath, toStoryIssue, zodMessage, type Storyboard } from './spec/storyboard.ts';
import { validateSpec } from './spec/validate.ts';
import { z } from 'zod';

const HOST = process.env.RENDER_HOST ?? '0.0.0.0';
const PORT = Number(process.env.RENDER_PORT ?? 4100);
const TOKEN = process.env.RENDER_TOKEN ?? '';
const MAX_CONCURRENT = Math.max(1, Number(process.env.RENDER_CONCURRENCY ?? 2));
const MAX_BODY_BYTES = 64 * 1024;
// Job video nhận thêm WAV lời đọc (base64) nên cho phép body lớn hơn.
const MAX_JOB_BODY_BYTES = 9 * 1024 * 1024;
// Job VideoSpec: tối đa ~18 cảnh × WAV 24 kHz (~190 KB/4 giây) dạng base64.
const MAX_SPEC_BODY_BYTES = 24 * 1024 * 1024;
const SPEC_COMPOSITION = 'SpecVideo';
const MAX_QUEUED_JOBS = Number(process.env.RENDER_MAX_QUEUE ?? 20);
const AUDIO_DIR = join(tmpdir(), 'peapod-audio');
// Địa chỉ Chromium (chạy cùng máy) dùng để tải âm thanh tạm.
const PUBLIC_BASE = process.env.RENDER_INTERNAL_URL ?? `http://127.0.0.1:${process.env.RENDER_PORT ?? 4100}`;
const COMPOSITION = 'PeaPodCard';
const REEL_COMPOSITION = 'PeaPodReel';

if (TOKEN.length < 32) {
  console.error('RENDER_TOKEN phải có ít nhất 32 ký tự.');
  process.exit(1);
}

let serveUrl: string | null = null;
let browser: HeadlessBrowser | null = null;

// Giới hạn số lần render cùng lúc để không làm đầy RAM. Yêu cầu thừa được xếp hàng.
let active = 0;
const queue: (() => void)[] = [];
async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active++;
    return;
  }
  await new Promise<void>((done) => queue.push(done));
  active++;
}
function release(): void {
  active--;
  queue.shift()?.();
}

function log(level: 'info' | 'error', msg: string, extra: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ level, msg, ...extra }));
}

function json(res: ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function tokenOk(header: string | undefined): boolean {
  if (!header) return false;
  const a = new Uint8Array(Buffer.from(header));
  const b = new Uint8Array(Buffer.from(TOKEN));
  return a.length === b.length && timingSafeEqual(a, b);
}

function readBody(req: IncomingMessage, maxBytes = MAX_BODY_BYTES): Promise<string> {
  return new Promise((ok, fail) => {
    let size = 0;
    let text = '';
    req.setEncoding('utf8');
    req.on('data', (c: string) => {
      size += Buffer.byteLength(c);
      if (size > maxBytes) {
        req.destroy();
        fail(new Error('body_too_large'));
        return;
      }
      text += c;
    });
    req.on('end', () => ok(text));
    req.on('error', fail);
  });
}

async function renderCard(input: unknown): Promise<Buffer> {
  const props = cardSchema.parse(input);
  await acquire();
  try {
    const composition = await selectComposition({ serveUrl: serveUrl!, id: COMPOSITION, inputProps: props, puppeteerInstance: browser! });
    // Chụp khung cuối, lúc mọi khối đã hiện xong (khung 0 còn trong trạng thái ẩn).
    const { buffer } = await renderStill({
      composition,
      serveUrl: serveUrl!,
      inputProps: props,
      imageFormat: 'png',
      frame: composition.durationInFrames - 1,
      puppeteerInstance: browser!,
      output: null,
    });
    if (!buffer) throw new Error('render_empty');
    return buffer;
  } finally {
    release();
  }
}

// --- Job video (bất đồng bộ, có tiến độ, hủy được) ---
// PeaPod tạo job, hỏi trạng thái định kỳ, tải MP4 khi xong, hoặc hủy. Trạng thái nằm trong bộ nhớ;
// job xong giữ file 30 phút rồi xóa. Máy chủ khởi động lại thì job mất (PeaPod sẽ báo lỗi và cho dựng lại).
type JobState = 'queued' | 'rendering' | 'finalizing' | 'done' | 'error' | 'cancelled';
interface Job {
  id: string;
  audioFile: string | null;
  /** Thư mục tạm chứa WAV lời đọc theo cảnh (đường VideoSpec); xóa khi job xong. */
  audioDir?: string | null;
  /** Thư mục audio đã chép vào bundle (serveUrl/public/<jobId>); xóa khi job xong. */
  bundleAudioDir?: string | null;
  state: JobState;
  progress: number;
  frames: number;
  totalFrames: number;
  etaSeconds: number | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  file: string | null;
  error: string | null;
  cancel: (() => void) | null;
  /** Kết quả cổng kiểm tra sau dựng (chỉ đường VideoSpec). */
  review?: { verdict: Verdict; measured: RenderReport['measured']; failed: { id: string; severity: string; detail: string }[] };
}
const StoryOptionsSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/),
    market: z.enum(['VN', 'JP']),
    source: z.object({ outlet: z.string().min(1).max(60), title: z.string().min(1).max(160), url: z.url().max(500), publishedAt: z.iso.date().optional() }).strict(),
    incident: z.boolean().optional(),
    minSeconds: z.number().min(5).max(120).optional(),
    maxSeconds: z.number().min(10).max(180).optional(),
  })
  .strict();

/** storyboard + options → VideoSpec (dạng đầu vào) và lời đọc từng cảnh. Lỗi cấu trúc trả về để bên gọi (đạo diễn AI) sửa. */
function compileRequest(body: { storyboard?: unknown; options?: unknown }): { spec: unknown; narration: string[]; sb: Storyboard; map: number[]; storyIssues: ReturnType<typeof storyboardIssues> } | { error: string; issues: { path: string; message: string }[] } {
  const sb = StoryboardSchema.safeParse(body.storyboard);
  const op = StoryOptionsSchema.safeParse(body.options);
  if (!sb.success || !op.success) {
    const issues = [
      ...(sb.success ? [] : sb.error.issues.map((i) => ({ path: storyPath(i.path), message: zodMessage(i, body.storyboard) }))),
      ...(op.success ? [] : op.error.issues.map((i) => ({ path: 'options.' + i.path.join('.'), message: zodMessage(i, body.options) }))),
    ];
    return { error: 'invalid_storyboard', issues: issues.slice(0, 30) };
  }
  const lang = op.data.market === 'JP' ? 'ja' : 'vi';
  return { spec: compileStoryboard(sb.data, op.data), narration: storyNarration(sb.data, lang).filter(Boolean), sb: sb.data, map: storyIndexMap(sb.data), storyIssues: storyboardIssues(sb.data) };
}

/** Tệp dựng xong nhưng không qua cổng kiểm tra sau dựng. */
class ReviewFailed extends Error {}
const jobs = new Map<string, Job>();
const JOB_KEEP_MS = 30 * 60_000;
const JOB_MAX_AGE_MS = 2 * 3600_000;

// Hàm riêng để TypeScript không thu hẹp kiểu trạng thái sau các phép gán.
const isCancelled = (job: Job): boolean => job.state === 'cancelled';

function etaOf(job: Job): number | null {
  if (!job.startedAt || job.progress < 0.02) return null;
  const elapsed = (Date.now() - job.startedAt) / 1000;
  return Math.max(0, Math.round((elapsed / job.progress) * (1 - job.progress)));
}

async function runReelJob(job: Job, props: ReelProps): Promise<void> {
  await acquire();
  try {
    if (isCancelled(job)) return;
    const { cancelSignal, cancel } = makeCancelSignal();
    job.cancel = cancel;
    job.state = 'rendering';
    job.startedAt = Date.now();
    const out = join(tmpdir(), `peapod-reel-${job.id}.mp4`);
    try {
      const composition = await selectComposition({ serveUrl: serveUrl!, id: REEL_COMPOSITION, inputProps: props, puppeteerInstance: browser! });
      job.totalFrames = composition.durationInFrames;
      await renderMedia({
        composition,
        serveUrl: serveUrl!,
        codec: 'h264',
        outputLocation: out,
        inputProps: props,
        puppeteerInstance: browser!,
        overwrite: true,
        cancelSignal,
        onProgress: (p) => {
          job.progress = Math.min(0.99, p.progress);
          job.frames = p.renderedFrames;
          job.etaSeconds = etaOf(job);
        },
      });
      job.file = out;
      job.progress = 1;
      job.etaSeconds = 0;
      job.state = 'done';
      log('info', 'render reel job', { id: job.id, ms: Date.now() - job.startedAt! });
    } catch (e) {
      await rm(out, { force: true });
      // Hủy do người dùng: DELETE đã đặt trạng thái trước khi dừng render.
      if (isCancelled(job)) {
        job.state = 'cancelled';
      } else {
        job.state = 'error';
        job.error = 'render_failed';
        log('error', 'render reel job failed', { id: job.id, error: (e as Error).message.slice(0, 300) });
      }
    } finally {
      job.cancel = null;
      job.finishedAt = Date.now();
      if (job.audioFile) void rm(job.audioFile, { force: true });
    }
  } finally {
    release();
  }
}

// --- Job VideoSpec: dựng video nhiều cảnh từ một VideoSpec đã kiểm tra, kèm lời đọc theo cảnh ---
async function runSpecJob(job: Job, spec: unknown, audio: Record<string, SceneAudio>, plan: RenderPlan): Promise<void> {
  await acquire();
  try {
    if (isCancelled(job)) return;
    const { cancelSignal, cancel } = makeCancelSignal();
    job.cancel = cancel;
    job.state = 'rendering';
    job.startedAt = Date.now();
    const out = join(tmpdir(), `peapod-spec-${job.id}.mp4`);
    try {
      // Âm thanh theo job: chép vào thư mục public của bundle, staticFile('<job>/<cảnh>.wav') đọc được ngay (không bundle lại).
      if (job.audioDir && Object.keys(audio).length) {
        job.bundleAudioDir = join(serveUrl!, 'public', job.id);
        await cp(job.audioDir, job.bundleAudioDir, { recursive: true });
      }
      const inputProps = { spec, audio };
      const composition = await selectComposition({ serveUrl: serveUrl!, id: SPEC_COMPOSITION, inputProps, puppeteerInstance: browser! });
      job.totalFrames = composition.durationInFrames;
      await renderMedia({
        composition,
        serveUrl: serveUrl!,
        codec: 'h264',
        outputLocation: out,
        inputProps,
        puppeteerInstance: browser!,
        overwrite: true,
        cancelSignal,
        onProgress: (p) => {
          job.progress = Math.min(0.99, p.progress);
          job.frames = p.renderedFrames;
          job.etaSeconds = etaOf(job);
        },
      });
      // Cổng kiểm tra sau dựng: tệp sai độ dài/khung/mất tiếng thì không giao (state=error, review_failed).
      const report = reviewRender(out, plan);
      job.review = { verdict: report.verdict, measured: report.measured, failed: report.checks.filter((c) => !c.ok).map(({ id, severity, detail }) => ({ id, severity, detail })) };
      if (report.verdict === 'revise') throw new ReviewFailed();
      job.file = out;
      job.progress = 1;
      job.etaSeconds = 0;
      job.state = 'done';
      log('info', 'render spec job', { id: job.id, ms: Date.now() - job.startedAt!, frames: job.totalFrames, verdict: report.verdict });
    } catch (e) {
      await rm(out, { force: true });
      if (isCancelled(job)) {
        job.state = 'cancelled';
      } else if (e instanceof ReviewFailed) {
        job.state = 'error';
        job.error = 'review_failed';
        log('error', 'render spec job failed review', { id: job.id, failed: job.review?.failed.map((f) => f.id) });
      } else {
        job.state = 'error';
        job.error = 'render_failed';
        log('error', 'render spec job failed', { id: job.id, error: (e as Error).message.slice(0, 300) });
      }
    } finally {
      job.cancel = null;
      job.finishedAt = Date.now();
      if (job.audioDir) void rm(job.audioDir, { recursive: true, force: true });
      if (job.bundleAudioDir) void rm(job.bundleAudioDir, { recursive: true, force: true });
    }
  } finally {
    release();
  }
}

function jobView(job: Job) {
  return {
    id: job.id,
    state: job.state,
    progress: Math.round(job.progress * 1000) / 1000,
    frames: job.frames,
    totalFrames: job.totalFrames,
    etaSeconds: job.etaSeconds,
    error: job.error,
    elapsedMs: job.startedAt ? (job.finishedAt ?? Date.now()) - job.startedAt : 0,
    ...(job.review ? { review: job.review } : {}),
  };
}

// Dọn job cũ: xóa file và bản ghi sau khi giữ đủ thời gian để PeaPod tải.
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    const stale = (job.finishedAt && now - job.finishedAt > JOB_KEEP_MS) || now - job.createdAt > JOB_MAX_AGE_MS;
    if (!stale) continue;
    if (job.file) void rm(job.file, { force: true });
    if (job.audioFile) void rm(job.audioFile, { force: true });
    if (job.audioDir) void rm(job.audioDir, { recursive: true, force: true });
    if (job.bundleAudioDir) void rm(job.bundleAudioDir, { recursive: true, force: true });
    jobs.delete(id);
  }
}, 60_000).unref();

const JOB_ID = /^[0-9a-f-]{36}$/;

const server = createServer(async (req, res) => {
  const url = req.url ?? '/';
  const jobMatch = /^\/jobs\/([0-9a-f-]{36})(\/video)?$/.exec(url);
  if (jobMatch) {
    if (!tokenOk(req.headers['x-render-token'] as string | undefined)) return json(res, 401, { error: 'unauthorized' });
    const id = jobMatch[1]!;
    if (!JOB_ID.test(id)) return json(res, 404, { error: 'not_found' });
    const job = jobs.get(id);
    if (!job) return json(res, 404, { error: 'not_found' });
    if (req.method === 'GET' && jobMatch[2]) {
      if (job.state !== 'done' || !job.file) return json(res, 409, { error: 'not_ready', state: job.state });
      const mp4 = await readFile(job.file);
      res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': mp4.length });
      return res.end(mp4);
    }
    if (req.method === 'GET' && !jobMatch[2]) return json(res, 200, jobView(job));
    if (req.method === 'DELETE' && !jobMatch[2]) {
      if (job.state === 'queued' || job.state === 'rendering') {
        job.state = 'cancelled';
        job.cancel?.();
      } else if (job.state === 'finalizing') {
        return json(res, 409, { error: 'finalizing' });
      }
      return json(res, 200, jobView(job));
    }
    return json(res, 405, { error: 'method_not_allowed' });
  }
  // Kiểm tra một storyboard (AI viết) mà không dựng: chuyển → VideoSpec → validateSpec. Trả lời đọc từng cảnh để bên gọi
  // đọc TTS một lần cho cả video (đúng văn bản engine sẽ căn). Body: { storyboard, options }.
  if (req.method === 'POST' && url === '/storyboard/check') {
    if (!tokenOk(req.headers['x-render-token'] as string | undefined)) return json(res, 401, { error: 'unauthorized' });
    let body: { storyboard?: unknown; options?: unknown };
    try {
      body = JSON.parse(await readBody(req, MAX_JOB_BODY_BYTES)) as typeof body;
    } catch {
      return json(res, 400, { error: 'invalid_json' });
    }
    const c = compileRequest(body);
    if ('error' in c) return json(res, 400, c);
    const v = validateSpec(c.spec);
    // Lỗi cấu trúc theo loại cảnh trước (rõ nhất cho AI), rồi lỗi của VideoSpec đã dịch về đường dẫn storyboard.
    // Chỗ nào đã có lỗi cấu trúc rõ ràng thì bỏ lỗi VideoSpec trùng chỗ đó (cùng một nguyên nhân, AI chỉ cần đọc một lần).
    const storyErrPaths = new Set(c.storyIssues.filter((i) => i.level === 'error').map((i) => i.path));
    const specIssues = v.issues.map((i) => toStoryIssue(i, c.map, c.sb)).filter((i) => !(i.level === 'error' && storyErrPaths.has(i.path)));
    const issues = [...c.storyIssues, ...specIssues].slice(0, 40).map((i) => ({ level: i.level, code: i.code, path: i.path, message: i.message.slice(0, 300) }));
    const ok = v.ok && !c.storyIssues.some((i) => i.level === 'error');
    return json(res, 200, { ok, seconds: v.estimatedSeconds, issues, narration: c.narration });
  }
  // Dựng từ VideoSpec hoặc storyboard. Body: { spec | storyboard+options, audio?: { <sceneId>: <WAV base64> }, audioWhole?: <WAV base64>, voice?: 'silent' }.
  // audioWhole: MỘT tệp lời đọc cả video (đọc nối các cảnh theo thứ tự); engine tự cắt theo khoảng lặng.
  // Kiểm tra TRƯỚC khi xếp hàng (lỗi trả ngay, không tốn lượt dựng): spec hợp lệ → âm thanh hợp lệ → thời lượng THẬT trong giới hạn.
  if (req.method === 'POST' && url === '/jobs/spec') {
    if (!tokenOk(req.headers['x-render-token'] as string | undefined)) return json(res, 401, { error: 'unauthorized' });
    if (!serveUrl || !browser) return json(res, 503, { error: 'starting' });
    if ([...jobs.values()].filter((j) => j.state === 'queued' || j.state === 'rendering').length >= MAX_QUEUED_JOBS) return json(res, 429, { error: 'queue_full' });
    let body: { spec?: unknown; storyboard?: unknown; options?: unknown; audio?: unknown; audioWhole?: unknown; voice?: unknown };
    try {
      body = JSON.parse(await readBody(req, MAX_SPEC_BODY_BYTES)) as typeof body;
    } catch (e) {
      const tooLarge = (e as Error).message === 'body_too_large';
      return json(res, tooLarge ? 413 : 400, { error: tooLarge ? 'body_too_large' : 'invalid_json' });
    }
    if (body.storyboard !== undefined) {
      const c = compileRequest(body);
      if ('error' in c) return json(res, 400, c);
      const bad = c.storyIssues.filter((i) => i.level === 'error');
      if (bad.length) return json(res, 400, { error: 'invalid_storyboard', issues: bad.slice(0, 30) });
      body.spec = c.spec;
    }
    const v = validateSpec(body.spec);
    const issues = v.issues.map((i) => ({ level: i.level, code: i.code, path: i.path, message: i.message.slice(0, 300) }));
    if (!v.ok || !v.spec) return json(res, 400, { error: 'invalid_spec', issues: issues.slice(0, 30) });
    const spec = v.spec;
    const id = randomUUID();
    const audioDir = join(tmpdir(), `peapod-specaudio-${id}`);
    let prepared: PreparedAudio;
    try {
      const wavs: Record<string, Uint8Array> = {};
      let weakCuts: string[] = [];
      if (typeof body.audioWhole === 'string') {
        const scenes = spec.scenes.filter((s) => s.narration && stripBeats(s.narration.text)).map((s) => ({ id: s.id, words: sceneWords(s.narration!.text, spec.language) }));
        const r = splitNarration(new Uint8Array(Buffer.from(body.audioWhole, 'base64')), scenes);
        Object.assign(wavs, r.wavs);
        weakCuts = r.weakCuts;
        if (weakCuts.length) log('info', 'spec job: ranh giới cảnh không rơi vào khoảng lặng rõ', { scenes: weakCuts });
      }
      if (body.audio && typeof body.audio === 'object') {
        for (const [sid, b64] of Object.entries(body.audio as Record<string, unknown>)) {
          if (typeof b64 !== 'string' || !spec.scenes.some((s) => s.id === sid)) throw new Error(`audio.${sid} không hợp lệ`);
          wavs[sid] = new Uint8Array(Buffer.from(b64, 'base64'));
        }
      }
      const source: VoiceSource = body.voice === 'silent' ? { kind: 'silent' } : { kind: 'wavs', wavs };
      prepared = prepareAudio(spec, source, audioDir, id);
    } catch (e) {
      await rm(audioDir, { recursive: true, force: true });
      return json(res, 400, { error: 'invalid_audio', message: (e as Error).message.slice(0, 200) });
    }
    const plan = buildPlan(spec, prepared.audio);
    const seconds = planSeconds(plan);
    if (seconds > spec.qa.maxSeconds || seconds < spec.qa.minSeconds) {
      await rm(audioDir, { recursive: true, force: true });
      return json(res, 422, { error: 'duration_out_of_range', seconds, min: spec.qa.minSeconds, max: spec.qa.maxSeconds });
    }
    const job: Job = {
      id, audioFile: null, audioDir, bundleAudioDir: null, state: 'queued', progress: 0, frames: 0, totalFrames: plan.totalFrames, etaSeconds: null,
      createdAt: Date.now(), startedAt: null, finishedAt: null, file: null, error: null, cancel: null,
    };
    jobs.set(job.id, job);
    void runSpecJob(job, body.spec, prepared.audio, plan);
    return json(res, 202, { ...jobView(job), seconds, missingVoice: prepared.missing, estimatedTiming: plan.estimatedTiming, warnings: issues.filter((i) => i.level === 'warn').slice(0, 10) });
  }
  if (req.method === 'POST' && url === '/jobs/reel') {
    if (!tokenOk(req.headers['x-render-token'] as string | undefined)) return json(res, 401, { error: 'unauthorized' });
    if (!serveUrl || !browser) return json(res, 503, { error: 'starting' });
    if ([...jobs.values()].filter((j) => j.state === 'queued' || j.state === 'rendering').length >= MAX_QUEUED_JOBS) return json(res, 429, { error: 'queue_full' });
    let input: unknown;
    try {
      input = JSON.parse(await readBody(req, MAX_JOB_BODY_BYTES));
    } catch (e) {
      const tooLarge = (e as Error).message === 'body_too_large';
      return json(res, tooLarge ? 413 : 400, { error: tooLarge ? 'body_too_large' : 'invalid_json' });
    }
    const check = reelRequestSchema.safeParse(input);
    if (!check.success) return json(res, 400, { error: 'invalid_input', fields: check.error.issues.map((i) => i.path.join('.')) });
    const { audioBase64, ...rest } = check.data;
    const id = randomUUID();
    let audioFile: string | null = null;
    let audioUrl: string | null = null;
    if (audioBase64) {
      const wav = Buffer.from(audioBase64, 'base64');
      if (wav.length < 1000 || wav.subarray(0, 4).toString('latin1') !== 'RIFF') return json(res, 400, { error: 'invalid_input', fields: ['audioBase64'] });
      await mkdir(AUDIO_DIR, { recursive: true });
      audioFile = join(AUDIO_DIR, `${id}.wav`);
      await writeFile(audioFile, new Uint8Array(wav));
      audioUrl = `${PUBLIC_BASE}/audio/${id}.wav`;
    }
    const props: ReelProps = { ...rest, audioUrl, musicUrl: null };
    const job: Job = {
      id, audioFile, state: 'queued', progress: 0, frames: 0, totalFrames: 0, etaSeconds: null,
      createdAt: Date.now(), startedAt: null, finishedAt: null, file: null, error: null, cancel: null,
    };
    jobs.set(job.id, job);
    void runReelJob(job, props);
    return json(res, 202, jobView(job));
  }
  // Tệp âm thanh tạm cho Chromium tải khi dựng. Tên là UUID ngẫu nhiên, chỉ nhận yêu cầu từ chính máy render, xóa khi job xong.
  const audioMatch = /^\/audio\/([0-9a-f-]{36})\.wav$/.exec(url);
  if (req.method === 'GET' && audioMatch) {
    const remote = req.socket.remoteAddress ?? '';
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) return json(res, 403, { error: 'forbidden' });
    try {
      const wav = await readFile(join(AUDIO_DIR, `${audioMatch[1]}.wav`));
      res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': wav.length });
      return res.end(wav);
    } catch {
      return json(res, 404, { error: 'not_found' });
    }
  }
  if (req.method === 'GET' && url === '/health') {
    return json(res, 200, { ok: true, ready: serveUrl !== null && browser !== null, active, queued: queue.length });
  }
  if (req.method === 'POST' && url === '/render/card') {
    if (!tokenOk(req.headers['x-render-token'] as string | undefined)) return json(res, 401, { error: 'unauthorized' });
    if (!serveUrl || !browser) return json(res, 503, { error: 'starting' });
    let raw: string;
    try {
      raw = await readBody(req);
    } catch {
      return json(res, 413, { error: 'body_too_large' });
    }
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      return json(res, 400, { error: 'invalid_json' });
    }
    const check = cardSchema.safeParse(input);
    if (!check.success) {
      // Chỉ trả tên trường lỗi, không trả lại nội dung đã gửi.
      return json(res, 400, { error: 'invalid_input', fields: check.error.issues.map((i) => i.path.join('.')) });
    }
    const started = Date.now();
    try {
      const png = await renderCard(check.data);
      log('info', 'render card', { ms: Date.now() - started, market: check.data.market, bytes: png.length });
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length });
      return res.end(png);
    } catch (e) {
      log('error', 'render card failed', { ms: Date.now() - started, error: (e as Error).message.slice(0, 300) });
      return json(res, 500, { error: 'render_failed' });
    }
  }
  return json(res, 404, { error: 'not_found' });
});

async function start(): Promise<void> {
  const t0 = Date.now();
  serveUrl = await bundle({ entryPoint: resolve('src/index.ts'), publicDir: resolve('public') });
  log('info', 'bundle ready', { ms: Date.now() - t0 });
  browser = await openBrowser('chrome');
  log('info', 'browser ready', { ms: Date.now() - t0 });
  server.listen(PORT, HOST, () => log('info', 'render service listening', { host: HOST, port: PORT, concurrency: MAX_CONCURRENT }));
}

async function shutdown(): Promise<void> {
  log('info', 'shutting down');
  server.close();
  await browser?.close({ silent: true }).catch(() => undefined);
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

start().catch((e: Error) => {
  log('error', 'startup failed', { error: e.message.slice(0, 300) });
  process.exit(1);
});
