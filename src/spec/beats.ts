// Nhịp hình trong một cảnh: phần tử thứ i hiện ra khi đoạn lời đọc thứ i bắt đầu. Thuần, dùng chung cho kiểm tra và composition.
// Quy ước với N phần tử và M dấu "|" trong lời đọc:
//   M = 0      → không có mốc, phần tử chia đều thời lượng cảnh (bố cục tự quyết)
//   M = N - 1  → đoạn 0 gắn phần tử 0, đoạn i gắn phần tử i
//   M = N      → đoạn 0 là lời dẫn, phần tử i hiện ở đoạn i + 1
import type { Lang } from './numbers.ts';
import { BEAT_MARK, type Scene } from './schema.ts';

/**
 * Tốc độ đọc ước tính (ký tự mỗi giây) khi chưa có âm thanh thật. Theo số đo Gemini TTS ở E-35 (ba-team/docs/99):
 * VN ≈ 21, JP ≈ 5,8. ⚠️ Mỗi ngôn ngữ mới một mẫu đo; thời lượng thật luôn lấy từ âm thanh.
 */
export const READ_RATE: Record<Lang, number> = { vi: 21, ja: 5.8 };

/** Số viết bằng chữ trong lời đọc ("năm mươi", "七千七百万"): lọt qua kiểm tra chứng cứ nên bị cấm; TTS đọc chữ số tốt. */
const VI_DIGIT_WORDS = new Set(['không', 'một', 'mốt', 'hai', 'ba', 'bốn', 'tư', 'năm', 'lăm', 'sáu', 'bảy', 'tám', 'chín', 'mười', 'mươi', 'trăm', 'nghìn', 'ngàn', 'triệu', 'tỷ', 'tỉ', 'linh', 'lẻ']);
const VI_SCALE_WORDS = new Set(['mười', 'mươi', 'trăm', 'nghìn', 'ngàn', 'triệu', 'tỷ', 'tỉ']);

export function spelledNumbers(text: string, lang: Lang): string[] {
  if (lang === 'ja') return [...text.matchAll(/[〇一二三四五六七八九十]+[百千万億兆][〇一二三四五六七八九十百千万億兆]*/gu)].map((m) => m[0]);
  // Tiếng Việt: chuỗi ≥ 2 từ chỉ số liền nhau, có ít nhất một từ hàng (mươi, trăm, nghìn...), không đứng ngay sau chữ số
  // ("430 triệu" đã có chữ số nên hợp lệ). "năm" đứng một mình (năm = year) không bị bắt.
  const words = text.split(/(\s+|[,.;:!?()"“”])/u);
  const out: string[] = [];
  let run: string[] = [];
  let prevDigit = false;
  const flush = () => {
    if (run.length >= 2 && run.some((w) => VI_SCALE_WORDS.has(w.toLowerCase()))) out.push(run.join(' '));
    run = [];
  };
  for (const w of words) {
    if (!w.trim()) continue;
    if (VI_DIGIT_WORDS.has(w.toLowerCase()) && !(run.length === 0 && prevDigit)) run.push(w);
    else flush();
    prevDigit = /\d$/.test(w);
  }
  flush();
  return out;
}

/** Bỏ dấu nhịp, gộp khoảng trắng: đây là văn bản thật được đọc và hiện phụ đề. */
export function stripBeats(text: string): string {
  return text.split(BEAT_MARK).map((s) => s.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/** Các đoạn lời đọc theo dấu nhịp (đã cắt khoảng trắng, bỏ đoạn rỗng ở hai đầu). */
export function splitBeats(text: string): string[] {
  return text.split(BEAT_MARK).map((s) => s.replace(/\s+/g, ' ').trim()).filter((s, i, a) => s.length > 0 || (i > 0 && i < a.length - 1));
}

export function markCount(text: string): number {
  return splitBeats(text).length - 1;
}

/** Số phần tử hiện lần lượt của cảnh (0 nếu cảnh không có danh sách). */
export function beatTargets(s: Scene): number {
  switch (s.kind) {
    case 'cards': return s.items.length;
    case 'compare': return s.items.length;
    case 'timeline': return s.events.length;
    case 'chart': return s.series.length;
    case 'bullets': return s.items.length;
    case 'checklist': return s.items.length;
    case 'concept': return s.chips.length + 1; // các chip, rồi câu kết quả
    case 'process': return s.steps.length;
    case 'alert': return s.points.length;
    case 'recap': return s.items.length;
    default: return 0;
  }
}

/**
 * Thời điểm (0..1 trong cảnh) mỗi phần tử hiện ra. `segFractions` là thời điểm bắt đầu của từng đoạn lời đọc
 * (0..1, đoạn đầu = 0), lấy từ mốc âm thanh hoặc ước lượng theo độ dài chữ.
 */
export function beatStarts(targets: number, segFractions: number[], spreadUntil = 0.7): number[] {
  if (targets <= 0) return [];
  const marks = segFractions.length - 1;
  if (marks === targets - 1) return segFractions.slice(0, targets);
  if (marks === targets) return segFractions.slice(1, targets + 1);
  // không có mốc (hoặc sai số lượng, đã bị validate báo): rải đều trong phần đầu của cảnh
  return Array.from({ length: targets }, (_, i) => (targets === 1 ? 0.1 : 0.08 + (i * (spreadUntil - 0.08)) / (targets - 1)));
}

/** Ước lượng thời điểm bắt đầu từng đoạn theo độ dài chữ (khi chưa có mốc thật). */
export function estimateSegFractions(segments: string[]): number[] {
  const lens = segments.map((s) => [...s].length + 4); // +4: khoảng nghỉ giữa các đoạn
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  const out: number[] = [];
  let acc = 0;
  for (const l of lens) {
    out.push(acc / total);
    acc += l;
  }
  return out;
}
