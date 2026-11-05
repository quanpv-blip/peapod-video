// Dịch vụ render thẻ PeaPod qua HTTP. Chạy nền trên máy, PeaPod (worker) gọi khi cần thẻ.
// Khởi động: đóng gói project một lần và mở một trình duyệt dùng chung. Mỗi yêu cầu chỉ render một khung hình.
// Dùng: RENDER_TOKEN=<≥32 ký tự> npx tsx src/render-service.ts
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderMedia, renderStill, selectComposition, type HeadlessBrowser } from '@remotion/renderer';
import { cardSchema } from './schema.ts';

const HOST = process.env.RENDER_HOST ?? '0.0.0.0';
const PORT = Number(process.env.RENDER_PORT ?? 4100);
const TOKEN = process.env.RENDER_TOKEN ?? '';
const MAX_CONCURRENT = Math.max(1, Number(process.env.RENDER_CONCURRENCY ?? 2));
const MAX_BODY_BYTES = 64 * 1024;
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

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((ok, fail) => {
    let size = 0;
    let text = '';
    req.setEncoding('utf8');
    req.on('data', (c: string) => {
      size += Buffer.byteLength(c);
      if (size > MAX_BODY_BYTES) {
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

// Video 9:16 (H.264 MP4). Ghi ra file tạm rồi đọc lại, vì renderMedia không trả về buffer.
async function renderReel(input: unknown): Promise<Buffer> {
  const props = cardSchema.parse(input);
  await acquire();
  const out = join(tmpdir(), `peapod-reel-${randomUUID()}.mp4`);
  try {
    const composition = await selectComposition({ serveUrl: serveUrl!, id: REEL_COMPOSITION, inputProps: props, puppeteerInstance: browser! });
    await renderMedia({
      composition,
      serveUrl: serveUrl!,
      codec: 'h264',
      outputLocation: out,
      inputProps: props,
      puppeteerInstance: browser!,
    });
    return await readFile(out);
  } finally {
    await rm(out, { force: true });
    release();
  }
}

const server = createServer(async (req, res) => {
  const url = req.url ?? '/';
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
  if (req.method === 'POST' && url === '/render/reel') {
    if (!tokenOk(req.headers['x-render-token'] as string | undefined)) return json(res, 401, { error: 'unauthorized' });
    if (!serveUrl || !browser) return json(res, 503, { error: 'starting' });
    let input: unknown;
    try {
      input = JSON.parse(await readBody(req));
    } catch (e) {
      const tooLarge = (e as Error).message === 'body_too_large';
      return json(res, tooLarge ? 413 : 400, { error: tooLarge ? 'body_too_large' : 'invalid_json' });
    }
    const check = cardSchema.safeParse(input);
    if (!check.success) return json(res, 400, { error: 'invalid_input', fields: check.error.issues.map((i) => i.path.join('.')) });
    const started = Date.now();
    try {
      const mp4 = await renderReel(check.data);
      log('info', 'render reel', { ms: Date.now() - started, market: check.data.market, bytes: mp4.length });
      res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': mp4.length });
      return res.end(mp4);
    } catch (e) {
      log('error', 'render reel failed', { ms: Date.now() - started, error: (e as Error).message.slice(0, 300) });
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
