// Phụ đề karaoke: tách lời đọc thành "từ hiển thị", gán mốc thời gian, chia trang. Thuần, chạy được ở Node và trong composition.
// Định dạng mỗi từ theo kiểu Caption của @remotion/captions để sau này thay bằng mốc thật (Whisper/ElevenLabs) mà không đổi giao diện.
import type { Caption } from '@remotion/captions';
import type { Lang } from '../spec/numbers.ts';

/** Một từ hiển thị: text có thể kèm dấu cách đứng trước (quy ước của @remotion/captions). */
export type Token = Caption;

export interface CaptionPage {
  startMs: number;
  endMs: number;
  tokens: Token[];
}

const JA_PARTICLES = new Set(['は', 'が', 'を', 'に', 'で', 'と', 'も', 'の', 'へ', 'や', 'か', 'から', 'まで', 'より', 'て', 'た', 'だ', 'です', 'ます', 'した', 'する', 'され', 'れ', 'い', 'な', 'ね', 'よ']);
const PUNCT = /^[\s、。，．,.!?！？「」『』（）()・:：;；…ー〜-]+$/u;

/** Tách lời đọc thành từ hiển thị. Tiếng Việt: theo dấu cách. Tiếng Nhật: theo Intl.Segmenter, gộp trợ từ và dấu câu vào từ trước. */
export function tokenize(text: string, lang: Lang): string[] {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return [];
  if (lang === 'vi') return t.split(' ');
  const seg = new Intl.Segmenter('ja', { granularity: 'word' });
  const out: string[] = [];
  for (const { segment } of seg.segment(t)) {
    if (!segment.trim()) continue;
    const glue = out.length > 0 && (PUNCT.test(segment) || JA_PARTICLES.has(segment) || /^[぀-ゟ]{1,2}$/u.test(segment));
    if (glue) out[out.length - 1] += segment;
    else out.push(segment);
  }
  // 1) Số không được tách: "338万" + "6187件" → "338万6187件"; "1,234" giữ liền.
  const nums: string[] = [];
  for (const w of out) {
    const prev = nums.at(-1);
    if (prev && /[\d万億兆,.]$/u.test(prev) && /^[\d,.万億兆]/u.test(w)) nums[nums.length - 1] = prev + w;
    // đơn vị đếm đi liền số: "338万6187" + "件に" → "338万6187件に"
    else if (prev && /[\d万億兆]$/u.test(prev) && /^(件|社|台|通|人|名|円|万円|億円|ドル|倍|回|年|月|日|時間|分|秒|%|％)/u.test(w)) nums[nums.length - 1] = prev + w;
    else nums.push(w);
  }
  // 2) Tiền tố chỉ mức (約, 最大, およそ...) đi với số ĐỨNG SAU, không dính vào từ trước.
  const pre: string[] = [];
  for (let i = 0; i < nums.length; i++) {
    const w = nums[i]!;
    if (/^(約|最大|最大約|およそ|ほぼ|少なくとも)$/u.test(w) && nums[i + 1]) {
      nums[i + 1] = w + nums[i + 1]!;
      continue;
    }
    pre.push(w);
  }
  // 3) Gộp các từ một ký tự đứng riêng vào từ trước để phụ đề không nhảy từng chữ.
  const merged: string[] = [];
  for (const w of pre) {
    if (merged.length && [...w].length === 1 && !PUNCT.test(w)) merged[merged.length - 1] += w;
    else merged.push(w);
  }
  return merged;
}

/** Trọng số thời gian của một từ: số ký tự, cộng khoảng nghỉ sau dấu câu. */
function weight(word: string): number {
  const chars = [...word.replace(/[\s、。，．,.!?！？「」『』（）()]/gu, '')].length || 1;
  const pause = /[.!?。！？]$/u.test(word) ? 6 : /[,，、;；:：]$/u.test(word) ? 3 : 0;
  return chars + pause;
}

/**
 * Mốc ước lượng cho từng từ trong khoảng [startMs, startMs + durationMs]: chia theo độ dài chữ và dấu câu.
 * Kém chính xác hơn mốc thật (lệch vài trăm ms); đủ cho karaoke khi chưa có căn chỉnh âm thanh.
 */
export function estimateTokens(words: string[], startMs: number, durationMs: number, lang: Lang): Token[] {
  if (!words.length || durationMs <= 0) return [];
  const ws = words.map(weight);
  const total = ws.reduce((a, b) => a + b, 0);
  let t = startMs;
  return words.map((w, i) => {
    const d = (ws[i]! / total) * durationMs;
    const tok: Token = { text: lang === 'vi' && i > 0 ? ` ${w}` : w, startMs: Math.round(t), endMs: Math.round(t + d), timestampMs: Math.round(t + d / 2), confidence: null };
    t += d;
    return tok;
  });
}

/** Độ rộng hiển thị (Latin 1, toàn góc 2). */
const width = (s: string) => [...s.trim()].reduce((a, ch) => a + (/[⺀-꓏＀-｠]/u.test(ch) ? 2 : 1), 0);

