// Nạp font Noto Sans (Latin và tiếng Việt) và Noto Sans JP (tiếng Nhật) từ thư mục public/fonts.
// Cùng bộ font với thẻ Satori trong peapod-ai, để hai nơi render ra chữ giống nhau.
import { loadFont } from '@remotion/fonts';
import { continueRender, delayRender, staticFile } from 'remotion';

export const FONT_FAMILY = 'NotoVN, NotoJP, sans-serif';

const handle = delayRender('Đang nạp font');

Promise.all([
  loadFont({ family: 'NotoVN', url: staticFile('fonts/noto-sans-vietnamese-400-normal.woff'), weight: '400' }),
  loadFont({ family: 'NotoVN', url: staticFile('fonts/noto-sans-vietnamese-700-normal.woff'), weight: '700' }),
  loadFont({ family: 'NotoJP', url: staticFile('fonts/noto-sans-jp-japanese-400-normal.woff'), weight: '400' }),
  loadFont({ family: 'NotoJP', url: staticFile('fonts/noto-sans-jp-japanese-700-normal.woff'), weight: '700' }),
])
  .then(() => continueRender(handle))
  .catch((e) => {
    throw e;
  });
