// Render một thẻ tĩnh PNG từ file JSON dữ liệu (cùng hợp đồng với peapod-ai).
// Dùng: npx tsx scripts/render.ts <props.json> <output.png>
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cardSchema } from '../src/schema.ts';

const [, , propsPath, outPath] = process.argv;
if (!propsPath || !outPath) {
  console.error('Dùng: npx tsx scripts/render.ts <props.json> <output.png>');
  process.exit(2);
}

const inputProps = cardSchema.parse(JSON.parse(readFileSync(propsPath, 'utf8')));
const serveUrl = await bundle({ entryPoint: resolve('src/index.ts'), publicDir: resolve('public') });
const composition = await selectComposition({ serveUrl, id: 'PeaPodCard', inputProps });
// Chụp khung cuối: lúc đó mọi khối đã hiện xong. Khung 0 sẽ trống vì hoạt ảnh chưa bắt đầu.
await renderStill({ composition, serveUrl, output: resolve(outPath), inputProps, imageFormat: 'png', frame: composition.durationInFrames - 1 });
console.log('ok', resolve(outPath));
