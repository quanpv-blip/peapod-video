// Kịch bản phân cảnh (Storyboard): đầu vào GỌN cho "đạo diễn AI". AI chỉ lo nội dung (cảnh nào, chữ gì, số nào, câu trích nào,
// đọc gì); bộ chuyển `compileStoryboard` lo bố cục (id, tiêu đề chương, đánh số chương, dấu nhịp, thẻ nguồn, bảng màu) và cho ra
// một VideoSpec đầy đủ. Lý do: schema VideoSpec đầy đủ ~147 KB, quá lớn để AI sinh đúng ổn định; lược đồ này nhỏ, phẳng,
// hợp với chế độ JSON có lược đồ của Gemini. Mọi kiểm tra vẫn do validateSpec làm trên VideoSpec sau khi chuyển.
import { z } from 'zod';
import { beatTargets } from './beats.ts';
import { BEAT_MARK, ICONS, SPEC_VERSION, type Scene, type VideoSpecInput } from './schema.ts';

export const STORY_SCENE_TYPES = ['hook', 'stat', 'cards', 'compare', 'bullets', 'checklist', 'timeline', 'process', 'alert', 'recap', 'cta'] as const;
export type StorySceneType = (typeof STORY_SCENE_TYPES)[number];

const Short = (max: number) => z.string().trim().min(1).max(max);

export const StoryFactSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/).describe('Mã ngắn, chữ thường, ví dụ "f-stores".'),
    label: Short(60).describe('Con số đo cái gì.'),
    value: z.number().describe('Giá trị số đã quy đổi (338万6187 → 3386187; 3,5 tỷ → 3500000000).'),
    raw: Short(40).describe('Con số đúng như viết trong câu trích, ví dụ "15.000" hoặc "338万6187".'),
    unit: z.string().max(12).default('').describe('Đơn vị: cửa hàng, %, 件, 円...'),
    approx: z.boolean().default(false).describe('Bài dùng "khoảng", "hơn", "約"...'),
    quote: z.string().trim().min(6).max(600).describe('Câu NGUYÊN VĂN chép từ văn bản nguồn, chứa con số. Không diễn đạt lại, không dịch.'),
  })
  .strict();

export const StoryItemSchema = z
  .object({
    text: z.string().trim().max(72).optional().describe('Chữ của mục (bullets, checklist, recap, alert, process).'),
    factId: z.string().optional().describe('Mục là một con số (cards, compare): id của fact.'),
    label: z.string().trim().max(40).optional().describe('Nhãn ngắn của con số (cards, compare).'),
    when: z.string().trim().max(24).optional().describe('Mốc thời gian (timeline), ví dụ "29/10".'),
    detail: z.string().trim().max(72).optional().describe('Dòng phụ (process).'),
  })
  .strict();

export const StorySceneSchema = z
  .object({
    type: z.enum(STORY_SCENE_TYPES),
    chapter: z
      .object({ title: Short(32).describe('Dòng 1 tiêu đề chương.'), accent: z.string().trim().max(32).optional().describe('Dòng 2, màu nhấn.'), icon: z.enum(ICONS).optional() })
      .strict()
      .optional()
      .describe('Tiêu đề chương (không dùng cho hook, cta). Cảnh liền nhau cùng chương thì lặp lại y hệt.'),
    headline: z.string().trim().max(60).optional().describe('hook: câu mở gợi tò mò, không phóng đại.'),
    sub: z.string().trim().max(90).optional().describe('hook: dòng phụ.'),
    factId: z.string().optional().describe('stat: id fact con số.'),
    label: z.string().trim().max(48).optional().describe('stat: nhãn con số.'),
    context: z.string().trim().max(80).optional().describe('stat: một dòng ngữ cảnh.'),
    title: z.string().trim().max(48).optional().describe('Tiêu đề khối nội dung (bullets, compare, timeline, process, alert).'),
    items: z.array(StoryItemSchema).max(8).optional(),
    question: z.string().trim().max(90).optional().describe('cta: câu hỏi mở cho người xem bình luận.'),
    say: z
      .array(Short(200))
      .min(1)
      .max(9)
      .describe('Lời đọc của cảnh, chia đoạn. Cảnh có danh sách: một đoạn cho mỗi mục (mục i hiện khi đoạn i được đọc), có thể thêm một đoạn dẫn ở đầu.'),
  })
  .strict();

