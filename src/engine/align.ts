// Căn phụ đề theo âm thanh thật mà không cần mô hình nhận dạng: đo các khoảng lặng trong WAV lời đọc,
// rồi neo ranh giới từ (ưu tiên chỗ có dấu câu) vào các khoảng lặng đó; trong mỗi đoạn có tiếng, chia theo độ dài chữ.
// Chính xác hơn hẳn ước lượng thuần theo độ dài chữ (vì biết người đọc ngừng ở đâu và nói nhanh chậm từng đoạn),
// nhưng kém hơn mốc từng từ của TTS. Thuần, chạy ở Node (prepare.ts); kết quả truyền vào composition qua SceneAudio.words.
import { parseWav } from './wav.ts';

export interface TimedWord {
  text: string;
  startMs: number;
  endMs: number;
}

export interface VoiceRegion {
  startMs: number;
  endMs: number;
}

/** Cửa sổ đo năng lượng (ms). */
const FRAME_MS = 10;
/** Khoảng lặng ngắn nhất được coi là chỗ ngừng (ms). Ngắn hơn là khoảng nghỉ giữa âm tiết. */
const MIN_PAUSE_MS = 160;
/** Đoạn có tiếng ngắn nhất (ms); ngắn hơn là tiếng ồn/hơi thở, gộp vào khoảng lặng. */
const MIN_VOICE_MS = 60;

/** Mẫu PCM 16-bit của WAV (mono hoặc lấy kênh đầu). */
function pcm(wav: Uint8Array): { samples: Int16Array; sampleRate: number } {
  const info = parseWav(wav);
  if (info.bitsPerSample !== 16) throw new Error(`Chỉ hỗ trợ WAV 16-bit (nhận ${info.bitsPerSample}-bit)`);
  const dataStart = wav.byteLength - info.dataBytes;
  const dv = new DataView(wav.buffer, wav.byteOffset + dataStart, info.dataBytes);
  const n = Math.floor(info.dataBytes / 2 / info.channels);
  const samples = new Int16Array(n);
  for (let i = 0; i < n; i++) samples[i] = dv.getInt16(i * 2 * info.channels, true);
  return { samples, sampleRate: info.sampleRate };
}

