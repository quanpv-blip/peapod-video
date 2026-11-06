// In danh sách khung "ổn định" của từng cảnh (sau khi phần tử cuối đã hiện, trước khi chuyển cảnh) để dựng ảnh kiểm tra.
// Chạy: npx tsx scripts/still-frames.ts samples/spec-vn-freezers.json  →  in ra "120,260,..." cho --frames
import { readFileSync } from 'node:fs';
import { buildPlan } from '../src/engine/plan.ts';
import { VideoSpecSchema } from '../src/spec/schema.ts';

const plan = buildPlan(VideoSpecSchema.parse(JSON.parse(readFileSync(process.argv[2]!, 'utf8'))));
const frames = plan.scenes.map((p) => {
  const last = p.beats.length ? Math.max(...p.beats) : 0;
  // Cảnh không có nhịp (hook, stat, quote...): lấy giữa phần lời đọc, lúc mọi hiệu ứng vào đã xong.
  const settled = p.beats.length ? last + 26 : Math.max(60, Math.round((p.speechFrom + p.speechTo) / 2));
  return p.from + Math.min(settled, p.durationInFrames - p.transitionOutFrames - 3);
});
console.log(frames.join(','));