export const StoryboardSchema = z
  .object({
    facts: z.array(StoryFactSchema).max(16).default([]),
    scenes: z.array(StorySceneSchema).min(3).max(14),
  })
  .strict();

export type Storyboard = z.output<typeof StoryboardSchema>;
export type StoryScene = z.output<typeof StorySceneSchema>;

export interface CompileOptions {
  id: string;
  market: 'VN' | 'JP';
  source: { outlet: string; title: string; url: string; publishedAt?: string };
  /** Tin sự cố/bảo mật: dùng bảng màu đỏ. */
  incident?: boolean;
  minSeconds?: number;
  maxSeconds?: number;
}

const CHAPTER_WORD: Record<'vi' | 'ja', Partial<Record<StorySceneType, string>>> = {
  vi: { stat: 'CON SỐ', cards: 'SỐ LIỆU', compare: 'SO SÁNH', bullets: 'ĐIỂM CHÍNH', checklist: 'NÊN LÀM', timeline: 'DIỄN BIẾN', process: 'CƠ CHẾ', alert: 'CẢNH BÁO', recap: 'TÓM LẠI' },
  ja: { stat: 'データ', cards: 'データ', compare: '比較', bullets: 'ポイント', checklist: '対策', timeline: '経緯', process: '仕組み', alert: '注意', recap: 'まとめ' },
};
const DEFAULT_ICON: Partial<Record<StorySceneType, (typeof ICONS)[number]>> = { stat: 'chart', cards: 'chart', compare: 'chart', bullets: 'document', checklist: 'check', timeline: 'clock', process: 'link', alert: 'alert', recap: 'check' };

/** Ghép đoạn lời đọc thành narration.text, thêm dấu nhịp khi số đoạn khớp số mục (N hoặc N+1 đoạn). */
export function narrationOf(say: string[], targets: number, lang: 'vi' | 'ja'): string {
  const parts = say.map((s) => s.trim()).filter(Boolean);
  const sep = lang === 'ja' ? '' : ' ';
  if (targets > 0 && (parts.length === targets || parts.length === targets + 1)) return parts.join(` ${BEAT_MARK} `);
  return parts.join(sep);
}

/** Lời đọc thật (không dấu nhịp) của từng cảnh sau khi chuyển, theo đúng thứ tự cảnh: dùng để gọi TTS một lần cho cả video. */
export function storyNarration(sb: Storyboard, lang: 'vi' | 'ja'): string[] {
  // Cùng thứ tự với compileStoryboard: các cảnh nội dung, rồi câu hỏi cuối (chỉ cảnh cta đầu tiên).
  const cta = sb.scenes.find((s) => s.type === 'cta');
  const order = [...sb.scenes.filter((s) => s.type !== 'cta'), ...(cta ? [cta] : [])];
  return order.map((s) => s.say.map((x) => x.trim()).filter(Boolean).join(lang === 'ja' ? '' : ' '));
}

