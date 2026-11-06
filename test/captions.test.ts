import { describe, expect, it } from 'vitest';
import { estimateTokens, pageLimits, paginate, tokenize } from '../src/engine/captions.ts';
import { beatStarts, estimateSegFractions, markCount, splitBeats, stripBeats } from '../src/spec/beats.ts';

describe('tách từ', () => {
  it('tiếng Việt theo dấu cách', () => {
    expect(tokenize('Tin tặc  vừa tăng nhiệt', 'vi')).toEqual(['Tin', 'tặc', 'vừa', 'tăng', 'nhiệt']);
  });
  it('tiếng Nhật: không tách giữa từ, trợ từ và dấu câu dính vào từ trước', () => {
    const w = tokenize('約7700万件のメールアドレスが流出した。', 'ja');
    expect(w.join('')).toBe('約7700万件のメールアドレスが流出した。');
    expect(w.every((x) => x !== 'の' && x !== 'が' && x !== '。')).toBe(true);
    expect(w.length).toBeGreaterThanOrEqual(3);
  });
  it('tiếng Nhật: không tách giữa số (338万6187件), tiền tố 約 đi với số đứng sau', () => {
    const w = tokenize('流出したメールアドレスが338万6187件に増えた。不正アクセスで、約7700万件が流出。', 'ja');
    expect(w.some((x) => x.includes('338万6187件'))).toBe(true);
    expect(w.some((x) => x.startsWith('約7700万件'))).toBe(true);
    expect(w.some((x) => /約$/u.test(x))).toBe(false);
  });
});

describe('mốc thời gian ước lượng', () => {
  it('phủ đúng khoảng, tăng dần, dấu chấm có khoảng nghỉ dài hơn', () => {
    const toks = estimateTokens(['Một', 'hai.', 'Ba'], 500, 3000, 'vi');
    expect(toks[0]!.startMs).toBe(500);
    expect(toks.at(-1)!.endMs).toBe(3500);
    expect(toks[1]!.text).toBe(' hai.');
    const d = toks.map((t) => t.endMs - t.startMs);
    expect(d[1]).toBeGreaterThan(d[2]!);
  });
  it('thời lượng 0 thì rỗng', () => {
    expect(estimateTokens(['a'], 0, 0, 'vi')).toEqual([]);
  });
});

describe('chia trang karaoke', () => {
  const toks = estimateTokens(tokenize('Cả một ê-kíp dựng video nằm gọn trong một repo GitHub. Mã nguồn mở.', 'vi'), 0, 6000, 'vi');
  const { maxWords, maxWidth } = pageLimits('vi', 4);
  const pages = paginate(toks, maxWords, maxWidth);
  it('không trang nào quá số từ, ngắt sau dấu chấm', () => {
    expect(pages.every((p) => p.tokens.length <= 4)).toBe(true);
    expect(pages.some((p) => p.tokens.at(-1)!.text.trim() === 'GitHub.')).toBe(true);
  });
  it('các trang nối liền nhau, không mất từ', () => {
    for (let i = 0; i < pages.length - 1; i++) expect(pages[i]!.endMs).toBe(pages[i + 1]!.startMs);
    expect(pages.flatMap((p) => p.tokens).length).toBe(toks.length);
  });

  // Mốc "thật" giả lập: mỗi từ 300 ms, có thể chèn khoảng lặng.
  const timed = (words: string[], gapAfter: Record<number, number> = {}) => {
    let t = 0;
    return words.map((w, i) => {
      const tok = { text: i ? ` ${w}` : w, startMs: t, endMs: t + 300, timestampMs: t + 150, confidence: null };
      t += 300 + (gapAfter[i] ?? 0);
      return tok;
    });
  };
  const texts = (ps: ReturnType<typeof paginate>) => ps.map((p) => p.tokens.map((t) => t.text.trim()).join(' '));

  it('ngắt ở khoảng lặng ≥ 400 ms, và phụ đề tắt trong lúc lặng', () => {
    const ps = paginate(timed(['Một', 'hai', 'ba', 'bốn'], { 1: 600 }), 5, 40);
    expect(texts(ps)).toEqual(['Một hai', 'ba bốn']);
    expect(ps[0]!.endMs).toBe(600);
  });
  it('đầy trang thì lùi về dấu phẩy gần nhất', () => {
    const ps = paginate(timed(['Hacker', 'vào', 'được,', 'rồi', 'tăng', 'nhiệt']), 4, 40);
    expect(texts(ps)).toEqual(['Hacker vào được,', 'rồi tăng nhiệt']);
  });
  it('không để từ mồ côi ở trang cuối', () => {
    const ps = paginate(timed(['một', 'hai', 'ba', 'bốn', 'năm']), 4, 40);
    expect(ps.every((p) => p.tokens.length >= 2)).toBe(true);
    expect(ps.flatMap((p) => p.tokens).length).toBe(5);
  });
});

describe('nhịp hình', () => {
  it('bỏ dấu | khi đọc và chia đoạn đúng', () => {
    const t = 'Mỗi video qua bảy khâu: | nghiên cứu, | đề xuất, | kịch bản.';
    expect(stripBeats(t)).toBe('Mỗi video qua bảy khâu: nghiên cứu, đề xuất, kịch bản.');
    expect(splitBeats(t)).toEqual(['Mỗi video qua bảy khâu:', 'nghiên cứu,', 'đề xuất,', 'kịch bản.']);
    expect(markCount(t)).toBe(3);
  });
  it('M = N-1: phần tử 0 hiện ngay; M = N: đoạn đầu là lời dẫn', () => {
    const f = estimateSegFractions(['a a a', 'b b', 'c c']);
    expect(beatStarts(3, f)).toEqual(f);
    expect(beatStarts(2, f)).toEqual(f.slice(1, 3));
    expect(f[0]).toBe(0);
    expect(f[1]).toBeGreaterThan(0);
  });
  it('không có mốc thì rải đều, tăng dần', () => {
    const s = beatStarts(4, [0]);
    expect(s.length).toBe(4);
    for (let i = 1; i < s.length; i++) expect(s[i]!).toBeGreaterThan(s[i - 1]!);
  });
});

describe('số viết bằng chữ trong lời đọc', () => {
  it('bắt "năm mươi", "mười lăm nghìn"; bỏ qua "430 triệu" vì đã có chữ số', async () => {
    const { spelledNumbers } = await import('../src/spec/beats.ts');
    expect(spelledNumbers('lên năm mươi độ C, thiệt hại mười lăm nghìn euro, tức 430 triệu đồng', 'vi')).toEqual(['năm mươi', 'mười lăm nghìn']);
    expect(spelledNumbers('約七千七百万件が流出、一部の企業', 'ja')).toEqual(['七千七百万']);
  });
});
