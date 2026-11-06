import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatIssues, validateSpec, displayWidth } from '../src/spec/validate.ts';

const load = (n: string) => JSON.parse(readFileSync(new URL(`../samples/${n}.json`, import.meta.url), 'utf8'));
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const byId = (s: { scenes: { id: string }[] }, id: string) => s.scenes.find((x) => x.id === id) as Record<string, unknown> & { narration: { text: string } };
const codes = (r: ReturnType<typeof validateSpec>, level: 'error' | 'warn' = 'error') => r.issues.filter((i) => i.level === level).map((i) => i.code);

describe('mẫu đầu vào thật đạt kiểm tra', () => {
  for (const name of ['spec-vn-freezers', 'spec-jp-arara']) {
    it(`${name}: không có lỗi`, () => {
      const r = validateSpec(load(name));
      expect(formatIssues(r.issues.filter((i) => i.level === 'error'))).toBe('Không có vấn đề.');
      expect(r.ok).toBe(true);
      expect(r.estimatedSeconds).toBeGreaterThanOrEqual(r.spec!.qa.minSeconds);
      expect(r.estimatedSeconds).toBeLessThanOrEqual(r.spec!.qa.maxSeconds);
    });
  }
  it('điền đủ mặc định: vùng an toàn, giới hạn kiểm tra, chuyển cảnh', () => {
    const r = validateSpec(load('spec-vn-freezers'));
    expect(r.spec!.safeArea).toEqual({ top: 210, bottom: 320, left: 60, right: 120 });
    expect(r.spec!.qa).toMatchObject({ minSeconds: 30, maxSeconds: 60 });
    expect(r.spec!.transition.type).toBe('blur');
    expect(r.spec!.captions.style).toBe('karaoke');
    expect(r.spec!.facts.find((f) => f.id === 'f-temp50')).toMatchObject({ approx: false });
  });
});

describe('chứng cứ và con số', () => {
  it('số trong fact không có nguyên văn trong câu trích thì lỗi', () => {
    const s = load('spec-vn-freezers');
    s.facts[1].raw = '60 độ C';
    expect(codes(validateSpec(s))).toContain('evidence-raw');
  });
  it('giá trị không khớp với đoạn raw thì lỗi (338万6187 phải là 3386187)', () => {
    const s = load('spec-jp-arara');
    s.facts.find((f: { id: string }) => f.id === 'f-338').value = 6187;
    const r = validateSpec(s);
    expect(codes(r)).toContain('number-mismatch');
  });
  it('số trong chữ hiển thị mà không có fact (≥ 100) thì lỗi', () => {
    const s = load('spec-vn-freezers');
    s.scenes[0].headline = 'Hack 3000 tủ đông ở châu Âu';
    expect(codes(validateSpec(s))).toContain('number-no-evidence');
  });
  it('ngày tháng tiếng Nhật không bị coi là số liệu', () => {
    const s = load('spec-jp-arara');
    s.scenes[1].narration.text = '10月29日の発表では約301万件でした。';
    expect(codes(validateSpec(s), 'error')).not.toContain('number-no-evidence');
  });
  it('cảnh stat dùng fact không phải dạng number thì lỗi', () => {
    const s = load('spec-vn-freezers');
    byId(s, 's-temp').factId = 'f-quote';
    expect(codes(validateSpec(s))).toContain('fact-kind');
  });
  it('tham chiếu fact không tồn tại thì lỗi', () => {
    const s = load('spec-vn-freezers');
    byId(s, 's-temp').factId = 'khong-co';
    expect(codes(validateSpec(s))).toContain('missing-fact');
  });
  it('cụm nhấn không có trong lời trích thì lỗi', () => {
    const s = load('spec-vn-freezers');
    byId(s, 's-quote').highlight = ['cụm bịa ra'];
    expect(codes(validateSpec(s))).toContain('highlight');
  });
  it('biểu đồ trộn đơn vị thì lỗi; so sánh trộn đơn vị chỉ cảnh báo', () => {
    const s = load('spec-vn-freezers');
    s.scenes.splice(2, 0, { id: 's-chart', kind: 'chart', title: 'So sánh', type: 'bar', series: [{ factId: 'f-temp50', label: 'Nhiệt' }, { factId: 'f-loss', label: 'Thiệt hại' }] });
    expect(codes(validateSpec(s))).toContain('mixed-units');
    const t = load('spec-vn-freezers');
    t.scenes.splice(2, 0, { id: 's-cmp', kind: 'compare', title: 'So sánh', items: [{ factId: 'f-temp50', label: 'Nhiệt' }, { factId: 'f-loss', label: 'Thiệt hại' }] });
    expect(codes(validateSpec(t), 'warn')).toContain('mixed-units');
    expect(codes(validateSpec(t), 'error')).not.toContain('mixed-units');
  });
});

