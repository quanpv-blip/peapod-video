// Composition gốc của Video Engine: dựng một VideoSpec thành video.
// Bố cục lớp: nền (liền mạch) → TransitionSeries các cảnh (mỗi cảnh: tiêu đề chương, nội dung, chú thích, phụ đề, lời đọc) → nhạc nền.
// Thời gian lấy hoàn toàn từ buildPlan (engine/plan.ts), cùng hàm dùng trong calculateMetadata và validateSpec.
import { Audio } from '@remotion/media';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { Fragment, useMemo } from 'react';
import { AbsoluteFill, interpolate, interpolateColors, Sequence, staticFile, type CalculateMetadataFunction } from 'remotion';
import type { Lang } from '../spec/numbers.ts';
import { VideoSpecSchema, type VideoSpecInput } from '../spec/schema.ts';
import { Backdrop } from './Backdrop.tsx';
import { KaraokeCaptions } from './Captions.tsx';
import type { SceneCtx } from './context.ts';
import { Heading } from './Heading.tsx';
import { Note } from './parts.tsx';
import { buildPlan, type PlannedScene, type RenderPlan, type SceneAudio } from './plan.ts';
import { CardsScene, ChartScene, CompareScene, ConceptScene, MapScene, PhotoScene, ProcessScene, StatScene, TimelineScene } from './scenes/data.tsx';
import { AlertScene, BulletsScene, ChecklistScene, CtaScene, HookScene, QuoteScene, RecapScene, SourceScene } from './scenes/text.tsx';
import { glowOf, layoutOf, PALETTES, paletteForChapter } from './theme.ts';
import { presentationFor } from './transitions.ts';

export interface SpecVideoProps extends Record<string, unknown> {
  spec: VideoSpecInput;
  /** Âm thanh lời đọc đã chuẩn bị theo id cảnh. Thiếu thì video dựng với thời lượng ước lượng và không có tiếng. */
  audio: Record<string, SceneAudio>;
  /** Âm thanh nhạc nền đã chuẩn bị (đường dẫn trình duyệt tải được), nếu spec.music có. */
  musicSrc?: string | null;
}

export function planFromProps(props: SpecVideoProps): RenderPlan {
  return buildPlan(VideoSpecSchema.parse(props.spec), props.audio ?? {});
}

export const calculateSpecMetadata: CalculateMetadataFunction<SpecVideoProps> = ({ props }) => {
  const plan = planFromProps(props);
  return { durationInFrames: plan.totalFrames, width: plan.width, height: plan.height, fps: plan.fps };
};

