// RenderPlan: biên dịch VideoSpec + thời lượng âm thanh thật của từng cảnh thành mọi con số mà composition cần
// (khung bắt đầu/độ dài cảnh, khung hiện từng phần tử, trang phụ đề, cửa sổ lời đọc để hạ nhạc). Thuần, có test.
// Composition không tự tính lại thời gian: chỉ đọc plan, nên xem trước (Studio/Player) và dựng thật luôn khớp nhau.
import { beatStarts, beatTargets, estimateSegFractions, READ_RATE, splitBeats, stripBeats } from '../spec/beats.ts';
import type { Lang } from '../spec/numbers.ts';
import type { Scene, VideoSpec } from '../spec/schema.ts';
import { estimateTokens, pageLimits, paginate, tokenize, type CaptionPage } from './captions.ts';

/** Âm thanh lời đọc đã chuẩn bị cho một cảnh. `src` là URL trình duyệt tải được (http hoặc staticFile). */
export interface SceneAudio {
  src: string;
  seconds: number;
  /** Mốc từng từ (ms, tính từ đầu đoạn âm thanh), theo đúng cách tách `splitBeats` → `tokenize` từng đoạn. */
  words?: { text: string; startMs: number; endMs: number }[];
}

export interface PlannedScene {
  scene: Scene;
  index: number;
  /** Khung bắt đầu trên dòng thời gian tổng (đã trừ phần chồng chuyển cảnh). */
  from: number;
  durationInFrames: number;
  /** Khung chồng với cảnh SAU (0 với cảnh cuối). */
  transitionOutFrames: number;
  transitionOutType: VideoSpec['transition']['type'];
  /** Khung (tính trong cảnh) bắt đầu và kết thúc lời đọc. */
  speechFrom: number;
  speechTo: number;
  audio: SceneAudio | null;
  /** Khung (trong cảnh) mỗi phần tử hiện ra. */
  beats: number[];
  /** Trang phụ đề, mốc ms tính trong cảnh. */
  captions: CaptionPage[];
  /** Tiêu đề chương giống cảnh trước: giữ nguyên, không chạy lại hiệu ứng vào. */
  headingContinues: boolean;
  /** Số thứ tự chương (0 = chưa có tiêu đề chương, ví dụ cảnh hook); dùng để xoay màu nhấn. */
  chapter: number;
}

export interface RenderPlan {
  spec: VideoSpec;
  fps: number;
  width: number;
  height: number;
  totalFrames: number;
  scenes: PlannedScene[];
  /** Mức âm thanh mẫu: true khi lời đọc là ước lượng (chưa có âm thanh thật). */
  estimatedTiming: boolean;
}

/** Khoảng đệm quanh lời đọc (giây): lặng trước khi nói và sau khi nói xong, trước khi chuyển cảnh. */
export const LEAD_IN = 0.25;
export const TAIL = 0.35;
/** Cảnh không lời đọc và không gợi ý thời lượng. */
const DEFAULT_SILENT_SECONDS = 2.5;

const FORMAT_SIZE = {
  'reel-9x16': [1080, 1920],
  'portrait-4x5': [1080, 1350],
  'square-1x1': [1080, 1080],
  'wide-16x9': [1920, 1080],
} as const;

/** Thời lượng lời đọc ước tính (giây) theo tốc độ đọc khi chưa có âm thanh thật. */
export function estimateSpeechSeconds(text: string, lang: Lang): number {
  const chars = [...stripBeats(text)].length;
  return chars / READ_RATE[lang];
}

const headingKey = (s: Scene) => (s.heading ? `${s.eyebrow ?? ''}|${s.heading.title}|${s.heading.accent ?? ''}|${s.heading.icon ?? ''}` : '');

/**
 * Lập kế hoạch dựng. `audio[sceneId]` là âm thanh thật nếu có; thiếu thì ước lượng thời lượng (và đánh dấu estimatedTiming).
 */
