// Video Reels 1080×1920 (9:16), 30 khung/giây. Cùng dữ liệu với thẻ tĩnh (schema.ts), màu lấy từ brand.ts.
// Kịch bản: mở đầu thương hiệu → tiêu đề → từng ý → nhận định → nguồn. Thời lượng cố định 15 giây, hoặc theo lời đọc khi có.
// Có ba mẫu bố cục (template), phụ đề cháy cứng (captions), lời đọc (audioUrl) và nhạc nền (musicUrl, tùy chọn).
import { AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { BRAND, LABELS } from './brand';
import { FONT_FAMILY } from './fonts';
import type { ReelProps, ReelTemplate } from './schema';

export const REEL_FPS = 30;
export const REEL_DURATION = 15 * REEL_FPS;
/** Phần mở đầu (thương hiệu + tiêu đề) và phần kết (nhận định + nguồn) cộng quanh lời đọc, tính bằng khung. */
const INTRO = 3 * REEL_FPS;
const OUTRO = 3 * REEL_FPS;

/** Số khung của video: theo lời đọc nếu có, ngược lại 15 giây. */
export function reelFrames(voiceSeconds: number | null | undefined): number {
  if (!voiceSeconds) return REEL_DURATION;
  return Math.round(voiceSeconds * REEL_FPS) + INTRO + OUTRO;
}

const THEMES: Record<ReelTemplate, { bg: string; accent: string; chip: string }> = {
  list: { bg: `linear-gradient(160deg, ${BRAND.ACCENT} 0%, #1e1b4b 100%)`, accent: BRAND.ACCENT, chip: 'rgba(255,255,255,0.12)' },
  focus: { bg: 'linear-gradient(170deg, #0f172a 0%, #312e81 100%)', accent: BRAND.ACCENT, chip: 'rgba(255,255,255,0.08)' },
  alert: { bg: 'linear-gradient(160deg, #b91c1c 0%, #450a0a 100%)', accent: '#b91c1c', chip: 'rgba(255,255,255,0.14)' },
};

const { INK, TINT } = BRAND;
const W = 1080 - 96 * 2;

const reveal = (frame: number, start: number, dist = 40) => {
  const t = interpolate(frame, [start, start + 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return { opacity: t, transform: `translateY(${(1 - t) * dist}px)` };
};

/** Mức xuất hiện 0..1 của một cảnh trong khoảng [from, to): vào mượt, ra mượt. */
const sceneOpacity = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, from + 12, to - 12, to], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

const Header: React.FC<{ market: string; frame: number }> = ({ market, frame }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: W, ...reveal(frame, 0) }}>
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: 14, background: '#ffffff', color: BRAND.ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 700 }}>P</div>
      <div style={{ marginLeft: 22, fontSize: 40, fontWeight: 700 }}>PeaPod AI</div>
    </div>
    <div style={{ border: '3px solid #ffffff', borderRadius: 999, padding: '10px 28px', fontSize: 34, fontWeight: 700 }}>{market}</div>
  </div>
);

/** Phụ đề cháy cứng ở phần dưới. Mốc thời gian của lời đọc bắt đầu sau phần mở đầu. */
const Captions: React.FC<{ captions: ReelProps['captions']; frame: number }> = ({ captions, frame }) => {
  const t = (frame - INTRO) / REEL_FPS;
  const cue = captions.find((c) => t >= c.start && t < c.end);
  if (!cue) return null;
  return (
    <div style={{ position: 'absolute', left: 96, right: 96, bottom: 150, display: 'flex', justifyContent: 'center', fontFamily: FONT_FAMILY }}>
      <div style={{ background: 'rgba(0,0,0,0.62)', color: '#ffffff', borderRadius: 18, padding: '20px 30px', fontSize: 46, lineHeight: 1.4, textAlign: 'center', whiteSpace: 'pre-line', fontWeight: 700 }}>{cue.text}</div>
    </div>
  );
};

