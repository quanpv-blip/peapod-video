// Token thiết kế của Video Engine: màu, cỡ chữ, bố cục theo vùng an toàn, nhịp chuyển động.
// Phong cách bám video mẫu (ba-team/docs/20-video-style-bible.md): nền gần đen có lưới và quầng sáng ấm, tiêu đề chương
// căn trái ở trên (dòng 2 màu nhấn), nội dung ở giữa, phụ đề karaoke ở dưới, nhiều nhịp hình nhỏ khớp lời đọc.
import type { VideoSpec } from '../spec/schema.ts';

export interface Palette {
  bg: string;
  bgEdge: string;
  glow: string;
  grid: string;
  panel: string;
  panelLine: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  accentInk: string;
  gold: string;
  violet: string;
  mint: string;
  danger: string;
}

// Màu đo bằng canvas trên ~34 khung của video mẫu (ba-team/docs/20-video-style-bible.md §2).
const BASE = {
  bg: '#0b0f1a',
  bgEdge: '#080b14',
  grid: 'rgba(255,255,255,0.04)',
  panel: 'rgba(20,24,37,0.92)',
  panelLine: 'rgba(150,153,163,0.45)',
  text: '#eef0f5',
  muted: '#868a94',
  faint: '#5f6470',
  gold: '#fad365',
  violet: '#c089f5',
  mint: '#82c097',
  danger: '#ee6a63',
  accentInk: '#080810',
};

/** Quầng sáng nền đổi theo màu nhấn của chương (video mẫu đổi cả hai cùng lúc). */
export const glowOf = (hex: string, alpha = 0.2) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

export const PALETTES: Record<VideoSpec['theme']['palette'], Palette> = {
  ember: { ...BASE, glow: glowOf('#ee7a4b'), accent: '#ee7a4b' },
  indigo: { ...BASE, glow: glowOf('#7c83ff'), accent: '#7c83ff' },
  ink: { ...BASE, glow: glowOf('#94a3b8', 0.14), accent: '#e2e8f0' },
  alert: { ...BASE, glow: glowOf('#ee6a63'), accent: '#ee6a63' },
};

/** Màu nhấn xoay vòng theo chương (cam, xanh, tím, vàng, san hô) như video mẫu. Chương 0 dùng màu của bảng. */
export const CHAPTER_ACCENTS = ['#ee7a4b', '#82c097', '#c089f5', '#fad365', '#ee8a83'] as const;

export function paletteForChapter(base: Palette, chapter: number, rotate: boolean): Palette {
  if (!rotate || chapter <= 0) return base;
  const accent = CHAPTER_ACCENTS[chapter % CHAPTER_ACCENTS.length]!;
  return { ...base, accent, glow: glowOf(accent) };
}

export const TONES = ['accent', 'gold', 'violet', 'mint'] as const;
export type Tone = (typeof TONES)[number];
export const toneColor = (p: Palette, t: Tone) => (t === 'accent' ? p.accent : p[t]);

/** Cỡ chữ (px trên khung 1080 rộng). Tiếng Nhật dày nét hơn nên giảm nhẹ ở cỡ lớn. */
export const TYPE = {
  eyebrow: 30,
  heading: 84,
  display: 200,
  title: 64,
  body: 44,
  small: 34,
  caption: 54,
  /** Video mẫu dùng 1,4–1,6% chiều cao (quá nhỏ trên điện thoại); nâng lên ~1,6%. */
  note: 30,
};

export interface Layout {
  width: number;
  height: number;
  padL: number;
  padR: number;
  /** Vùng tiêu đề chương. */
  headTop: number;
  /** Vùng nội dung. */
  bodyTop: number;
  bodyBottom: number;
  /** Tâm dòng phụ đề (ngay trên vùng an toàn dưới). */
  captionY: number;
  contentWidth: number;
}

export function layoutOf(spec: Pick<VideoSpec, 'safeArea'>, width = 1080, height = 1920): Layout {
  const s = spec.safeArea;
  // Lề ngang của mẫu: 5,6% chiều rộng; lề phải tôn trọng cột nút của Reels.
  const padL = Math.max(s.left, Math.round(width * 0.056));
  const padR = Math.max(s.right, Math.round(width * 0.056));
  // Tiêu đề ở ~15% chiều cao (mẫu: 8–25%), cố định để không nhảy giữa các cảnh cùng chương.
  const headTop = Math.max(s.top, Math.round(height * 0.15));
  // Phụ đề ở ~77% (mẫu đặt 87%, nằm trong vùng Reels che; style bible §7 đề xuất 76–78%).
  const captionY = Math.min(Math.round(height * 0.77), height - s.bottom - 40);
  return {
    width,
    height,
    padL,
    padR,
    headTop,
    bodyTop: headTop + 270,
    bodyBottom: captionY - 110,
    captionY,
    contentWidth: width - padL - padR,
  };
}

/** Nhịp chuyển động chung (khung, ở 30 fps). */
export const MOTION = {
  enter: 14,
  stagger: 6,
  /** Mẫu: "1 → 12" khoảng 16 khung. */
  countUp: 18,
  annotate: 20,
};