export function buildPlan(spec: VideoSpec, audio: Record<string, SceneAudio | undefined> = {}): RenderPlan {
  const fps = spec.fps;
  const lang = spec.language as Lang;
  const [width, height] = FORMAT_SIZE[spec.format];
  const { maxWords, maxWidth } = pageLimits(lang, spec.captions.maxWordsPerPage);
  let estimated = false;

  const transOf = (s: Scene) => s.transitionOut ?? spec.transition;
  const scenes: PlannedScene[] = [];
  let cursor = 0;
  let prevTrans = 0;
  let chapter = 0;

  spec.scenes.forEach((scene, index) => {
    const isLast = index === spec.scenes.length - 1;
    const next = spec.scenes[index + 1];
    const t = transOf(scene);
    // Cùng tiêu đề chương với cảnh sau: chuyển cảnh nhẹ (fade ngắn) để tiêu đề đứng yên.
    const sameChapterNext = !!next && headingKey(next) !== '' && headingKey(next) === headingKey(scene);
    const transType = isLast ? 'none' : t.type === 'none' ? 'none' : sameChapterNext ? 'fade' : t.type;
    const transFrames = isLast || transType === 'none' ? 0 : sameChapterNext ? Math.min(8, t.durationFrames) : t.durationFrames;

    const a = spec.narration.enabled && scene.narration ? audio[scene.id] : undefined;
    let speechSec = 0;
    if (spec.narration.enabled && scene.narration) {
      if (a) speechSec = a.seconds;
      else {
        speechSec = estimateSpeechSeconds(scene.narration.text, lang);
        estimated = true;
      }
    }
    // Khung đầu cảnh còn bị chuyển cảnh trước che: hình cảnh này chỉ rõ từ ~nửa sau của chuyển cảnh (blur hiện vào từ 50%).
    // Lời đọc phải chờ hình hiện, nếu không người xem nghe trước khi thấy.
    const enterFrames = Math.ceil(prevTrans * 0.55);
    const leadFrames = Math.max(Math.round(LEAD_IN * fps), enterFrames + 3);
    const minSec = scene.seconds ?? (speechSec ? 0 : DEFAULT_SILENT_SECONDS);
    const bodyFrames = Math.max(Math.ceil(minSec * fps) + enterFrames, speechSec ? leadFrames + Math.ceil((speechSec + TAIL) * fps) : 0);
    // Cảnh dài thêm đúng phần chồng với cảnh sau, để lời đọc không bị chuyển cảnh đè.
    const durationInFrames = bodyFrames + transFrames;

    const speechFrom = speechSec ? leadFrames : 0;
    const speechTo = speechSec ? leadFrames + Math.ceil(speechSec * fps) : 0;

    // Nhịp hình theo dấu "|": vị trí đoạn trong lời đọc → khung.
    // Mốc từng từ đo từ âm thanh thật (prepare.ts) — chỉ dùng khi khớp đúng số từ của lời đọc hiện tại.
    const segs = scene.narration ? splitBeats(scene.narration.text) : [];
    const segWords = segs.map((seg) => tokenize(seg, lang));
    const flatWords = segWords.flat();
    const timed = a?.words && a.words.length === flatWords.length ? a.words : null;

    const n = beatTargets(scene);
    let beats: number[] = [];
    if (n > 0) {
      let fr = segs.length ? estimateSegFractions(segs) : [0];
      if (timed && speechSec) {
        // Đoạn k bắt đầu ở từ đầu tiên của đoạn đó.
        let idx = 0;
        fr = segWords.map((ws) => {
          const w = timed[Math.min(idx, timed.length - 1)]!;
          idx += ws.length;
          return Math.min(1, Math.max(0, w.startMs / (speechSec * 1000)));
        });
      }
      const starts = beatStarts(n, fr);
      const base = speechSec ? speechFrom : enterFrames + 4;
      const win = speechSec ? speechTo - speechFrom : bodyFrames - base - 12;
      beats = starts.map((f) => Math.round(base + f * win));
    }

    let captions: CaptionPage[] = [];
    if (spec.captions.enabled && scene.narration && speechSec) {
      const offset = (speechFrom / fps) * 1000;
      const toks = timed
        ? timed.map((w, i) => ({ text: lang === 'vi' && i > 0 ? ` ${w.text}` : w.text, startMs: Math.round(offset + w.startMs), endMs: Math.round(offset + w.endMs), timestampMs: Math.round(offset + (w.startMs + w.endMs) / 2), confidence: null }))
        : estimateTokens(tokenize(stripBeats(scene.narration.text), lang), offset, speechSec * 1000, lang);
      captions = paginate(toks, maxWords, maxWidth);
    }
    if (headingKey(scene) !== '' && !(index > 0 && headingKey(scene) === headingKey(spec.scenes[index - 1]!))) chapter++;

    scenes.push({
      scene,
      index,
      from: cursor,
      durationInFrames,
      transitionOutFrames: transFrames,
      transitionOutType: transType,
      speechFrom,
      speechTo,
      audio: a ?? null,
      beats,
      captions,
      headingContinues: index > 0 && headingKey(scene) !== '' && headingKey(scene) === headingKey(spec.scenes[index - 1]!),
      chapter,
    });
    cursor += durationInFrames - transFrames;
    prevTrans = transFrames;
  });

  const last = scenes.at(-1)!;
  return { spec, fps, width, height, totalFrames: last.from + last.durationInFrames, scenes, estimatedTiming: estimated };
}

export const planSeconds = (p: RenderPlan) => Math.round((p.totalFrames / p.fps) * 10) / 10;
