// Dựng một VideoSpec thành MP4 từ dòng lệnh, đúng đường mà dịch vụ dựng sẽ dùng.
// Chạy: npx tsx scripts/render-spec.ts samples/spec-vn-freezers.json --voice=silent --out=out/vn.mp4
//       --voice=silent | files:<thư mục có <sceneId>.wav> | none
// Các bước: kiểm spec → chuẩn bị âm thanh (đo thời lượng thật) → kiểm lại thời lượng bằng số thật → bundle → chép âm thanh
// vào thư mục public của bundle → dựng → in thông số tệp ra.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { buildPlan, planSeconds } from '../src/engine/plan.ts';
import { prepareAudio, type VoiceSource } from '../src/engine/prepare.ts';
import { VideoSpecSchema } from '../src/spec/schema.ts';
import { formatIssues, pacingIssues, validateSpec } from '../src/spec/validate.ts';
import { formatReport, reviewRender } from '../src/engine/review.ts';

const args = Object.fromEntries(process.argv.slice(3).map((a) => a.replace(/^--/, '').split('=') as [string, string]));
const specPath = process.argv[2];
if (!specPath) throw new Error('Thiếu đường dẫn VideoSpec');
const out = resolve(args.out ?? 'out/spec.mp4');
const voiceArg = args.voice ?? 'silent';

const raw = JSON.parse(readFileSync(specPath, 'utf8'));
const v = validateSpec(raw);
console.log(formatIssues(v.issues));
if (!v.ok) process.exit(1);
const spec = VideoSpecSchema.parse(raw);

const job = randomUUID();
const work = join(tmpdir(), `peapod-spec-${job}`);
const source: VoiceSource | null = voiceArg === 'none' ? null : voiceArg === 'silent' ? { kind: 'silent' } : voiceArg.startsWith('files:') ? { kind: 'files', dir: voiceArg.slice(6) } : null;
if (voiceArg !== 'none' && !source) throw new Error(`--voice không hợp lệ: ${voiceArg}`);
const prepared = source ? prepareAudio(spec, source, join(work, 'audio'), job) : { audio: {}, missing: [], speechSeconds: 0 };
if (prepared.missing.length) console.log(`! Thiếu lời đọc cho: ${prepared.missing.join(', ')} (dùng thời lượng ước lượng, không có tiếng)`);

// Kiểm lại thời lượng bằng âm thanh thật (validateSpec chỉ ước lượng).
const plan = buildPlan(spec, prepared.audio);
const secs = planSeconds(plan);
console.log(`Thời lượng theo âm thanh: ${secs}s (${plan.scenes.length} cảnh)`);
if (secs > spec.qa.maxSeconds || secs < spec.qa.minSeconds) {
  console.log(`✕ Thời lượng ${secs}s ngoài khoảng ${spec.qa.minSeconds}–${spec.qa.maxSeconds}s. Sửa lời đọc rồi dựng lại.`);
  process.exit(1);
}

const t0 = Date.now();
const serveUrl = await bundle({ entryPoint: resolve('src/index.ts'), publicDir: resolve('public') });
console.log(`Bundle ${((Date.now() - t0) / 1000).toFixed(1)}s`);
// Âm thanh theo job: chép vào public của bundle, staticFile('<job>/<cảnh>.wav') đọc được ngay (không cần bundle lại).
if (Object.keys(prepared.audio).length) cpSync(join(work, 'audio'), join(serveUrl, 'public', job), { recursive: true });

const inputProps = { spec: raw, audio: prepared.audio };
const composition = await selectComposition({ serveUrl, id: 'SpecVideo', inputProps });
mkdirSync(dirname(out), { recursive: true });
const t1 = Date.now();
let last = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  outputLocation: out,
  inputProps,
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 10);
    if (pct !== last) {
      last = pct;
      process.stdout.write(`${pct * 10}% `);
    }
  },
});
console.log(`\nDựng ${((Date.now() - t1) / 1000).toFixed(1)}s → ${out}`);
rmSync(work, { recursive: true, force: true });

// Nhịp hình với thời lượng thật, rồi cổng kiểm tra sau dựng; báo cáo ghi cạnh tệp MP4.
const pacing = pacingIssues(plan);
if (pacing.length) console.log(formatIssues(pacing));
const report = reviewRender(out, plan, { framesDir: out.replace(/\.mp4$/i, '') + '-review' });
writeFileSync(out.replace(/\.mp4$/i, '') + '.report.json', JSON.stringify({ ...report, pacing }, null, 2));
console.log(formatReport(report));
if (report.verdict === 'revise') process.exit(2);
