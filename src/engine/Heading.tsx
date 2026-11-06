// Tiêu đề chương ở đầu khung: dòng nhỏ (eyebrow, ví dụ "01 — HẬU QUẢ"), dòng 1 chữ trắng, dòng 2 màu nhấn, biểu tượng.
// Khi cảnh trước có cùng tiêu đề (`continues`), hiện ngay không chạy hiệu ứng: tiêu đề đứng yên qua các cảnh của cùng chương.
import { useCurrentFrame } from 'remotion';
import type { Scene } from '../spec/schema.ts';
import { FONT_FAMILY } from '../fonts.ts';
import { Icon } from './Icon.tsx';
import { rise } from './motion.ts';
import { TYPE, type Layout, type Palette } from './theme.ts';

export const Heading: React.FC<{ scene: Scene; layout: Layout; palette: Palette; continues: boolean; ja: boolean }> = ({ scene, layout, palette, continues, ja }) => {
  const frame = useCurrentFrame();
  if (!scene.heading) return null;
  const at = (n: number) => (continues ? {} : rise(frame, n, 14, 26));
  const size = ja ? TYPE.heading * 0.86 : TYPE.heading;
  return (
    <div style={{ position: 'absolute', left: layout.padL, right: layout.padR, top: layout.headTop, fontFamily: FONT_FAMILY }}>
      {scene.eyebrow ? (
        <div style={{ ...at(0), fontSize: TYPE.eyebrow, fontWeight: 800, letterSpacing: 2, color: palette.accent, marginBottom: 14 }}>{scene.eyebrow}</div>
      ) : null}
      <div style={{ ...at(3), display: 'flex', alignItems: 'center', gap: 22, fontSize: size, fontWeight: 800, lineHeight: 1.08, color: palette.text, letterSpacing: ja ? 0 : -1 }}>
        {scene.heading.icon ? <Icon name={scene.heading.icon} size={size * 0.9} color={palette.accent} strokeWidth={2.2} /> : null}
        <span>{scene.heading.title}</span>
      </div>
      {scene.heading.accent ? (
        <div style={{ ...at(8), fontSize: size, fontWeight: 800, lineHeight: 1.12, color: palette.accent, letterSpacing: ja ? 0 : -1 }}>{scene.heading.accent}</div>
      ) : null}
    </div>
  );
};