/** Các đoạn có tiếng trong WAV. Ngưỡng tương đối theo độ to của chính bản ghi (không phụ thuộc âm lượng tuyệt đối). */
export function voiceRegions(wav: Uint8Array): VoiceRegion[] {
  const { samples, sampleRate } = pcm(wav);
  const step = Math.max(1, Math.round((sampleRate * FRAME_MS) / 1000));
  const rms: number[] = [];
  for (let i = 0; i < samples.length; i += step) {
    let s = 0;
    const end = Math.min(samples.length, i + step);
    for (let j = i; j < end; j++) s += samples[j]! * samples[j]!;
    rms.push(Math.sqrt(s / Math.max(1, end - i)));
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const loud = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  if (loud < 50) return []; // im lặng hoàn toàn (WAV thử)
  const floor = sorted[Math.floor(sorted.length * 0.1)] ?? 0;
  const thr = Math.max(floor * 2, loud * 0.06);
  const regions: VoiceRegion[] = [];
  let start = -1;
  let lastVoice = -1;
  rms.forEach((v, i) => {
    if (v >= thr) {
      if (start < 0) start = i;
      else if ((i - lastVoice - 1) * FRAME_MS >= MIN_PAUSE_MS) {
        regions.push({ startMs: start * FRAME_MS, endMs: (lastVoice + 1) * FRAME_MS });
        start = i;
      }
      lastVoice = i;
    }
  });
  if (start >= 0) regions.push({ startMs: start * FRAME_MS, endMs: (lastVoice + 1) * FRAME_MS });
  return regions.filter((r) => r.endMs - r.startMs >= MIN_VOICE_MS);
}

/** Trọng số thời gian đọc của một từ (số ký tự, không tính dấu câu). */
const weight = (w: string) => [...w.replace(/[\s、。，．,.!?！？「」『』（）()…:：;；]/gu, '')].length || 1;
/** Mức ưu tiên đặt chỗ ngừng sau từ này. */
const breakBonus = (w: string) => (/[.!?。！？]$/u.test(w.trim()) ? 1 : /[,，、;；:：…]$/u.test(w.trim()) ? 0.6 : 0);

/**
 * Gán mốc cho từng từ theo các đoạn có tiếng.
 * 1) Ghép các đoạn có tiếng thành một trục "chỉ có tiếng"; vị trí ranh giới từ trên trục này tỉ lệ với độ dài chữ.
 * 2) Mỗi chỗ ngừng chọn một ranh giới từ để neo vào: gần vị trí dự kiến nhất, ưu tiên ranh giới có dấu câu, giữ thứ tự.
 * 3) Các từ giữa hai neo được chia đều theo độ dài chữ trong đúng đoạn có tiếng của chúng.
 */
export function alignWords(words: string[], regions: VoiceRegion[], strongBreaks: ReadonlySet<number> = new Set()): TimedWord[] {
  if (!words.length || !regions.length) return [];
  const ws = words.map(weight);
  const total = ws.reduce((a, b) => a + b, 0);
  const voiced = regions.reduce((a, r) => a + (r.endMs - r.startMs), 0);
  // cum[k] = phần trục có tiếng (0..1) ở ranh giới trước từ k; cum[words.length] = 1
  const cum = [0];
  for (const w of ws) cum.push(cum.at(-1)! + w / total);
  // vị trí (0..1) của từng chỗ ngừng trên trục có tiếng
  const pauseAt: number[] = [];
  let acc = 0;
  for (let i = 0; i < regions.length - 1; i++) {
    acc += regions[i]!.endMs - regions[i]!.startMs;
    pauseAt.push(acc / voiced);
  }
  // Neo tham lam theo thứ tự: ranh giới k ∈ (neo trước, cần chừa đủ từ cho các chỗ ngừng còn lại).
  const anchors: number[] = []; // anchors[p] = chỉ số ranh giới (1..n-1) gắn với chỗ ngừng p
  let lo = 1;
  for (let p = 0; p < pauseAt.length; p++) {
    const hi = words.length - (pauseAt.length - p);
    if (lo > hi) {
      anchors.push(-1); // nhiều chỗ ngừng hơn số từ: bỏ chỗ ngừng này
      continue;
    }
    let best = lo;
    let bestScore = Infinity;
    for (let k = lo; k <= hi; k++) {
      // Ranh giới "mạnh" (giữa hai cảnh khi đọc liền cả video) được ưu tiên hơn hẳn dấu câu thường.
      const score = Math.abs(cum[k]! - pauseAt[p]!) - 0.06 * breakBonus(words[k - 1]!) - (strongBreaks.has(k) ? 0.12 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = k;
      }
    }
    anchors.push(best);
    lo = best + 1;
  }
  // Ghép các đoạn có tiếng theo neo: chỗ ngừng bị bỏ thì hai đoạn kề nhau được nối (từ trải qua khoảng lặng ngắn).
  const groups: { from: number; to: number; startMs: number; endMs: number }[] = [];
  let fromWord = 0;
  let regStart = regions[0]!.startMs;
  for (let p = 0; p < anchors.length; p++) {
    if (anchors[p]! < 0) continue;
    groups.push({ from: fromWord, to: anchors[p]!, startMs: regStart, endMs: regions[p]!.endMs });
    fromWord = anchors[p]!;
    regStart = regions[p + 1]!.startMs;
  }
  groups.push({ from: fromWord, to: words.length, startMs: regStart, endMs: regions.at(-1)!.endMs });

  const out: TimedWord[] = [];
  for (const g of groups) {
    const gw = ws.slice(g.from, g.to);
    const gt = gw.reduce((a, b) => a + b, 0) || 1;
    let t = g.startMs;
    for (let i = g.from; i < g.to; i++) {
      const d = ((ws[i] ?? 1) / gt) * (g.endMs - g.startMs);
      out.push({ text: words[i]!, startMs: Math.round(t), endMs: Math.round(t + d) });
      t += d;
    }
  }
  return out;
}