/** Đường dẫn tương đối (thư mục public của bundle) → staticFile; http(s) giữ nguyên. */
const resolveSrc = (src: string) => (/^https?:\/\//.test(src) ? src : staticFile(src.replace(/^\/+/, '')));

const SceneBody: React.FC<{ ctx: SceneCtx }> = ({ ctx }) => {
  const s = ctx.ps.scene;
  switch (s.kind) {
    case 'hook': return <HookScene s={s} ctx={ctx} />;
    case 'stat': return <StatScene s={s} ctx={ctx} />;
    case 'cards': return <CardsScene s={s} ctx={ctx} />;
    case 'compare': return <CompareScene s={s} ctx={ctx} />;
    case 'timeline': return <TimelineScene s={s} ctx={ctx} />;
    case 'chart': return <ChartScene s={s} ctx={ctx} />;
    case 'quote': return <QuoteScene s={s} ctx={ctx} />;
    case 'bullets': return <BulletsScene s={s} ctx={ctx} />;
    case 'checklist': return <ChecklistScene s={s} ctx={ctx} />;
    case 'concept': return <ConceptScene s={s} ctx={ctx} />;
    case 'process': return <ProcessScene s={s} ctx={ctx} />;
    case 'map': return <MapScene s={s} ctx={ctx} />;
    case 'photo': return <PhotoScene s={s} ctx={ctx} />;
    case 'alert': return <AlertScene s={s} ctx={ctx} />;
    case 'recap': return <RecapScene s={s} ctx={ctx} />;
    case 'source': return <SourceScene s={s} ctx={ctx} />;
    case 'cta': return <CtaScene s={s} ctx={ctx} />;
  }
};

const SceneFrame: React.FC<{ ctx: SceneCtx }> = ({ ctx }) => {
  const { ps, spec, palette, layout, ja } = ctx;
  return (
    <AbsoluteFill>
      <Heading scene={ps.scene} layout={layout} palette={palette} continues={ps.headingContinues} ja={ja} />
      <SceneBody ctx={ctx} />
      {ps.scene.kind !== 'source' ? <Note layout={layout} palette={palette} text={ps.scene.note} /> : null}
      {spec.captions.enabled && ps.captions.length ? <KaraokeCaptions pages={ps.captions} layout={layout} palette={palette} style={spec.captions.style} highlight={spec.captions.highlight} ja={ja} /> : null}
      {ps.audio ? (
        <Sequence from={ps.speechFrom} durationInFrames={Math.max(1, ps.durationInFrames - ps.speechFrom)} layout="none" name={`Lời đọc ${ps.scene.id}`}>
          <Audio src={resolveSrc(ps.audio.src)} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};

/** Âm lượng nhạc nền theo khung: hạ xuống `duckDb` khi có lời đọc, chuyển mượt trong 8 khung. */
function musicVolume(plan: RenderPlan, frame: number): number {
  const m = plan.spec.music;
  if (!m) return 0;
  const duck = 10 ** (m.duckDb / 20);
  let speaking = 0;
  for (const p of plan.scenes) {
    if (!p.audio) continue;
    const a = p.from + p.speechFrom;
    const b = p.from + p.speechTo;
    speaking = Math.max(speaking, interpolate(frame, [a - 8, a, b, b + 8], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  }
  const fadeOut = interpolate(frame, [plan.totalFrames - 30, plan.totalFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return m.volume * (1 - speaking * (1 - duck)) * fadeOut;
}

export const SpecVideo: React.FC<SpecVideoProps> = (props) => {
  const plan = useMemo(() => planFromProps(props), [props]);
  const spec = plan.spec;
  const palette = PALETTES[spec.theme.palette];
  const layout = layoutOf(spec, plan.width, plan.height);
  const lang = spec.language as Lang;
  const facts = useMemo(() => new Map(spec.facts.map((f) => [f.id, f])), [spec]);
  // Màu nhấn xoay theo chương (trừ bảng alert): chương 0 (hook) giữ màu gốc.
  const rotate = spec.theme.chapterColors && spec.theme.palette !== 'alert';
  const ctxOf = (ps: PlannedScene): SceneCtx => ({ spec, palette: paletteForChapter(palette, ps.chapter, rotate), layout, lang, ja: lang === 'ja', facts, ps });
  return (
    <AbsoluteFill style={{ background: palette.bgEdge }}>
      <Backdrop
        palette={palette}
        glowAt={(f) => {
          // màu quầng sáng của chương đang chiếu, chuyển mượt trong 14 khung đầu cảnh
          const i = Math.max(0, plan.scenes.reduce((acc, p, k) => (p.from <= f ? k : acc), 0));
          const cur = paletteForChapter(palette, plan.scenes[i]!.chapter, rotate).accent;
          const prev = i > 0 ? paletteForChapter(palette, plan.scenes[i - 1]!.chapter, rotate).accent : cur;
          const start = plan.scenes[i]!.from;
          return glowOf(interpolateColors(f, [start, start + 14], [prev, cur]), 0.2);
        }}
      />
      <TransitionSeries>
        {plan.scenes.map((ps) => (
          <Fragment key={ps.scene.id}>
            <TransitionSeries.Sequence durationInFrames={ps.durationInFrames} name={`${ps.index + 1}. ${ps.scene.kind} (${ps.scene.id})`} premountFor={30}>
              <SceneFrame ctx={ctxOf(ps)} />
            </TransitionSeries.Sequence>
            {ps.transitionOutFrames > 0 ? (
              <TransitionSeries.Transition presentation={presentationFor(ps.transitionOutType, (ps.scene.transitionOut ?? spec.transition).direction)} timing={linearTiming({ durationInFrames: ps.transitionOutFrames })} />
            ) : null}
          </Fragment>
        ))}
      </TransitionSeries>
      {spec.music && props.musicSrc ? <Audio src={resolveSrc(props.musicSrc)} loop loopVolumeCurveBehavior="extend" volume={(f) => musicVolume(plan, f)} /> : null}
    </AbsoluteFill>
  );
};
