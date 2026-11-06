// Xuất bảng kê đầu vào và JSON Schema của VideoSpec và Storyboard. Chạy: npm run manifest
// schemas/storyboard.schema.json cũng được chép sang ../peapod-ai/schemas/ (đạo diễn AI dùng làm lược đồ trả lời của Gemini).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { MANIFEST } from '../src/spec/manifest.ts';
import { VideoSpecSchema } from '../src/spec/schema.ts';
import { StoryboardSchema } from '../src/spec/storyboard.ts';

export function buildJsonSchema(): string {
  // io:'input' = dạng người viết/AI sinh (các trường có mặc định là tùy chọn).
  const schema = z.toJSONSchema(VideoSpecSchema, { io: 'input' });
  return `${JSON.stringify(schema, null, 2)}\n`;
}

/**
 * Lược đồ trả lời cho Gemini: chỉ giữ kiểu, enum, properties, required. Gemini từ chối lược đồ có quá nhiều ràng buộc
 * ("too many states for serving", HTTP 400, đã gặp 2026-11-06) nên bỏ độ dài, mẫu, số mục, mô tả, additionalProperties.
 * Không mất kiểm tra: dịch vụ dựng kiểm lại bằng StoryboardSchema (zod) và validateSpec; luật viết nằm trong prompt.
 */
const GEMINI_DROP = new Set(['$schema', 'default', 'description', 'maxLength', 'minLength', 'pattern', 'maxItems', 'minItems', 'additionalProperties', 'format', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum']);
function forGemini(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(forGemini);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (GEMINI_DROP.has(k)) continue;
      // "properties" là bản đồ tên trường → lược đồ con: giữ nguyên tên trường, chỉ rút gọn lược đồ con.
      out[k] = k === 'properties' ? Object.fromEntries(Object.entries(x as Record<string, unknown>).map(([n, s]) => [n, forGemini(s)])) : forGemini(x);
    }
    return out;
  }
  return v;
}

export function buildStoryboardSchema(): string {
  const s = forGemini(z.toJSONSchema(StoryboardSchema, { io: 'input' })) as { required?: string[]; properties: { scenes: { items: { required?: string[] } } } };
  // Gemini hay bỏ trường tùy chọn: bỏ "items" ở cảnh danh sách thì danh sách rỗng (lỗi thật ở bài #27). Bắt buộc luôn có
  // "items" (cảnh không có danh sách để []) và "facts" (không có số thì []). Zod vẫn cho thiếu, nên dữ liệu cũ không hỏng.
  const scene = s.properties.scenes.items;
  scene.required = [...new Set([...(scene.required ?? []), 'items'])];
  s.required = [...new Set([...(s.required ?? []), 'facts'])];
  return `${JSON.stringify(s, null, 2)}\n`;
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) {
  mkdirSync('schemas', { recursive: true });
  writeFileSync('schemas/video-spec.schema.json', buildJsonSchema());
  const sb = buildStoryboardSchema();
  writeFileSync('schemas/storyboard.schema.json', sb);
  if (existsSync('../peapod-ai/schemas')) writeFileSync('../peapod-ai/schemas/storyboard.schema.json', sb);
  writeFileSync('video-engine.manifest.json', `${JSON.stringify(MANIFEST, null, 2)}\n`);
  console.log('Đã ghi schemas/video-spec.schema.json, schemas/storyboard.schema.json (+ peapod-ai) và video-engine.manifest.json');
}