describe('cấu trúc kể chuyện và quy chuẩn', () => {
  it('thiếu cảnh nguồn thì lỗi', () => {
    const s = load('spec-vn-freezers');
    s.scenes = s.scenes.filter((x: { kind: string }) => x.kind !== 'source');
    expect(codes(validateSpec(s))).toContain('no-source');
  });
  it('cảnh đầu không phải hook thì lỗi', () => {
    const s = load('spec-vn-freezers');
    [s.scenes[0], s.scenes[1]] = [s.scenes[1], s.scenes[0]];
    expect(codes(validateSpec(s))).toContain('first-scene');
  });
  it('thị trường và ngôn ngữ không khớp thì lỗi', () => {
    const s = load('spec-vn-freezers');
    s.language = 'ja';
    expect(codes(validateSpec(s))).toContain('lang');
  });
  it('id trùng thì lỗi', () => {
    const s = load('spec-vn-freezers');
    s.scenes[1].id = s.scenes[0].id;
    expect(codes(validateSpec(s))).toContain('dup-id');
  });
  it('chữ quá dài: tiếng Nhật tính 2 đơn vị mỗi ký tự', () => {
    expect(displayWidth('abc')).toBe(3);
    expect(displayWidth('流出')).toBe(4);
    const s = load('spec-jp-arara');
    s.scenes[0].headline = 'アララの情報流出が拡大し最大で七千七百万件のメールアドレスが流出した';
    expect(codes(validateSpec(s))).toContain('text-too-long');
  });
  it('quá dài so với giới hạn thì lỗi', () => {
    const s = load('spec-vn-freezers');
    s.qa = { maxSeconds: 12 };
    expect(codes(validateSpec(s))).toContain('too-long');
  });
  it('lỗi cấu trúc được báo kèm đường dẫn', () => {
    const s = load('spec-vn-freezers');
    delete s.scenes[0].headline;
    const r = validateSpec(s);
    expect(r.ok).toBe(false);
    expect(r.issues[0]!.code).toBe('schema');
    expect(r.issues[0]!.path).toContain('scenes[0]');
  });
  it('trường lạ bị từ chối (strict)', () => {
    const s = load('spec-vn-freezers');
    s.scenes[0].mauSac = 'do';
    expect(validateSpec(s).ok).toBe(false);
  });
});

describe('tư liệu và giấy phép', () => {
  const withPhoto = (license: object, aiGenerated = false, origin = 'stock') => {
    const s = clone(load('spec-vn-freezers'));
    s.assets = [{ id: 'img-1', type: 'image', origin, src: 'https://images.pexels.com/photos/1/x.jpg', aiGenerated, license }];
    s.scenes.splice(2, 0, { id: 's-photo', kind: 'photo', assetId: 'img-1' });
    s.qa = { maxSeconds: 90 }; // test này chỉ kiểm giấy phép, không kiểm thời lượng
    return s;
  };
  it('ảnh có giấy phép thương mại thì đạt', () => {
    expect(validateSpec(withPhoto({ name: 'Pexels License', commercialUse: true })).ok).toBe(true);
  });
  it('ảnh không được dùng thương mại thì lỗi', () => {
    expect(codes(validateSpec(withPhoto({ name: 'CC BY-NC', commercialUse: false })))).toContain('license');
  });
  it('giấy phép bắt ghi nguồn mà thiếu chữ ghi nguồn thì lỗi', () => {
    expect(codes(validateSpec(withPhoto({ name: 'CC BY', commercialUse: true, attributionRequired: true })))).toContain('attribution');
  });
  it('ảnh AI phải gắn cờ aiGenerated', () => {
    expect(codes(validateSpec(withPhoto({ name: 'Gemini', commercialUse: true }, false, 'ai')))).toContain('ai-flag');
    expect(validateSpec(withPhoto({ name: 'Gemini', commercialUse: true }, true, 'ai')).ok).toBe(true);
  });
  it('cảnh photo trỏ tư liệu không tồn tại thì lỗi', () => {
    const s = load('spec-vn-freezers');
    s.scenes.splice(2, 0, { id: 's-photo', kind: 'photo', assetId: 'khong-co' });
    expect(codes(validateSpec(s))).toContain('missing-asset');
  });
});
