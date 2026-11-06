// Hàm chuyển động dùng chung. Mọi giá trị chỉ phụ thuộc số khung nên dựng xác định (giống nhau mỗi lần dựng).
import { Easing, interpolate, spring } from 'remotion';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** Tiến trình 0..1 bắt đầu tại `start`, kéo dài `dur` khung, có easing ra mượt. */
export function progress(frame: number, start: number, dur: number, easing = Easing.bezier(0.22, 1, 0.36, 1)): number {
  return interpolate(frame, [start, start + dur], [0, 1], { ...clamp, easing });
}

/** Lò xo bật nhẹ (cho thẻ, chip xuất hiện). */
export function pop(frame: number, fps: number, start: number, damping = 14): number {
  return spring({ frame: frame - start, fps, config: { damping, stiffness: 170, mass: 0.7 } });
}

/** Kiểu "trồi lên + rõ dần" cho một phần tử, kèm nhòe nhẹ lúc đầu. */
export function rise(frame: number, start: number, dur = 14, dist = 36): React.CSSProperties {
  const p = progress(frame, start, dur);
  return { opacity: p, transform: `translateY(${(1 - p) * dist}px)`, filter: p < 1 ? `blur(${(1 - p) * 8}px)` : undefined };
}

/** Phần tử đã hiện và còn "đang được nói tới" (để làm nổi). */
export function isActive(frame: number, start: number, nextStart: number | undefined): boolean {
  return frame >= start && (nextStart === undefined || frame < nextStart);
}

export { clamp };