/** Chuyển Storyboard → VideoSpec (dạng đầu vào). Không tự sửa nội dung: chữ quá dài hay số thiếu chứng cứ để validateSpec báo. */
export function compileStoryboard(sb: Storyboard, opt: CompileOptions): VideoSpecInput {
  const lang = opt.market === 'JP' ? 'ja' : 'vi';
  const facts = sb.facts.map((f) => ({
    id: f.id,
    kind: 'number' as const,
    label: f.label,
    value: f.value,
    raw: f.raw,
    unit: f.unit,
    approx: f.approx,
    evidence: { url: opt.source.url, quote: f.quote },
  }));

  const body = sb.scenes.filter((s) => s.type !== 'cta');
  const ctas = sb.scenes.filter((s) => s.type === 'cta');
  const scenes: Record<string, unknown>[] = [];
  let chapterNo = 0;
  let prevChapter = '';
  body.forEach((s, i) => {
    const id = `s${String(i + 1).padStart(2, '0')}-${s.type}`;
    const items = s.items ?? [];
    const base: Record<string, unknown> = { id, kind: s.type };
    if (s.type !== 'hook' && s.chapter) {
      const key = `${s.chapter.title}|${s.chapter.accent ?? ''}`;
      if (key !== prevChapter) chapterNo++;
      prevChapter = key;
      base.heading = { title: s.chapter.title, ...(s.chapter.accent ? { accent: s.chapter.accent } : {}), icon: s.chapter.icon ?? DEFAULT_ICON[s.type] };
      const word = CHAPTER_WORD[lang][s.type];
      if (word) base.eyebrow = `${String(chapterNo).padStart(2, '0')} — ${word}`;
    }
    let scene: Record<string, unknown>;
    // Chữ của mục: AI có thể đặt ở text, label hoặc detail tùy loại cảnh. Mục rỗng bị bỏ (không thành dòng trống).
    const txt = (it: (typeof items)[number]) => (it.text ?? it.label ?? it.detail ?? '').trim();
    const textItems = items.filter((it) => txt(it));
    switch (s.type) {
      case 'hook':
        scene = { ...base, headline: (s.headline ?? s.title ?? s.say[0] ?? '').trim(), ...(s.sub ? { sub: s.sub } : {}) };
        break;
      case 'stat':
        scene = { ...base, factId: s.factId ?? items[0]?.factId, label: (s.label ?? items[0]?.label ?? s.title ?? '').trim(), ...(s.context ? { context: s.context } : {}), annotation: 'circle' };
        break;
      case 'cards':
        scene = { ...base, items: items.filter((it) => it.factId).map((it) => ({ factId: it.factId, label: (it.label ?? it.text ?? '').trim() })) };
        break;
      case 'compare':
        scene = { ...base, title: (s.title ?? s.chapter?.title ?? '').trim(), items: items.filter((it) => it.factId).map((it) => ({ factId: it.factId, label: (it.label ?? it.text ?? '').trim() })), mode: 'bars' };
        break;
      case 'bullets':
        scene = { ...base, title: (s.title ?? s.chapter?.title ?? '').trim(), items: textItems.map((it) => ({ text: txt(it), ...(it.factId ? { factId: it.factId } : {}) })) };
        break;
      case 'checklist':
      case 'recap':
        scene = { ...base, items: textItems.map((it) => ({ text: txt(it) })) };
        break;
      case 'timeline':
        scene = { ...base, ...(s.title ? { title: s.title } : {}), events: textItems.map((it) => ({ when: (it.when ?? '').trim(), label: txt(it) })) };
        break;
      case 'process':
        scene = { ...base, title: (s.title ?? s.chapter?.title ?? '').trim(), steps: textItems.map((it) => ({ label: (it.text ?? it.label ?? '').trim() || txt(it), ...(it.detail && it.detail !== txt(it) ? { detail: it.detail } : {}) })) };
        break;
      case 'alert':
        scene = { ...base, title: (s.title ?? s.chapter?.title ?? '').trim(), points: textItems.map(txt), level: 'warning' };
        break;
      default:
        scene = base;
    }
    const targets = beatTargets(scene as unknown as Scene);
    scene.narration = { text: narrationOf(s.say, targets, lang) };
    scenes.push(scene);
  });

  // Thẻ nguồn luôn có, ngay trước câu hỏi cuối. Không có lời đọc để không đọc tên báo/ngày.
  scenes.push({ id: 'src', kind: 'source', seconds: 2.5 });
  const cta = ctas[0];
  if (cta) scenes.push({ id: 'cta', kind: 'cta', question: cta.question ?? cta.say.join(' ').slice(0, 90), narration: { text: narrationOf(cta.say, 0, lang) } });

  return {
    version: SPEC_VERSION,
    id: opt.id,
    market: opt.market,
    language: lang,
    theme: { palette: opt.incident ? 'alert' : 'ember', background: 'grid', chapterColors: true },
    source: { outlet: opt.source.outlet, title: opt.source.title, url: opt.source.url, ...(opt.source.publishedAt ? { publishedAt: opt.source.publishedAt } : {}) },
    facts,
    scenes: scenes as VideoSpecInput['scenes'],
    narration: { enabled: true, provider: 'gemini' },
    captions: { enabled: true, style: 'karaoke', timing: 'alignment' },
    qa: { minSeconds: opt.minSeconds ?? 30, maxSeconds: opt.maxSeconds ?? 60, maxScenes: 16 },
  };
}

// --- Kiểm tra storyboard bằng chính tên trường của storyboard (để AI đọc lỗi là biết sửa ở đâu) ---

