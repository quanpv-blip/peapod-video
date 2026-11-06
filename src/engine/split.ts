// Cắt MỘT tệp lời đọc của cả video thành từng cảnh. Lý do: gọi TTS một lần cho cả video thay vì mỗi cảnh một lần
// (hạn mức Gemini miễn phí rất thấp, và đọc liền một mạch cho ngữ điệu tự nhiên hơn).
// Cách làm: căn toàn bộ từ của mọi cảnh theo khoảng lặng (align.ts), ưu tiên neo chỗ ngừng vào ranh giới giữa hai cảnh,
// rồi cắt ở giữa khoảng lặng nằm giữa từ cuối cảnh trước và từ đầu cảnh sau. Thuần, chạy ở Node.
import { alignWords, voiceRegions } from './align.ts';
import { parseWav } from './wav.ts';

export interface SplitResult {
  /** WAV của từng cảnh theo id, cùng định dạng với tệp gốc. */
  wavs: Record<string, Uint8Array>;
  /** Cảnh có ranh giới không rơi vào khoảng lặng rõ ràng (có thể bị cắt giữa từ): nên nghe lại. */
  weakCuts: string[];
}

/** Khoảng lặng ngắn nhất ở chỗ cắt để coi là cắt sạch (ms). */
const CLEAN_GAP_MS = 120;

function wavSlice(wav: Uint8Array, startMs: number, endMs: number): Uint8Array {
  const info = parseWav(wav);
  const block = info.channels * (info.bitsPerSample / 8);
  const dataStart = wav.byteLength - info.dataBytes;
  const at = (ms: number) => Math.min(info.dataBytes, Math.max(0, Math.round((ms / 1000) * info.sampleRate) * block));
  const a = at(startMs);
  const b = Math.max(a + block, at(endMs));
  const data = wav.subarray(dataStart + a, dataStart + b);
  const out = new Uint8Array(44 + data.byteLength);
  const dv = new DataView(out.buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); dv.setUint32(4, 36 + data.byteLength, true); w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, info.channels, true); dv.setUint32(24, info.sampleRate, true);
  dv.setUint32(28, info.sampleRate * block, true); dv.setUint16(32, block, true); dv.setUint16(34, info.bitsPerSample, true);
  w(36, 'data'); dv.setUint32(40, data.byteLength, true);
  out.set(data, 44);
  return out;
}

/**
 * `scenes`: các cảnh có lời đọc theo đúng thứ tự đọc, mỗi cảnh là danh sách từ hiển thị (prepare.sceneWords).
 * Đệm 80 ms quanh mỗi cảnh để không cụt âm đầu/cuối.
 */
export function splitNarration(wav: Uint8Array, scenes: { id: string; words: string[] }[]): SplitResult {
  const regions = voiceRegions(wav);
  if (!regions.length) throw new Error('Tệp lời đọc không có tiếng');
  const all = scenes.flatMap((s) => s.words);
  const strong = new Set<number>();
  let k = 0;
  for (const s of scenes.slice(0, -1)) {
    k += s.words.length;
    strong.add(k);
  }
  const timed = alignWords(all, regions, strong);
  const totalMs = parseWav(wav).durationSec * 1000;
  const wavs: Record<string, Uint8Array> = {};
  const weakCuts: string[] = [];
  let idx = 0;
  let cutStart = 0;
  scenes.forEach((s, i) => {
    const first = timed[idx]!;
    const last = timed[idx + s.words.length - 1]!;
    idx += s.words.length;
    let cutEnd = totalMs;
    if (i < scenes.length - 1) {
      const next = timed[idx]!;
      const gap = next.startMs - last.endMs;
      if (gap < CLEAN_GAP_MS) weakCuts.push(s.id);
      cutEnd = (last.endMs + next.startMs) / 2;
    }
    const from = Math.max(cutStart, first.startMs - 80);
    const to = Math.min(cutEnd, last.endMs + 80);
    wavs[s.id] = wavSlice(wav, from, to);
    cutStart = cutEnd;
  });
  return { wavs, weakCuts };
}
