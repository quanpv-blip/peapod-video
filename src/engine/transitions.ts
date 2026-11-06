// Chuyển cảnh. "blur" là presentation tùy chỉnh giống video mẫu: cảnh cũ nhòe + mờ + thu nhẹ, cảnh mới rõ dần từ nhòe.
// Các kiểu khác dùng presentation chính thức của @remotion/transitions (đường dẫn import đã xác minh ở 4.0.540).
import { createElement } from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import type { TransitionPresentation, TransitionPresentationComponentProps } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { flip } from '@remotion/transitions/flip';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import type { VideoSpec } from '../spec/schema.ts';

type BlurProps = { maxBlur: number };

const BlurComponent = ({ children, presentationDirection, presentationProgress, passedProps }: TransitionPresentationComponentProps<BlurProps>) => {
  const p = presentationProgress;
  const exiting = presentationDirection === 'exiting';
  // Theo số đo video mẫu (style bible §4.2): cảnh cũ mờ + nhòe trong ~1/3 đầu, nền trống một nhịp ngắn,
  // cảnh mới rõ dần trong nửa sau. Không chồng chữ hai cảnh lên nhau.
  const OUT = 0.34;
  const IN = 0.5;
  const opacity = exiting ? interpolate(p, [0, OUT], [1, 0], { extrapolateRight: 'clamp' }) : interpolate(p, [IN, 1], [0, 1], { extrapolateLeft: 'clamp' });
  const blur = exiting ? interpolate(p, [0, OUT], [0, passedProps.maxBlur], { extrapolateRight: 'clamp' }) : interpolate(p, [IN, 1], [passedProps.maxBlur * 0.6, 0], { extrapolateLeft: 'clamp' });
  const scale = exiting ? interpolate(p, [0, OUT], [1, 0.97], { extrapolateRight: 'clamp' }) : interpolate(p, [IN, 1], [1.02, 1], { extrapolateLeft: 'clamp' });
  return createElement(AbsoluteFill, { style: { opacity, filter: blur > 0.05 ? `blur(${blur}px)` : undefined, transform: `scale(${scale})` } }, children);
};

export const blurPresentation = (props: Partial<BlurProps> = {}): TransitionPresentation<BlurProps> => ({
  component: BlurComponent,
  props: { maxBlur: props.maxBlur ?? 18 },
});

type Dir = NonNullable<VideoSpec['transition']['direction']>;

/** Presentation theo tên trong spec. Trả kiểu chung để dùng trong TransitionSeries.Transition. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function presentationFor(type: VideoSpec['transition']['type'], direction?: Dir): TransitionPresentation<any> {
  switch (type) {
    case 'slide':
      return slide({ direction: direction ?? 'from-right' });
    case 'wipe':
      return wipe({ direction: direction ?? 'from-left' });
    case 'flip':
      return flip();
    case 'fade':
      return fade();
    case 'blur':
    default:
      return blurPresentation();
  }
}
