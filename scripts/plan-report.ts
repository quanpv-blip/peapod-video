// In kế hoạch dựng (thời lượng từng cảnh, nhịp, số trang phụ đề) của một VideoSpec với lời đọc ước lượng.
// Chạy: npx tsx scripts/plan-report.ts samples/spec-vn-freezers.json
import { readFileSync } from 'node:fs';
import { buildPlan, planSeconds } from '../src/engine/plan.ts';
import { stripBeats } from '../src/spec/beats.ts';
import { VideoSpecSchema } from '../src/spec/schema.ts';

const spec = VideoSpecSchema.parse(JSON.parse(readFileSync(process.argv[2]!, 'utf8')));
const plan = buildPlan(spec);
for (const p of plan.scenes) {
  const chars = p.scene.narration ? [...stripBeats(p.scene.narration.text)].length : 0;
  console.log(`${String(p.index).padStart(2)} ${p.scene.kind.padEnd(10)} ${(p.durationInFrames / plan.fps).toFixed(1).padStart(5)}s  lời ${String(chars).padStart(3)} ký tự  nhịp [${p.beats.join(',')}]  phụ đề ${p.captions.length} trang  ${p.headingContinues ? '(giữ tiêu đề)' : ''}`);
}
console.log(`Tổng: ${planSeconds(plan)}s, ${plan.totalFrames} khung${plan.estimatedTiming ? ' (ước lượng)' : ''}`);