/** Luật từng loại cảnh: số mục và trường bắt buộc của mỗi mục. Khớp giới hạn của VideoSpec (schema.ts). */
export const STORY_RULES: Record<StorySceneType, { items?: [number, number]; item?: 'text' | 'fact'; needs?: ('headline' | 'factId' | 'title' | 'question' | 'when')[]; hint: string }> = {
  hook: { needs: ['headline'], hint: 'headline (câu mở), sub tùy chọn; không có items' },
  stat: { needs: ['factId'], hint: 'factId (một fact con số) + label; không có items' },
  cards: { items: [2, 4], item: 'fact', hint: '2–4 items, mỗi mục {factId, label}' },
  compare: { items: [2, 4], item: 'fact', needs: ['title'], hint: 'title + 2–4 items {factId, label}, cùng đơn vị' },
  bullets: { items: [2, 5], item: 'text', needs: ['title'], hint: 'title + 2–5 items {text}' },
  checklist: { items: [3, 8], item: 'text', hint: '3–8 items {text}' },
  timeline: { items: [2, 6], item: 'text', needs: ['when'], hint: '2–6 items {when, text}' },
  process: { items: [2, 6], item: 'text', needs: ['title'], hint: 'title + 2–6 items {text, detail?}' },
  alert: { items: [1, 3], item: 'text', needs: ['title'], hint: 'title + 1–3 items {text}' },
  recap: { items: [2, 5], item: 'text', hint: '2–5 items {text}' },
  cta: { needs: ['question'], hint: 'question (câu hỏi mở); không có items' },
};

export interface StoryIssue {
  level: 'error' | 'warn';
  code: string;
  path: string;
  message: string;
}

/** Lỗi cấu trúc theo từng loại cảnh, đường dẫn là của storyboard (scenes[i].items[k].text…). */
export function storyboardIssues(sb: Storyboard): StoryIssue[] {
  const out: StoryIssue[] = [];
  const err = (path: string, message: string, code = 'story') => out.push({ level: 'error', code, path, message });
  const factIds = new Set<string>();
  sb.facts.forEach((f, i) => {
    if (factIds.has(f.id)) err(`facts[${i}].id`, `id "${f.id}" bị trùng.`);
    factIds.add(f.id);
  });
  if (sb.scenes[0]?.type !== 'hook') err('scenes[0].type', 'Cảnh đầu tiên phải là "hook".');
  if (sb.scenes.filter((s) => s.type === 'cta').length > 1) err('scenes', 'Chỉ được một cảnh "cta" (đặt cuối).');
  sb.scenes.forEach((s, i) => {
    const p = `scenes[${i}]`;
    const r = STORY_RULES[s.type];
    const items = s.items ?? [];
    const has = (v: string | undefined) => !!v && v.trim().length > 0;
    if (!s.say.some((x) => x.trim())) err(`${p}.say`, `Cảnh ${s.type} thiếu lời đọc "say".`);
    for (const n of r.needs ?? []) {
      if (n === 'headline' && !has(s.headline)) err(`${p}.headline`, `Cảnh hook cần "headline". (${r.hint})`);
      if (n === 'title' && !has(s.title) && !has(s.chapter?.title)) err(`${p}.title`, `Cảnh ${s.type} cần "title". (${r.hint})`);
      if (n === 'question' && !has(s.question)) err(`${p}.question`, `Cảnh cta cần "question". (${r.hint})`);
      if (n === 'factId') {
        const id = s.factId ?? items[0]?.factId;
        if (!id) err(`${p}.factId`, `Cảnh stat cần "factId". (${r.hint})`);
        else if (!factIds.has(id)) err(`${p}.factId`, `factId "${id}" không có trong "facts".`);
      }
    }
    if (!r.items) {
      if (items.length) out.push({ level: 'warn', code: 'story', path: `${p}.items`, message: `Cảnh ${s.type} không dùng "items" (bị bỏ qua).` });
      return;
    }
    const [min, max] = r.items;
    const usable = items.filter((it, k) => {
      const q = `${p}.items[${k}]`;
      if (r.item === 'fact') {
        if (!it.factId) return err(`${q}.factId`, `Mục của ${s.type} cần "factId". (${r.hint})`), false;
        if (!factIds.has(it.factId)) return err(`${q}.factId`, `factId "${it.factId}" không có trong "facts".`), false;
        if (!has(it.label) && !has(it.text)) err(`${q}.label`, `Mục của ${s.type} cần "label".`);
        return true;
      }
      // Mục rỗng bị bỏ khi chuyển: chỉ cảnh báo; thiếu số mục hợp lệ thì lỗi ở dưới.
      if (!has(it.text) && !has(it.label) && !has(it.detail)) return out.push({ level: 'warn', code: 'story', path: `${q}.text`, message: `Mục rỗng của ${s.type} bị bỏ qua. (${r.hint})` }), false;
      if (r.needs?.includes('when') && !has(it.when)) err(`${q}.when`, `Mục timeline cần "when" (mốc thời gian ngắn).`);
      return true;
    });
    if (usable.length < min || usable.length > max) err(`${p}.items`, `Cảnh ${s.type} cần ${min}–${max} mục hợp lệ, đang có ${usable.length}. (${r.hint})`);
  });
  return out;
}

