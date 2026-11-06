// Bộ biểu tượng nét (stroke) thống nhất cho mọi cảnh. Dùng SVG thay cho emoji: máy dựng (Linux/headless) thường thiếu font emoji màu,
// và emoji mỗi hệ điều hành vẽ khác nhau. Tên biểu tượng phải nằm trong ICONS của schema.ts.
import type { ICONS } from '../spec/schema.ts';

export type IconName = (typeof ICONS)[number];

const PATHS: Record<IconName, string> = {
  shield: 'M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3z M9 12l2 2 4-4',
  alert: 'M12 3l9.5 17H2.5L12 3z M12 10v4 M12 17.2v.3',
  chip: 'M7 7h10v10H7z M10 10h4v4h-4z M9 3v4 M15 3v4 M9 17v4 M15 17v4 M3 9h4 M3 15h4 M17 9h4 M17 15h4',
  cloud: 'M7 18h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.5 9.5 4.25 4.25 0 0 0 7 18z',
  server: 'M4 4h16v6H4z M4 14h16v6H4z M7.5 7h.01 M7.5 17h.01 M11 7h6 M11 17h6',
  money: 'M3 6h18v12H3z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M6 9v.01 M18 15v.01',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5 M16 4.5a3.5 3.5 0 0 1 0 7 M18.5 14.8c1.4.9 2.2 2.6 2.5 5.2',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M3 12h18 M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z',
  lock: 'M5 11h14v10H5z M8 11V7a4 4 0 1 1 8 0v4 M12 15v2',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7l1-8z',
  chart: 'M4 20h16 M7 16v-5 M12 16V7 M17 16v-3',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2',
  check: 'M4 12.5l5 5L20 6.5',
  mail: 'M3 5h18v14H3z M3.5 6l8.5 7 8.5-7',
  building: 'M4 21V5l8-2v18 M12 8h8v13 M7 8h2 M7 12h2 M7 16h2 M15 12h2 M15 16h2 M2 21h20',
  factory: 'M3 21V10l5 3V10l5 3V5h3l1 8h4v8z M7 17h2 M12 17h2 M17 17h2',
  robot: 'M5 8h14v11H5z M12 4v4 M9 13h.01 M15 13h.01 M9.5 16.5h5 M2.5 12v3 M21.5 12v3',
  thermometer: 'M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z M12 9v7',
  link: 'M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1 M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1',
  document: 'M7 3h7l5 5v13H7z M14 3v5h5 M10 13h6 M10 17h6',
};

export const Icon: React.FC<{ name: IconName; size: number; color: string; strokeWidth?: number; style?: React.CSSProperties }> = ({ name, size, color, strokeWidth = 1.8, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', ...style }}>
    <path d={PATHS[name]} />
  </svg>
);
