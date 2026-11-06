// Nạp font cho mọi composition: một họ "PeaPod" ghép từ Noto Sans (Latin + Việt) và Noto Sans JP (Nhật), giấy phép OFL-1.1.
// Mỗi tập con khai báo unicode-range nên trình duyệt chọn đúng tệp theo ký tự; trước đây chỉ nạp tập "vietnamese" nên chữ Latin cơ bản
// (a–z, 0–9) rơi sang font khác. Tệp nằm ở public/fonts, sao từ @fontsource (cùng nguồn với thẻ Satori của peapod-ai).
import { loadFont } from '@remotion/fonts';
import { continueRender, delayRender, staticFile } from 'remotion';

export const FONT = 'PeaPod';
export const FONT_FAMILY = `${FONT}, sans-serif`;

const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const VIET = 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB';
const JP = 'U+2E80-2FDF, U+3000-303F, U+3040-30FF, U+31F0-31FF, U+3400-4DBF, U+4E00-9FFF, U+FF00-FFEF';

const files: { url: string; weight: string; unicodeRange: string }[] = [];
for (const w of ['400', '500', '700', '800']) {
  files.push({ url: `fonts/noto-sans-latin-${w}-normal.woff`, weight: w, unicodeRange: LATIN });
  files.push({ url: `fonts/noto-sans-vietnamese-${w}-normal.woff`, weight: w, unicodeRange: VIET });
}
// Tiếng Nhật: 500 dùng chung tệp 400 (không chép thêm 1,6 MB).
for (const [w, f] of [['400', '400'], ['500', '400'], ['700', '700'], ['800', '800']] as const) {
  files.push({ url: `fonts/noto-sans-jp-japanese-${f}-normal.woff`, weight: w, unicodeRange: JP });
}

const handle = delayRender('Đang nạp font PeaPod');
Promise.all(files.map((f) => loadFont({ family: FONT, url: staticFile(f.url), weight: f.weight, unicodeRange: f.unicodeRange, display: 'block' })))
  .then(() => continueRender(handle))
  .catch((e) => {
    throw e;
  });