/** Vị trí storyboard của từng cảnh VideoSpec sau khi chuyển (-1: cảnh do engine tự thêm, ví dụ thẻ nguồn). */
export function storyIndexMap(sb: Storyboard): number[] {
  const body = sb.scenes.map((s, i) => ({ s, i })).filter((x) => x.s.type !== 'cta').map((x) => x.i);
  const cta = sb.scenes.findIndex((s) => s.type === 'cta');
  return [...body, -1, ...(cta >= 0 ? [cta] : [])];
}

/** Tên trường VideoSpec → tên trường storyboard. */
const FIELD: Record<string, string> = { points: 'items', steps: 'items', events: 'items', series: 'items', narration: 'say', heading: 'chapter', label: 'label', headline: 'headline', question: 'question', title: 'title', factId: 'factId' };

/** Đổi lỗi của validateSpec (đường dẫn VideoSpec) sang đường dẫn storyboard để AI sửa đúng chỗ. */
export function toStoryIssue<T extends { path: string; message: string }>(issue: T, map: number[], sb: Storyboard): T {
  const m = /^scenes\[(\d+)\](?:\.([A-Za-z]+))?(.*)$/.exec(issue.path);
  if (!m) return issue;
  const j = map[Number(m[1])] ?? -1;
  if (j < 0) return issue;
  const type = sb.scenes[j]!.type;
  const field = m[2] ? (FIELD[m[2]] ?? m[2]) : '';
  const rest = (m[3] ?? '').replace(/^\.text$/, '');
  const path = `scenes[${j}]${field ? `.${field}` : ''}${rest}`;
  return { ...issue, path, message: `(cảnh ${type}) ${issue.message}` };
}

/** Đường dẫn lỗi zod → dạng storyboard dễ đọc: ["scenes", 2, "title"] → "scenes[2].title". */
export function storyPath(path: PropertyKey[]): string {
  return path.map((k, i) => (typeof k === 'number' ? `[${k}]` : `${i ? '.' : ''}${String(k)}`)).join('');
}

/** Lỗi zod (tiếng Anh) → câu tiếng Việt kèm giá trị hiện tại, để AI biết sửa thế nào. */
export function zodMessage(i: z.core.$ZodIssue, root: unknown): string {
  let v: unknown = root;
  for (const k of i.path) v = v && typeof v === 'object' ? (v as Record<PropertyKey, unknown>)[k as PropertyKey] : undefined;
  const iss = i as z.core.$ZodIssue & { origin?: string; maximum?: number | bigint; minimum?: number | bigint; values?: unknown[]; expected?: string };
  if (i.code === 'too_big' && iss.origin === 'string') return `dài ${typeof v === 'string' ? [...v].length : '?'} ký tự, tối đa ${iss.maximum}. Viết ngắn lại: "${String(v).slice(0, 60)}"`;
  if (i.code === 'too_small' && iss.origin === 'string') return `không được để trống`;
  if (i.code === 'too_big' && iss.origin === 'array') return `có ${Array.isArray(v) ? v.length : '?'} phần tử, tối đa ${iss.maximum}`;
  if (i.code === 'too_small' && iss.origin === 'array') return `có ${Array.isArray(v) ? v.length : 0} phần tử, cần ít nhất ${iss.minimum}`;
  if (i.code === 'invalid_value') return `giá trị "${String(v)}" không hợp lệ; chỉ nhận: ${(iss.values ?? []).join(', ')}`;
  if (i.code === 'invalid_type') return v === undefined ? `thiếu trường bắt buộc (${iss.expected})` : `sai kiểu, cần ${iss.expected}`;
  if (i.code === 'unrecognized_keys') return `có trường không dùng: ${((i as { keys?: string[] }).keys ?? []).join(', ')} (bỏ đi)`;
  if (i.code === 'invalid_format') return `sai định dạng (${i.message})`;
  return i.message;
}

