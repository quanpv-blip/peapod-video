// Thẻ tin PeaPod 1080×1350. Bố cục và màu lấy từ brand.ts, khớp với thẻ Satori trong peapod-ai.
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { BRAND, LABELS } from './brand';
import { FONT_FAMILY } from './fonts';
import type { CardProps } from './schema';

const { INK, MUTED, SOFT, LINE, ACCENT, TINT } = BRAND;
const TEXT_W = 1080 - 88 * 2;

// Mỗi khối xuất hiện lần lượt: tiêu đề trước, rồi từng ý, nhận định, cuối cùng là nguồn.
const reveal = (frame: number, start: number) => {
  const t = interpolate(frame, [start, start + 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return { opacity: t, transform: `translateY(${(1 - t) * 18}px)` };
};

export const PeaPodCard: React.FC<CardProps> = ({ market, title, bullets, takeaway, source, date }) => {
  const frame = useCurrentFrame();
  const labels = LABELS[market];

  return (
    <AbsoluteFill style={{ background: '#ffffff', padding: 88, fontFamily: FONT_FAMILY, color: INK, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: TEXT_W, ...reveal(frame, 0) }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 10, background: ACCENT, color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 700 }}>P</div>
          <div style={{ marginLeft: 18, fontSize: 30, fontWeight: 700 }}>PeaPod AI</div>
        </div>
        <div style={{ border: `2px solid ${ACCENT}`, borderRadius: 999, padding: '8px 22px', color: ACCENT, fontSize: 26, fontWeight: 700 }}>{market}</div>
      </div>

      <div style={{ width: 120, height: 6, background: ACCENT, marginTop: 44 }} />

      <div style={{ width: TEXT_W, marginTop: 40, fontSize: 70, fontWeight: 700, lineHeight: 1.25, ...reveal(frame, 8) }}>{title}</div>

      <div style={{ width: TEXT_W, marginTop: 52 }}>
        {bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 26, ...reveal(frame, 22 + i * 10) }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: ACCENT, marginTop: 14, marginRight: 22, flex: 'none' }} />
            <div style={{ width: TEXT_W - 36, fontSize: 40, lineHeight: 1.45, color: MUTED, textWrap: 'pretty' }}>{b}</div>
          </div>
        ))}
      </div>

      {takeaway ? (
        <div style={{ width: TEXT_W, marginTop: 30, background: TINT, borderLeft: `6px solid ${ACCENT}`, borderRadius: 14, padding: '26px 32px', ...reveal(frame, 22 + bullets.length * 10 + 6) }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: ACCENT }}>{labels.takeaway}</div>
          <div style={{ marginTop: 10, fontSize: 32, lineHeight: 1.5, color: INK, textWrap: 'pretty' }}>{takeaway}</div>
        </div>
      ) : null}

      <div style={{ width: TEXT_W, marginTop: 'auto', borderTop: `2px solid ${LINE}`, paddingTop: 30, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', ...reveal(frame, 60) }}>
        <div style={{ fontSize: 28, color: SOFT, maxWidth: 760 }}>{`${labels.source}: ${source}`}</div>
        <div style={{ fontSize: 28, color: SOFT }}>{date}</div>
      </div>
    </AbsoluteFill>
  );
};