export const PeaPodReel: React.FC<ReelProps> = ({ market, title, bullets, takeaway, source, date, template, captions, voiceSeconds, audioUrl, musicUrl }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const labels = LABELS[market];
  const theme = THEMES[template];

  // Các ý chia đều khoảng giữa phần mở đầu và phần kết (đoạn lời đọc); không có lời đọc thì mỗi ý 2 giây.
  const bodyStart = voiceSeconds ? INTRO : 150;
  const bodyEnd = voiceSeconds ? durationInFrames - OUTRO : 150 + bullets.length * 60;
  const step = bullets.length ? Math.max(30, Math.floor((bodyEnd - bodyStart) / bullets.length)) : 60;
  const outroAt = voiceSeconds ? durationInFrames - OUTRO : 330;
  const hasCaptions = captions.length > 0;

  const common: React.CSSProperties = { background: theme.bg, fontFamily: FONT_FAMILY, color: '#ffffff', padding: 96, display: 'flex', flexDirection: 'column' };

  const takeawayBlock = takeaway ? (
    <div style={{ width: W, marginTop: 'auto', background: TINT, color: INK, borderRadius: 24, padding: '40px 44px', ...reveal(frame, outroAt) }}>
      <div style={{ fontSize: 34, fontWeight: 700, color: theme.accent }}>{labels.takeaway}</div>
      <div style={{ marginTop: 16, fontSize: 44, lineHeight: 1.45, textWrap: 'pretty' }}>{takeaway}</div>
    </div>
  ) : null;

  const sourceBlock = (
    <div style={{ width: W, marginTop: 48, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', color: '#e0e7ff', fontSize: 34, ...reveal(frame, outroAt + 30) }}>
      <div style={{ maxWidth: 760 }}>{`${labels.source}: ${source}`}</div>
      <div>{date}</div>
    </div>
  );

  return (
    <>
      <AbsoluteFill style={common}>
        <Header market={market} frame={frame} />
        {template === 'focus' ? (
          <>
            <div style={{ width: W, marginTop: 160, fontSize: 84, fontWeight: 700, lineHeight: 1.2, ...reveal(frame, 20) }}>{title}</div>
            {/* Mỗi ý một cảnh toàn khung, chữ lớn; ý trước mờ đi khi ý sau vào. */}
            <div style={{ position: 'relative', width: W, height: 560, marginTop: 90 }}>
              {bullets.map((b, i) => {
                const from = bodyStart + i * step;
                const to = i === bullets.length - 1 ? outroAt : from + step;
                return (
                  <div key={i} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: sceneOpacity(frame, from, to) }}>
                    <div style={{ fontSize: 40, fontWeight: 700, color: '#a5b4fc', marginBottom: 20 }}>{`${i + 1} / ${bullets.length}`}</div>
                    <div style={{ fontSize: 66, lineHeight: 1.35, textWrap: 'pretty' }}>{b}</div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div style={{ width: W, marginTop: template === 'alert' ? 120 : 180, fontSize: 96, fontWeight: 700, lineHeight: 1.2, ...reveal(frame, 60) }}>
              {template === 'alert' ? <div style={{ fontSize: 40, letterSpacing: 4, marginBottom: 24, color: '#fecaca' }}>{market === 'JP' ? '注意' : 'CẢNH BÁO'}</div> : null}
              {title}
            </div>
            <div style={{ width: W, marginTop: 110, display: 'flex', flexDirection: 'column' }}>
              {bullets.map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 40, background: theme.chip, borderRadius: 18, padding: '28px 32px', ...reveal(frame, bodyStart + i * step) }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, background: '#ffffff', marginTop: 16, marginRight: 24, flex: 'none' }} />
                  <div style={{ fontSize: 50, lineHeight: 1.4, color: '#ffffff', textWrap: 'pretty' }}>{b}</div>
                </div>
              ))}
            </div>
          </>
        )}
        {hasCaptions ? null : takeawayBlock}
        {hasCaptions ? null : sourceBlock}
      </AbsoluteFill>

      {/* Có phụ đề thì nhận định và nguồn nằm ở phần kết, phủ lên trên để không đè phụ đề lúc đang đọc. */}
      {hasCaptions && frame >= outroAt ? (
        <AbsoluteFill style={{ ...common, background: theme.bg, opacity: interpolate(frame, [outroAt, outroAt + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
          <Header market={market} frame={outroAt + 20} />
          <div style={{ width: W, marginTop: 160, fontSize: 80, fontWeight: 700, lineHeight: 1.2 }}>{title}</div>
          {takeawayBlock}
          {sourceBlock}
        </AbsoluteFill>
      ) : null}

      {hasCaptions && frame < outroAt ? <Captions captions={captions} frame={frame} /> : null}
      {audioUrl ? (
        <Sequence from={INTRO}>
          <Audio src={audioUrl} />
        </Sequence>
      ) : null}
      {musicUrl ? <Audio src={musicUrl} volume={audioUrl ? 0.12 : 0.35} loop /> : null}
    </>
  );
};
