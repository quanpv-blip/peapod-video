// Nền chung cho mọi cảnh: gradient tối, lưới mờ, quầng sáng màu nhấn trôi chậm, hạt bụi trôi (xác định theo khung nhờ @remotion/noise).
// Nằm NGOÀI TransitionSeries nên không bị mờ hay nhòe khi chuyển cảnh: chỉ nội dung đổi, nền liền mạch như video mẫu.
import { noise2D } from '@remotion/noise';
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Palette } from './theme.ts';

const PARTICLES = 46;

export const Backdrop: React.FC<{ palette: Palette; glowAt?: (frame: number) => string }> = ({ palette: base, glowAt }) => {
  const frame = useCurrentFrame();
  const palette = glowAt ? { ...base, glow: glowAt(frame) } : base;
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  // quầng sáng lắc lư nhẹ quanh 1/3 trên của khung
  const gx = 0.5 + noise2D('glow-x', t * 0.08, 0) * 0.12;
  const gy = 0.42 + noise2D('glow-y', 0, t * 0.08) * 0.08;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(140% 90% at 50% 40%, ${palette.bg} 0%, ${palette.bgEdge} 100%)` }}>
      <AbsoluteFill style={{ background: `radial-gradient(55% 32% at ${gx * 100}% ${gy * 100}%, ${palette.glow}, transparent 70%)` }} />
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${palette.grid} 1px, transparent 1px), linear-gradient(90deg, ${palette.grid} 1px, transparent 1px)`,
          backgroundSize: `${width / 12}px ${width / 12}px`,
          backgroundPosition: `0 ${(-t * 6) % (width / 12)}px`,
          maskImage: 'radial-gradient(85% 70% at 50% 42%, #000 30%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(85% 70% at 50% 42%, #000 30%, transparent 85%)',
        }}
      />
      {Array.from({ length: PARTICLES }, (_, i) => {
        const x0 = random(`px-${i}`) * width;
        const y0 = random(`py-${i}`) * height;
        const speed = 8 + random(`ps-${i}`) * 18;
        const y = (((y0 - t * speed) % height) + height) % height;
        const x = x0 + noise2D(`pn-${i}`, t * 0.15, i) * 30;
        const size = 1.5 + random(`pz-${i}`) * 2.5;
        const flicker = 0.25 + 0.45 * (0.5 + 0.5 * noise2D(`pf-${i}`, t * 0.6, 0));
        return <div key={i} style={{ position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: '50%', background: '#fff', opacity: flicker * 0.55 }} />;
      })}
      {/* vignette */}
      <AbsoluteFill style={{ background: 'radial-gradient(120% 80% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)' }} />
    </AbsoluteFill>
  );
};
