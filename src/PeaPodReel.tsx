// Video Reels 1080×1920 (9:16), 15 giây ở 30 khung/giây. Cùng dữ liệu với thẻ tĩnh (schema.ts), màu lấy từ brand.ts.
// Kịch bản theo thời gian: thương hiệu → tiêu đề → từng ý → nhận định → nguồn. Chưa có lời đọc (TTS) và nhạc nền.
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { BRAND, LABELS } from './brand';
import { FONT_FAMILY } from './fonts';
import type { CardProps } from './schema';

export const REEL_FPS = 30;
export const REEL_DURATION = 15 * REEL_FPS;

const { INK, ACCENT, TINT } = BRAND;
const W = 1080 - 96 * 2;

// Xuất hiện trong khoảng [start, start+18] khung, rồi giữ nguyên.
const reveal = (frame: number, start: number) => {
  const t = interpolate(frame, [start, start + 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return { opacity: t, transform: `translateY(${(1 - t) * 40}px)` };
};

// Mỗi ý chiếm 60 khung (2 giây) và bắt đầu từ khung 150.
const BULLET_START = 150;
const BULLET_STEP = 60;

export const PeaPodReel: React.FC<CardProps> = ({ market, title, bullets, takeaway, source, date }) => {
  const frame = useCurrentFrame();
  const labels = LABELS[market];

  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${ACCENT} 0%, #1e1b4b 100%)`, fontFamily: FONT_FAMILY, color: '#ffffff', padding: 96, display: 'flex', flexDirection: 'column' }}>
      {/* Cảnh 1: thương hiệu và thị trường (0–90) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: W, ...reveal(frame, 0) }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 14, background: '#ffffff', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 700 }}>P</div>
          <div style={{ marginLeft: 22, fontSize: 40, fontWeight: 700 }}>PeaPod AI</div>
        </div>
        <div style={{ border: '3px solid #ffffff', borderRadius: 999, padding: '10px 28px', fontSize: 34, fontWeight: 700 }}>{market}</div>
      </div>

      {/* Cảnh 2: tiêu đề (60–150) */}
      <div style={{ width: W, marginTop: 180, fontSize: 96, fontWeight: 700, lineHeight: 1.2, ...reveal(frame, 60) }}>{title}</div>

      {/* Cảnh 3: từng ý (150–330) */}
      <div style={{ width: W, marginTop: 110, display: 'flex', flexDirection: 'column' }}>
        {bullets.map((b, i) => {
          const at = BULLET_START + i * BULLET_STEP;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 40, background: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: '28px 32px', ...reveal(frame, at) }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, background: '#ffffff', marginTop: 16, marginRight: 24, flex: 'none' }} />
              <div style={{ fontSize: 50, lineHeight: 1.4, color: '#ffffff', textWrap: 'pretty' }}>{b}</div>
            </div>
          );
        })}
      </div>

      {/* Cảnh 4: nhận định (330–420) */}
      {takeaway ? (
        <div style={{ width: W, marginTop: 'auto', background: TINT, color: INK, borderRadius: 24, padding: '40px 44px', ...reveal(frame, 330) }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: ACCENT }}>{labels.takeaway}</div>
          <div style={{ marginTop: 16, fontSize: 44, lineHeight: 1.45, textWrap: 'pretty' }}>{takeaway}</div>
        </div>
      ) : null}

      {/* Cảnh 5: nguồn và ngày (420–450) */}
      <div style={{ width: W, marginTop: 48, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', color: '#e0e7ff', fontSize: 34, ...reveal(frame, 420) }}>
        <div style={{ maxWidth: 760 }}>{`${labels.source}: ${source}`}</div>
        <div>{date}</div>
      </div>
    </AbsoluteFill>
  );
};
