import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { stripBeats } from '../src/spec/beats.ts';
import { compileStoryboard, narrationOf, storyboardIssues, storyIndexMap, storyNarration, StoryboardSchema, storyPath, toStoryIssue, zodMessage } from '../src/spec/storyboard.ts';
import { validateSpec } from '../src/spec/validate.ts';

const sb = StoryboardSchema.parse(JSON.parse(readFileSync(new URL('../samples/storyboard-vn-freezers.json', import.meta.url), 'utf8')));
const source = { outlet: 'VnExpress (dẫn Reuters)', title: 'Hacker tăng nhiệt tủ lạnh đến 50 độ C tại hàng loạt siêu thị châu Âu', url: 'https://vnexpress.net/hacker-tang-nhiet-tu-lanh-den-50-do-c-tai-hang-loat-sieu-thi-chau-au-5139939.html', publishedAt: '2026-11-03' };

describe('storyboard → VideoSpec', () => {
  const spec = compileStoryboard(sb, { id: 'p12-r1', market: 'VN', source, incident: true });
  const v = validateSpec(spec);
  it('VideoSpec qua được kiểm tra đầy đủ (không lỗi)', () => {
    expect(v.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(v.ok).toBe(true);
  });
  it('luôn có thẻ nguồn ngay trước câu hỏi cuối', () => {
    const kinds = spec.scenes.map((s) => s.kind);
    expect(kinds.at(-2)).toBe('source');
    expect(kinds.at(-1)).toBe('cta');
  });
  it('đánh số chương và thêm dấu nhịp khi số đoạn khớp số mục', () => {
    const cards = spec.scenes.find((s) => s.kind === 'cards')!;
    expect(cards.eyebrow).toBe('01 — SỐ LIỆU');
    expect((cards.narration!.text.match(/\|/g) ?? []).length).toBe(2);
  });
  it('lời đọc gửi TTS khớp đúng lời đọc trong VideoSpec (bỏ dấu nhịp)', () => {
    const fromSpec = spec.scenes.filter((s) => s.narration).map((s) => stripBeats(s.narration!.text));
    expect(storyNarration(sb, 'vi')).toEqual(fromSpec);
  });
  it('số đoạn không khớp số mục thì không thêm dấu nhịp', () => {
    expect(narrationOf(['a', 'b'], 4, 'vi')).toBe('a b');
    expect(narrationOf(['a', 'b', 'c'], 2, 'vi')).toBe('a | b | c');
  });
});

describe('storyboard: lỗi AI hay mắc (tái hiện lỗi "scenes[1].points: Too small")', () => {
  const opts = { id: 'p27-r1', market: 'VN' as const, source };
  const mk = (scenes: unknown[], facts: unknown[] = []) => StoryboardSchema.parse({ facts, scenes });
  const hook = { type: 'hook', headline: 'Tủ đông bị hack', say: ['Tủ đông bị hack.'] };
  const cta = { type: 'cta', question: 'Bạn nghĩ sao?', say: ['Bạn nghĩ sao?'] };

  it('alert có chữ ở "label" thay vì "text": bộ chuyển vẫn nhận, không ra danh sách rỗng', () => {
    const sb = mk([hook, { type: 'alert', title: 'Cảnh báo', items: [{ label: 'Chưa ai nhận trách nhiệm' }], say: ['Chưa ai nhận trách nhiệm.'] }, { type: 'recap', items: [{ text: 'Một' }, { text: 'Hai' }], say: ['Một.', 'Hai.'] }, cta]);
    expect(storyboardIssues(sb).filter((i) => i.level === 'error')).toEqual([]);
    const spec = compileStoryboard(sb, opts);
    expect((spec.scenes[1] as { points: string[] }).points).toEqual(['Chưa ai nhận trách nhiệm']);
    expect(validateSpec(spec).issues.filter((i) => i.level === 'error' && /points/.test(i.path))).toEqual([]);
  });

  it('alert không có mục nào: báo bằng tên trường storyboard, nói rõ cần gì', () => {
    const sb = mk([hook, { type: 'alert', title: 'Cảnh báo', say: ['Có cảnh báo.'] }, { type: 'recap', items: [{ text: 'Một' }, { text: 'Hai' }], say: ['Một.', 'Hai.'] }, cta]);
    const e = storyboardIssues(sb).find((i) => i.path === 'scenes[1].items')!;
    expect(e.message).toMatch(/alert cần 1–3 mục/);
    expect(e.message).toMatch(/items \{text\}/);
  });

  it('mục rỗng bị bỏ, không thành dòng trống; đếm theo mục hợp lệ', () => {
    const sb = mk([hook, { type: 'checklist', items: [{ text: 'A' }, { text: '' }, { text: 'B' }, { text: 'C' }], say: ['Dẫn.', 'A.', 'B.', 'C.'] }, cta]);
    const spec = compileStoryboard(sb, opts);
    expect((spec.scenes[1] as { items: unknown[] }).items).toHaveLength(3);
    expect(storyboardIssues(sb).filter((i) => i.level === 'error')).toEqual([]);
    expect(storyboardIssues(sb).some((i) => i.level === 'warn' && i.path === 'scenes[1].items[1].text')).toBe(true);
  });

  it('factId không có trong facts, stat thiếu factId, cards thiếu factId: đều bị bắt trước khi dựng', () => {
    const sb = mk([hook, { type: 'stat', factId: 'f-x', label: 'x', say: ['x'] }, { type: 'stat', label: 'y', say: ['y'] }, { type: 'cards', items: [{ label: 'a' }, { label: 'b' }], say: ['a', 'b'] }, cta]);
    const paths = storyboardIssues(sb).filter((i) => i.level === 'error').map((i) => i.path);
    expect(paths).toContain('scenes[1].factId');
    expect(paths).toContain('scenes[2].factId');
    expect(paths).toContain('scenes[3].items[0].factId');
    expect(paths).toContain('scenes[3].items');
  });

  it('cảnh đầu không phải hook, hai cảnh cta: bị bắt; lời đọc rỗng bị lược đồ chặn từ đầu', () => {
    const sb = mk([{ type: 'recap', items: [{ text: 'a' }, { text: 'b' }], say: ['a', 'b'] }, cta, cta]);
    const msgs = storyboardIssues(sb).map((i) => i.message).join('\n');
    expect(msgs).toMatch(/Cảnh đầu tiên phải là "hook"/);
    expect(msgs).toMatch(/Chỉ được một cảnh "cta"/);
    const r = StoryboardSchema.safeParse({ scenes: [hook, { type: 'recap', items: [{ text: 'a' }, { text: 'b' }], say: [' '] }, cta] });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.path.join('.')).toBe('scenes.1.say.0');
  });

  it('lỗi VideoSpec được dịch về đúng cảnh storyboard (cta ở giữa bị dời xuống cuối, thẻ nguồn được chèn)', () => {
    const sb = mk([hook, cta, { type: 'bullets', title: 'T', items: [{ text: 'a' }, { text: 'b' }], say: ['a', 'b'] }]);
    const map = storyIndexMap(sb);
    // VideoSpec: [hook, bullets, source, cta]
    expect(map).toEqual([0, 2, -1, 1]);
    expect(toStoryIssue({ path: 'scenes[1].points', message: 'x' }, map, sb).path).toBe('scenes[2].items');
    expect(toStoryIssue({ path: 'scenes[3].question', message: 'x' }, map, sb).path).toBe('scenes[1].question');
    expect(toStoryIssue({ path: 'scenes[1].narration.text', message: 'x' }, map, sb).path).toBe('scenes[2].say');
    expect(toStoryIssue({ path: 'scenes[1].heading.title', message: 'x' }, map, sb).path).toBe('scenes[2].chapter.title');
    expect(toStoryIssue({ path: 'scenes[1].points', message: 'quá ít' }, map, sb).message).toBe('(cảnh bullets) quá ít');
  });

  it('mẫu chuẩn: không có lỗi cấu trúc', () => {
    expect(storyboardIssues(sb).filter((i) => i.level === 'error')).toEqual([]);
  });
});