/** Khoảng lặng (ms) giữa hai từ đủ dài để sang trang mới; chỉ có tác dụng khi mốc là mốc thật từ TTS. */
export const PAGE_SILENCE_MS = 400;
/** Trang ngắn hơn mức này bị gộp vào trang trước (mắt không kịp đọc). */
export const MIN_PAGE_MS = 300;

const END_SENTENCE = /[.!?。！？]$/u;
const SOFT_BREAK = /[,，、;；:：]$/u;
const pageWidth = (ts: Token[]) => ts.reduce((a, t) => a + width(t.text), 0);

/**
 * Chia trang (một dòng): tối đa `maxWords` từ và `maxWidth` đơn vị mỗi trang.
 * - Ngắt sau dấu kết câu và ở khoảng lặng ≥ PAGE_SILENCE_MS.
 * - Khi buộc phải ngắt vì đầy trang, lùi về dấu phẩy gần nhất trong trang nếu có, để không cắt giữa cụm.
 * - Không để trang chỉ một từ (từ mồ côi) khi trang trước còn chỗ hoặc mượn được một từ.
 * - Gộp trang ngắn hơn MIN_PAGE_MS vào trang trước nếu vừa chỗ.
 * Trang kéo dài tới khi trang sau bắt đầu (không để khoảng trống giữa hai trang trong cùng một cảnh).
 */
export function paginate(tokens: Token[], maxWords: number, maxWidth: number): CaptionPage[] {
  const groups: Token[][] = [];
  let cur: Token[] = [];
  const fits = (ts: Token[]) => ts.length <= maxWords && pageWidth(ts) <= maxWidth;
  for (const tok of tokens) {
    const prev = cur.at(-1);
    if (prev && tok.startMs - prev.endMs >= PAGE_SILENCE_MS) {
      groups.push(cur);
      cur = [];
    }
    if (cur.length && !fits([...cur, tok])) {
      // Lùi về dấu phẩy gần nhất (không lùi về đầu trang) để cụm sau dấu phẩy sang trang mới cùng từ đang xét.
      let cut = -1;
      for (let i = cur.length - 2; i >= 0; i--) if (SOFT_BREAK.test(cur[i]!.text.trim())) { cut = i; break; }
      if (cut >= 0 && fits([...cur.slice(cut + 1), tok])) {
        groups.push(cur.slice(0, cut + 1));
        cur = cur.slice(cut + 1);
      } else {
        groups.push(cur);
        cur = [];
      }
    }
    cur.push(tok);
    if (END_SENTENCE.test(tok.text.trim())) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);

  // Từ mồ côi: trang một từ (không kết câu ở trang trước) thì gộp lên nếu vừa, hoặc mượn từ cuối của trang trước.
  for (let i = 1; i < groups.length; i++) {
    const g = groups[i]!;
    const before = groups[i - 1]!;
    if (g.length !== 1 || END_SENTENCE.test(before.at(-1)!.text.trim())) continue;
    if (fits([...before, ...g])) {
      groups[i - 1] = [...before, ...g];
      groups.splice(i--, 1);
    } else if (before.length > 2 && fits([before.at(-1)!, ...g])) {
      groups[i] = [before.at(-1)!, ...g];
      groups[i - 1] = before.slice(0, -1);
    }
  }
  // Trang quá ngắn: gộp vào trang trước nếu vừa chỗ.
  for (let i = 1; i < groups.length; i++) {
    const g = groups[i]!;
    if (g.at(-1)!.endMs - g[0]!.startMs < MIN_PAGE_MS && fits([...groups[i - 1]!, ...g])) {
      groups[i - 1] = [...groups[i - 1]!, ...g];
      groups.splice(i--, 1);
    }
  }

  const pages = groups.map((ts) => ({ startMs: ts[0]!.startMs, endMs: ts.at(-1)!.endMs, tokens: ts }));
  for (let i = 0; i < pages.length - 1; i++) {
    // Không kéo trang qua khoảng lặng dài: phụ đề tắt khi người đọc nghỉ.
    const gap = pages[i + 1]!.startMs - pages[i]!.endMs;
    if (gap < PAGE_SILENCE_MS) pages[i]!.endMs = pages[i + 1]!.startMs;
  }
  return pages;
}

/** Ngân sách mặc định theo ngôn ngữ: tiếng Nhật ít từ hơn mỗi trang vì mỗi "từ" đã dài và chữ rộng gấp đôi. */
export function pageLimits(lang: Lang, maxWordsPerPage: number): { maxWords: number; maxWidth: number } {
  // Một dòng duy nhất (style bible §3): ~71% chiều rộng khung ở cỡ 54px ≈ 24 ký tự Latin, ≈ 13 ký tự Nhật.
  return lang === 'ja' ? { maxWords: Math.min(maxWordsPerPage, 3), maxWidth: 26 } : { maxWords: maxWordsPerPage, maxWidth: 24 };
}
