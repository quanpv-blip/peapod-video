// Cổng kiểm tra sau khi dựng (final review): đo tệp MP4 thật rồi so với kế hoạch dựng.
// Chỉ chạy ở Node (dịch vụ dựng, scripts/render-spec.ts). Dùng ffprobe/ffmpeg đi kèm Remotion, không cần cài thêm.
// Kết luận: pass | pass_with_warnings | revise. "revise" nghĩa là tệp không đạt và không được giao.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { RenderPlan } from './plan.ts';

export type Verdict = 'pass' | 'pass_with_warnings' | 'revise';

export interface ReviewCheck {
  id: string;
  ok: boolean;
  /** critical: làm hỏng video (sai độ dài, sai khung, mất tiếng). warning: nên xem lại. */
  severity: 'critical' | 'warning';
  detail: string;
}

export interface RenderReport {
  file: string;
  verdict: Verdict;
  measured: { seconds: number; width: number; height: number; fps: number; hasAudio: boolean; maxVolumeDb: number | null };
  expected: { seconds: number; width: number; height: number; fps: number; narration: boolean; captions: number };
  checks: ReviewCheck[];
  /** Khung trích ra để người hoặc agent xem (giữa từng cảnh tiêu biểu, ít nhất 4). */
  frames: string[];
}

/** Thư mục chứa ffmpeg/ffprobe của Remotion cho nền tảng đang chạy. */
export function remotionBinDir(): string {
  const req = createRequire(import.meta.url);
  const base = dirname(dirname(req.resolve('@remotion/renderer/package.json')));
  const prefix = `compositor-${process.platform}-${process.arch}`;
  const name = readdirSync(base).find((d) => d.startsWith(prefix));
  if (!name) throw new Error(`Không tìm thấy @remotion/${prefix}* (ffmpeg/ffprobe của Remotion).`);
  return join(base, name);
}

const exe = (dir: string, n: string) => join(dir, process.platform === 'win32' ? `${n}.exe` : n);

/** Độ lệch độ dài cho phép giữa tệp thật và kế hoạch (giây): một vài khung do làm tròn mã hóa âm thanh. */
const DURATION_TOLERANCE = 0.25;
/** Dưới mức này coi như im lặng (dB). ffmpeg báo -91 dB cho âm thanh toàn số 0. */
const SILENT_DB = -60;

/** Mốc (giây) để trích khung: giữa phần hiện rõ của các cảnh, rải đều, ít nhất 4 (hoặc bằng số cảnh nếu ít hơn). */
export function sampleTimes(plan: RenderPlan, count = 4): number[] {
  const mids = plan.scenes.map((p) => (p.from + (p.durationInFrames - p.transitionOutFrames) * 0.75) / plan.fps);
  if (mids.length <= count) return mids;
  return Array.from({ length: count }, (_, i) => mids[Math.round((i * (mids.length - 1)) / (count - 1))]!);
}