describe('lỗi cấu trúc storyboard được dịch sang tiếng Việt, kèm giá trị hiện tại', () => {
  const tr = (input: unknown) => {
    const r = StoryboardSchema.safeParse(input);
    if (r.success) return [];
    return r.error.issues.map((i) => `${storyPath(i.path)}: ${zodMessage(i, input)}`);
  };
  const hook = { type: 'hook', headline: 'H', say: ['h'] };
  it('tiêu đề quá dài (đúng lỗi gặp ở bài #27): nói độ dài hiện tại và tối đa', () => {
    const long = 'Cảnh báo về an ninh mạng cho các chuỗi bán lẻ ở châu Âu';
    const m = tr({ scenes: [hook, hook, { type: 'alert', title: long, items: [{ text: 'x' }], say: ['x'] }] });
    expect(m[0]).toMatch(/^scenes\[2\]\.title: dài \d+ ký tự, tối đa 48/);
  });
  it('loại cảnh sai, thiếu lời đọc, thừa trường: đều có câu tiếng Việt', () => {
    const m = tr({ scenes: [hook, { type: 'quote', say: ['x'] }, { type: 'recap', items: [{ text: 'a' }] }, { type: 'cta', say: ['x'], foo: 1 }] }).join('\n');
    expect(m).toMatch(/scenes\[1\]\.type: giá trị "quote" không hợp lệ; chỉ nhận: hook/);
    expect(m).toMatch(/scenes\[2\]\.say: thiếu trường bắt buộc/);
    expect(m).toMatch(/có trường không dùng: foo/);
  });
});

describe('thẻ nguồn: ngày hiển thị', () => {
  it('ISO → 03/11/2026 (vi), 2026年11月3日 (ja); chuỗi khác giữ nguyên', async () => {
    const { displayDate } = await import('../src/engine/scenes/text.tsx');
    expect(displayDate('2026-11-03', 'vi')).toBe('03/11/2026');
    expect(displayDate('2026-11-03', 'ja')).toBe('2026年11月3日');
    expect(displayDate('2/11', 'vi')).toBe('2/11');
  });
});
