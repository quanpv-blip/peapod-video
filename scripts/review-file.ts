// Chạy lại cổng kiểm tra sau dựng cho một tệp MP4 đã có (kế hoạch dựng theo lời đọc ước lượng).
// Chạy: npx tsx scripts/review-file.ts <spec.json> <video.mp4> [--frames=<thư mục>]
import { readFileSync } from 'node:fs';
import { buildPlan } from '../src/engine/plan.ts';
import { formatReport, reviewRender } from '../src/engine/review.ts';
import { VideoSpecSchema } from '../src/spec/schema.ts';

const [specPath, file, ...rest] = process.argv.slice(2);
if (!specPath || !file) throw new Error('Cần <spec.json> <video.mp4>');
const framesDir = rest.find((a) => a.startsWith('--frames='))?.slice(9);
const plan = buildPlan(VideoSpecSchema.parse(JSON.parse(readFileSync(specPath, 'utf8'))));
const report = reviewRender(file, plan, { framesDir });
console.log(formatReport(report));
process.exit(report.verdict === 'revise' ? 2 : 0);