export function reviewRender(file: string, plan: RenderPlan, opts: { framesDir?: string; frameCount?: number } = {}): RenderReport {
  const bin = remotionBinDir();
  const probe = JSON.parse(
    execFileSync(exe(bin, 'ffprobe'), ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate:format=duration', '-of', 'json', file], { encoding: 'utf8' }),
  ) as { streams: { codec_type: string; width?: number; height?: number; r_frame_rate?: string }[]; format: { duration?: string } };
  const video = probe.streams.find((s) => s.codec_type === 'video');
  const hasAudio = probe.streams.some((s) => s.codec_type === 'audio');
  const [num, den] = (video?.r_frame_rate ?? '0/1').split('/').map(Number);
  const measured = {
    seconds: Math.round(Number(probe.format.duration ?? 0) * 100) / 100,
    width: video?.width ?? 0,
    height: video?.height ?? 0,
    fps: den ? Math.round((num! / den) * 100) / 100 : 0,
    hasAudio,
    maxVolumeDb: hasAudio ? maxVolume(bin, file) : null,
  };
  const narration = plan.spec.narration.enabled && plan.scenes.some((p) => p.speechTo > 0);
  const expected = {
    seconds: Math.round((plan.totalFrames / plan.fps) * 100) / 100,
    width: plan.width,
    height: plan.height,
    fps: plan.fps,
    narration,
    captions: plan.scenes.reduce((a, p) => a + p.captions.length, 0),
  };

  const checks: ReviewCheck[] = [];
  const add = (id: string, ok: boolean, severity: ReviewCheck['severity'], detail: string) => checks.push({ id, ok, severity, detail });
  add('video-stream', !!video, 'critical', video ? 'Có luồng hình.' : 'Không có luồng hình.');
  add('size', measured.width === expected.width && measured.height === expected.height, 'critical', `${measured.width}×${measured.height}, cần ${expected.width}×${expected.height}.`);
  add('fps', measured.fps === expected.fps, 'critical', `${measured.fps} fps, cần ${expected.fps}.`);
  const drift = Math.abs(measured.seconds - expected.seconds);
  add('duration', drift <= DURATION_TOLERANCE, 'critical', `${measured.seconds}s, kế hoạch ${expected.seconds}s (lệch ${drift.toFixed(2)}s, cho phép ${DURATION_TOLERANCE}s).`);
  add('duration-range', measured.seconds >= plan.spec.qa.minSeconds && measured.seconds <= plan.spec.qa.maxSeconds, 'critical', `Cần trong khoảng ${plan.spec.qa.minSeconds}–${plan.spec.qa.maxSeconds}s.`);
  if (narration) {
    add('audio-stream', hasAudio, 'critical', hasAudio ? 'Có luồng tiếng.' : 'Spec có lời đọc nhưng tệp không có tiếng.');
    // Lời đọc im lặng chỉ là cảnh báo: bản thử dùng WAV im lặng khi chưa có TTS.
    if (hasAudio) add('audio-audible', (measured.maxVolumeDb ?? -99) > SILENT_DB, 'warning', `Âm lượng đỉnh ${measured.maxVolumeDb ?? '?'} dB${(measured.maxVolumeDb ?? -99) <= SILENT_DB ? ': gần như im lặng (giọng đọc thử?)' : ''}.`);
  }
  if (plan.spec.captions.enabled) add('captions', expected.captions > 0, 'warning', `${expected.captions} trang phụ đề trong kế hoạch.`);
  if (plan.estimatedTiming) add('timing-real', false, 'warning', 'Thời lượng dựng theo lời đọc ước lượng, chưa có âm thanh thật.');
  if (plan.spec.captions.enabled && plan.spec.captions.timing === 'estimated') add('captions-aligned', false, 'warning', 'Phụ đề dùng mốc ước lượng, có thể lệch tiếng.');

  const frames: string[] = [];
  if (opts.framesDir) {
    mkdirSync(opts.framesDir, { recursive: true });
    for (const [i, t] of sampleTimes(plan, opts.frameCount ?? 4).entries()) {
      const out = join(opts.framesDir, `review-${String(i + 1).padStart(2, '0')}-${t.toFixed(1)}s.jpg`);
      execFileSync(exe(bin, 'ffmpeg'), ['-v', 'error', '-y', '-ss', t.toFixed(3), '-i', file, '-frames:v', '1', '-q:v', '3', out]);
      if (existsSync(out)) frames.push(out);
    }
    add('frames', frames.length >= Math.min(4, plan.scenes.length), 'warning', `Đã trích ${frames.length} khung để xem.`);
  }

  const critical = checks.some((c) => !c.ok && c.severity === 'critical');
  const warned = checks.some((c) => !c.ok);
  return { file, verdict: critical ? 'revise' : warned ? 'pass_with_warnings' : 'pass', measured, expected, checks, frames };
}

/** Âm lượng đỉnh (dB) của luồng tiếng, qua bộ lọc volumedetect. */
function maxVolume(bin: string, file: string): number | null {
  // ffmpeg của Remotion là bản rút gọn (không có volumedetect, không có muxer s16le):
  // giải mã ra WAV PCM 16-bit mono 8 kHz qua pipe rồi tự tìm đỉnh sau khối "data".
  const res = spawnSync(exe(bin, 'ffmpeg'), ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', '8000', '-c:a', 'pcm_s16le', '-f', 'wav', 'pipe:1'], { maxBuffer: 64 * 1024 * 1024 });
  const buf = res.stdout as Buffer | null;
  if (res.status !== 0 || !buf) return null;
  const data = buf.indexOf('data', 12, 'latin1');
  if (data < 0) return null;
  let peak = 0;
  for (let i = data + 8; i + 1 < buf.length; i += 2) peak = Math.max(peak, Math.abs(buf.readInt16LE(i)));
  return peak === 0 ? -91 : Math.round(20 * Math.log10(peak / 32768) * 10) / 10;
}

export function formatReport(r: RenderReport): string {
  const head = `Kiểm tra sau dựng: ${r.verdict.toUpperCase()} · ${r.measured.seconds}s ${r.measured.width}×${r.measured.height} ${r.measured.fps}fps`;
  return [head, ...r.checks.map((c) => `  ${c.ok ? '✓' : c.severity === 'critical' ? '✕' : '!'} ${c.id}: ${c.detail}`), ...r.frames.map((f) => `  khung: ${f}`)].join('\n');
}
