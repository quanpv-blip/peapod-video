// Thành phần nhỏ dùng chung: khung thẻ có viền sáng, chip, số đếm lên, chú thích nhỏ, vùng nội dung.
import { interpolate, useCurrentFrame } from 'remotion';
import { FONT_FAMILY } from '../fonts.ts';
import { formatNumber, type Lang } from '../spec/numbers.ts';
import { Icon, type IconName } from './Icon.tsx';
import { progress } from './motion.ts';
import { TYPE, type Layout, type Palette } from './theme.ts';

/** Vùng nội dung giữa tiêu đề và phụ đề; căn giữa theo chiều dọc. */
export const Body: React.FC<{ layout: Layout; children: React.ReactNode; align?: 'center' | 'start' }> = ({ layout, children, align = 'center' }) => (
  <div
    style={{
      position: 'absolute',
      left: layout.padL,
      right: layout.padR,
      top: layout.bodyTop,
      bottom: layout.height - layout.bodyBottom,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: align === 'center' ? 'center' : 'flex-start',
      fontFamily: FONT_FAMILY,
    }}
  >
    {children}
  </div>
);

/** Thẻ nền tối, viền mảnh; `glow` làm viền và bóng màu nhấn (phần tử đang được nói tới). */
export const Panel: React.FC<{ palette: Palette; color?: string; glow?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ palette, color, glow = 0, style, children }) => {
  const c = color ?? palette.accent;
  return (
    <div
      style={{
        position: 'relative',
        background: palette.panel,
        border: `2px solid ${glow > 0 ? c : palette.panelLine}`,
        borderRadius: 22,
        boxShadow: glow > 0 ? `0 0 ${36 * glow}px ${c}55, inset 0 0 ${24 * glow}px ${c}22` : '0 10px 30px rgba(0,0,0,0.35)',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Chip viền màu nhấn có biểu tượng. */
export const Chip: React.FC<{ palette: Palette; text: string; icon?: IconName; color?: string; size?: number; style?: React.CSSProperties }> = ({ palette, text, icon, color, size = TYPE.small, style }) => {
  const c = color ?? palette.accent;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: `${size * 0.36}px ${size * 0.7}px`,
        borderRadius: 999,
        border: `2px solid ${c}`,
        background: `${palette.bg}e6`,
        color: palette.text,
        fontSize: size,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        boxShadow: `0 0 22px ${c}40`,
        fontFamily: FONT_FAMILY,
        ...style,
      }}
    >
      {icon ? <Icon name={icon} size={size * 1.05} color={c} strokeWidth={2.2} /> : null}
      {text}
    </div>
  );
};

/**
 * Số đếm lên tới giá trị fact rồi đứng yên; định dạng theo thị trường bằng formatNumber (VN 3.386.187; JP 338万6187).
 * Nội suy GIÁ TRỊ (không phải chuỗi). Số thập phân giữ đúng số chữ số của giá trị cuối.
 */
export function useCountUp(value: number, start: number, dur: number): number {
  const frame = useCurrentFrame();
  const p = progress(frame, start, dur);
  if (p >= 1) return value;
  const decimals = Number.isInteger(value) ? 0 : (String(value).split('.')[1]?.length ?? 0);
  const v = value * p;
  return decimals ? Number(v.toFixed(decimals)) : Math.round(v);
}

export const NumberText: React.FC<{ value: number; lang: Lang; mode: 'full' | 'compact'; approx?: boolean; unit?: string; start: number; dur: number; countUp?: boolean; size: number; color: string; unitColor: string }> = ({ value, lang, mode, approx, unit, start, dur, countUp = true, size, color, unitColor }) => {
  const shown = useCountUp(value, start, countUp ? dur : 0);
  const prefix = approx ? (lang === 'ja' ? '約' : '~') : '';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: size * 0.08, fontFamily: FONT_FAMILY, fontVariantNumeric: 'tabular-nums' }}>
      {prefix ? <span style={{ fontSize: size * 0.42, fontWeight: 700, color: unitColor }}>{prefix}</span> : null}
      <span style={{ fontSize: size, fontWeight: 800, color, letterSpacing: -2, lineHeight: 1 }}>{formatNumber(shown, lang, { mode })}</span>
      {unit ? <span style={{ fontSize: size * 0.36, fontWeight: 700, color: unitColor, marginLeft: size * 0.05 }}>{unit}</span> : null}
    </span>
  );
};

/** Dòng chú thích nhỏ màu xám (nguồn, "ví dụ minh hoạ"). */
export const Note: React.FC<{ layout: Layout; palette: Palette; text?: string; start?: number }> = ({ layout, palette, text, start = 10 }) => {
  const frame = useCurrentFrame();
  if (!text) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: layout.padL,
        right: layout.padR,
        top: layout.bodyBottom + 16,
        fontFamily: FONT_FAMILY,
        fontSize: TYPE.note,
        color: palette.faint,
        opacity: interpolate(frame, [start, start + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}
    >
      {text}
    </div>
  );
};
