// Kiểm tra VideoSpec ở hai tầng: (1) cấu trúc bằng zod, (2) kiểm tra chéo: tham chiếu, khớp chứng cứ, độ dài chữ, giấy phép, thời lượng.
// Video chỉ được dựng khi không còn lỗi mức 'error'. Mức 'warn' cần người xem nhưng không chặn.
import { findNumbers, normalizeText, parseNumber, type Lang } from './numbers.ts';
import { VideoSpecSchema, type Fact, type Scene, type VideoSpec } from './schema.ts';
import { beatTargets, markCount, spelledNumbers, stripBeats } from './beats.ts';
import { buildPlan, planSeconds, type RenderPlan } from '../engine/plan.ts';

export interface Issue {
  level: 'error' | 'warn';
  code: string;
  /** Đường dẫn tới chỗ lỗi, ví dụ "scenes[2].factId". */
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  spec?: VideoSpec;
  issues: Issue[];
  /** Thời lượng ước tính (giây) theo lời đọc, để thấy sớm video có quá dài không. */
  estimatedSeconds?: number;
}

/** Độ rộng hiển thị: ký tự toàn góc/CJK chiếm 2, còn lại 1. Ngân sách chữ tính theo đơn vị này nên tiếng Nhật tự có ít chữ hơn. */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/.test(ch) ? 2 : 1;
  return w;
}

/** Ngân sách chữ (đơn vị hiển thị) cho từng trường. Thay đổi ở đây là thay đổi quy chuẩn thiết kế. */
export const BUDGETS = {
  'hook.headline': 60,
  'hook.sub': 90,
  'stat.label': 48,
  'stat.context': 80,
  'compare.title': 48,
  'compare.item': 32,
  'timeline.label': 60,
  'timeline.when': 24,
  'chart.title': 48,
  'chart.label': 24,
  'quote.text': 200,
  'quote.attribution': 60,
  'bullets.title': 48,
  'bullets.item': 72,
  'process.title': 48,
  'process.label': 40,
  'process.detail': 72,
  'alert.title': 48,
  'alert.point': 72,
  'cta.question': 90,
  'cards.label': 40,
  'checklist.item': 40,
  'concept.chip': 24,
  'concept.result': 48,
  'recap.item': 56,
  'heading.line': 26,
  'eyebrow': 30,
  'note': 90,
  'narration.scene': 300,
} as const;

export { READ_RATE } from './beats.ts';

const MARKET_LANG: Record<string, Lang> = { VN: 'vi', JP: 'ja' };

/** Bỏ ngày tháng và năm khỏi chữ trước khi đối chiếu số liệu: "3/11/2026", "2/11", "năm 2026" không phải số liệu cần chứng cứ. */
function stripDates(text: string): string {
  return normalizeText(text)
    // Chỉ "/" và "-" là dấu ngày. Không dùng "." vì tiếng Việt viết 15.000 (dấu chấm ngăn nghìn): lỗi cũ cắt "15.000" thành "15.00".
    .replace(/(?<![\d.,])\d{1,4}[/-]\d{1,2}(?:[/-]\d{1,4})?(?![\d.,]\d)/g, ' ')
    .replace(/(?<![\d.,])(?:19|20)\d{2}(?![\d.,]|\s*(?:万|億|兆))/g, ' ');
}

const DATE_UNITS = new Set(['年', '月', '日', '時間', '分', '秒', '歳']);
const eq = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-9, Math.abs(a) * 1e-9);

/** Mọi chuỗi chữ hiển thị trong cảnh, kèm đường dẫn và khóa ngân sách. */
function sceneTexts(s: Scene, i: number): { path: string; text: string; budget?: keyof typeof BUDGETS }[] {
  const p = `scenes[${i}]`;
  const out: { path: string; text: string; budget?: keyof typeof BUDGETS }[] = [];
  const add = (path: string, text: string | undefined, budget?: keyof typeof BUDGETS) => {
    if (text) out.push({ path: `${p}.${path}`, text, budget });
  };
  if (s.narration) add('narration.text', stripBeats(s.narration.text), 'narration.scene');
  if (s.heading) { add('heading.title', s.heading.title, 'heading.line'); add('heading.accent', s.heading.accent, 'heading.line'); }
  add('eyebrow', s.eyebrow, 'eyebrow');
  add('note', s.note, 'note');
  switch (s.kind) {
    case 'cards': s.items.forEach((it, j) => add(`items[${j}].label`, it.label, 'cards.label')); break;
    case 'checklist': s.items.forEach((it, j) => add(`items[${j}].text`, it.text, 'checklist.item')); break;
    case 'concept': s.chips.forEach((c, j) => add(`chips[${j}].text`, c.text, 'concept.chip')); add('result', s.result, 'concept.result'); break;
    case 'recap': s.items.forEach((it, j) => add(`items[${j}].text`, it.text, 'recap.item')); break;
    case 'hook': add('headline', s.headline, 'hook.headline'); add('sub', s.sub, 'hook.sub'); break;
    case 'stat': add('label', s.label, 'stat.label'); add('context', s.context, 'stat.context'); break;
    case 'compare': add('title', s.title, 'compare.title'); s.items.forEach((it, j) => add(`items[${j}].label`, it.label, 'compare.item')); break;
    case 'timeline': add('title', s.title); s.events.forEach((e, j) => { add(`events[${j}].when`, e.when, 'timeline.when'); add(`events[${j}].label`, e.label, 'timeline.label'); }); break;
    case 'chart': add('title', s.title, 'chart.title'); s.series.forEach((it, j) => add(`series[${j}].label`, it.label, 'chart.label')); break;
    case 'quote': add('attribution', s.attribution, 'quote.attribution'); break;
    case 'bullets': add('title', s.title, 'bullets.title'); s.items.forEach((it, j) => add(`items[${j}].text`, it.text, 'bullets.item')); break;
    case 'process': add('title', s.title, 'process.title'); s.steps.forEach((st, j) => { add(`steps[${j}].label`, st.label, 'process.label'); add(`steps[${j}].detail`, st.detail, 'process.detail'); }); break;
    case 'alert': add('title', s.title, 'alert.title'); s.points.forEach((t, j) => add(`points[${j}]`, t, 'alert.point')); break;
    case 'cta': add('question', s.question, 'cta.question'); break;
    case 'map': add('label', s.label); break;
    case 'photo': add('caption', s.caption); break;
  }
  return out;
}

function zodIssues(error: { issues: { path: PropertyKey[]; message: string }[] }): Issue[] {
  return error.issues.map((i) => ({
    level: 'error' as const,
    code: 'schema',
    path: i.path.map((k, n) => (typeof k === 'number' ? `[${k}]` : n === 0 ? String(k) : `.${String(k)}`)).join(''),
    message: i.message,
  }));
}

export function validateSpec(input: unknown): ValidationResult {
  const parsed = VideoSpecSchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: zodIssues(parsed.error) };
  const spec = parsed.data;
  const issues: Issue[] = [];
  const err = (code: string, path: string, message: string) => issues.push({ level: 'error', code, path, message });
  const warn = (code: string, path: string, message: string) => issues.push({ level: 'warn', code, path, message });
  const lang = spec.language as Lang;

  // 1. Thị trường và ngôn ngữ khớp nhau
  if (MARKET_LANG[spec.market] !== lang) err('lang', 'language', `Thị trường ${spec.market} phải dùng ngôn ngữ "${MARKET_LANG[spec.market]}", không phải "${lang}".`);

  // 2. id duy nhất
  const dup = (label: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const [i, id] of ids.entries()) {
      if (seen.has(id)) err('dup-id', `${label}[${i}].id`, `id "${id}" bị trùng.`);
      seen.add(id);
    }
  };
  dup('facts', spec.facts.map((f) => f.id));
  dup('scenes', spec.scenes.map((s) => s.id));
  dup('assets', spec.assets.map((a) => a.id));

  const facts = new Map<string, Fact>(spec.facts.map((f) => [f.id, f]));
  const assets = new Map(spec.assets.map((a) => [a.id, a]));

  // 3. Chứng cứ: câu trích phải chứa đúng con số, và số khớp giá trị
  for (const [i, f] of spec.facts.entries()) {
    const quote = normalizeText(f.evidence.quote);
    if (f.kind === 'number') {
      if (!quote.includes(normalizeText(f.raw))) err('evidence-raw', `facts[${i}].evidence.quote`, `Câu trích không chứa nguyên văn "${f.raw}". Con số phải lấy đúng từ bài nguồn.`);
      const p = parseNumber(f.raw, lang);
      if (!p) err('number-parse', `facts[${i}].raw`, `Không đọc được "${f.raw}" như một con số tiếng ${lang === 'ja' ? 'Nhật' : 'Việt'}.`);
      else if (!eq(p.value, f.value)) err('number-mismatch', `facts[${i}].value`, `"${f.raw}" có giá trị ${p.value}, nhưng fact ghi ${f.value}.`);
    } else if (f.kind === 'quote') {
      if (!quote.includes(normalizeText(f.text))) err('evidence-quote', `facts[${i}].evidence.quote`, 'Câu trích bằng chứng không chứa nguyên văn lời trích của fact.');
    } else if (f.kind === 'date') {
      if (!quote.includes(normalizeText(f.raw))) err('evidence-date', `facts[${i}].evidence.quote`, `Câu trích không chứa nguyên văn ngày "${f.raw}".`);
    }
  }

  // 4. Cấu trúc kể chuyện
  const kinds = spec.scenes.map((s) => s.kind);
  if (kinds[0] !== 'hook') err('first-scene', 'scenes[0]', 'Cảnh đầu phải là "hook" để giữ người xem trong 3 giây đầu.');
  if (!kinds.includes('source')) err('no-source', 'scenes', 'Thiếu cảnh "source": mọi video phải ghi nguồn.');
  if (kinds.at(-1) !== 'cta' && kinds.at(-1) !== 'source') warn('last-scene', `scenes[${kinds.length - 1}]`, 'Nên kết bằng "cta" hoặc "source".');
  if (spec.scenes.length > spec.qa.maxScenes) err('too-many-scenes', 'scenes', `Có ${spec.scenes.length} cảnh, tối đa ${spec.qa.maxScenes}.`);

  // 5. Tham chiếu và loại fact phù hợp với cảnh
  const needFact = (path: string, id: string, kind: Fact['kind']) => {
    const f = facts.get(id);
    if (!f) return err('missing-fact', path, `Không có fact "${id}".`);
    if (f.kind !== kind) err('fact-kind', path, `Fact "${id}" là "${f.kind}", cảnh này cần "${kind}".`);
  };
  const usedFacts = new Set<string>();
  for (const [i, s] of spec.scenes.entries()) {
    const p = `scenes[${i}]`;
    if (s.kind === 'stat') { needFact(`${p}.factId`, s.factId, 'number'); usedFacts.add(s.factId); }
    if (s.kind === 'quote') {
      needFact(`${p}.factId`, s.factId, 'quote');
      usedFacts.add(s.factId);
      const q = facts.get(s.factId);
      if (q?.kind === 'quote') for (const h of s.highlight) if (!normalizeText(q.text).includes(normalizeText(h))) err('highlight', `${p}.highlight`, `"${h}" không có trong lời trích.`);
    }
    if (s.kind === 'compare') s.items.forEach((it, j) => { needFact(`${p}.items[${j}].factId`, it.factId, 'number'); usedFacts.add(it.factId); });
    if (s.kind === 'cards') s.items.forEach((it, j) => { needFact(`${p}.items[${j}].factId`, it.factId, 'number'); usedFacts.add(it.factId); });
    // Mốc nhịp: số dấu "|" phải là 0, N-1 hoặc N (N = số phần tử hiện lần lượt)
    if (s.narration) {
      for (const w of spelledNumbers(s.narration.text, lang)) warn('spelled-number', `${p}.narration.text`, `"${w}" là số viết bằng chữ: không đối chiếu được với chứng cứ. Viết bằng chữ số (TTS vẫn đọc đúng), hoặc giữ nếu chỉ là lượng ước chừng như "hàng trăm".`);
      const m = markCount(s.narration.text);
      const n = beatTargets(s);
      if (m > 0 && n === 0) warn('beats-unused', `${p}.narration.text`, `Cảnh "${s.kind}" không có phần tử hiện lần lượt; ${m} dấu "|" sẽ bị bỏ qua.`);
      else if (m > 0 && m !== n - 1 && m !== n) err('beats-count', `${p}.narration.text`, `Có ${m} dấu "|" cho ${n} phần tử: cần ${n - 1} (mỗi đoạn một phần tử) hoặc ${n} (đoạn đầu là lời dẫn).`);
    }
    if (s.kind === 'chart') s.series.forEach((it, j) => { needFact(`${p}.series[${j}].factId`, it.factId, 'number'); usedFacts.add(it.factId); });
    if ((s.kind === 'alert' || s.kind === 'source') && s.factId) { if (!facts.has(s.factId)) err('missing-fact', p + '.factId', 'Không có fact "' + s.factId + '".'); usedFacts.add(s.factId); }
    if (s.kind === 'timeline') s.events.forEach((e, j) => { if (e.factId) { if (!facts.has(e.factId)) err('missing-fact', `${p}.events[${j}].factId`, `Không có fact "${e.factId}".`); usedFacts.add(e.factId); } });
    if (s.kind === 'bullets') s.items.forEach((it, j) => { if (it.factId) { if (!facts.has(it.factId)) err('missing-fact', `${p}.items[${j}].factId`, `Không có fact "${it.factId}".`); usedFacts.add(it.factId); } });
    if (s.kind === 'compare' && s.items.length >= 2) {
      const units = new Set(s.items.map((it) => { const f = facts.get(it.factId); return f?.kind === 'number' ? f.unit : ''; }));
      if (units.size > 1) warn('mixed-units', `${p}.items`, `Các mốc so sánh có đơn vị khác nhau (${[...units].join(', ')}): so sánh có thể gây hiểu nhầm.`);
    }
    if (s.kind === 'chart' && s.series.length >= 2) {
      const units = new Set(s.series.map((it) => { const f = facts.get(it.factId); return f?.kind === 'number' ? f.unit : ''; }));
      if (units.size > 1) err('mixed-units', `${p}.series`, `Biểu đồ trộn nhiều đơn vị (${[...units].join(', ')}): không vẽ chung một trục được.`);
    }
  }
  // 6. Con số trong chữ hiển thị phải có chứng cứ (không để AI tự bịa số)
  const numberFacts = spec.facts.filter((f): f is Extract<Fact, { kind: 'number' }> => f.kind === 'number');
  for (const [i, s] of spec.scenes.entries()) {
    for (const t of sceneTexts(s, i)) {
      if (t.path.endsWith('.when')) continue; // mốc thời gian hiển thị, không phải số liệu
      if (t.path.endsWith('.eyebrow')) continue; // số thứ tự chương ("01 — ..."), là cấu trúc
      for (const n of findNumbers(stripDates(t.text), lang)) {
        const match = numberFacts.filter((f) => eq(f.value, n.value));
        if (match.length) {
          match.forEach((f) => usedFacts.add(f.id)); // số hiện trong chữ cũng là "dùng" fact
          continue;
        }
        if (DATE_UNITS.has(n.unit)) continue; // 10月29日, 2026年: ngày tháng
        if (n.value >= 100) err('number-no-evidence', t.path, `Số "${n.raw}" trong "${t.text}" không khớp fact nào. Thêm fact có chứng cứ hoặc bỏ con số.`);
        else warn('number-no-evidence', t.path, `Số "${n.raw}" trong "${t.text}" chưa có fact. Chỉ chấp nhận với số đếm nhỏ không phải dữ kiện.`);
      }
    }
  }
  for (const [i, f] of spec.facts.entries()) if (!usedFacts.has(f.id)) warn('unused-fact', `facts[${i}]`, `Fact "${f.id}" không được cảnh nào dùng (cả qua factId lẫn số hiện trong chữ).`);

  // 7. Ngân sách chữ theo độ rộng hiển thị
  for (const [i, s] of spec.scenes.entries()) {
    for (const t of sceneTexts(s, i)) {
      if (!t.budget) continue;
      const w = displayWidth(t.text);
      const max = BUDGETS[t.budget];
      if (w > max) err('text-too-long', t.path, `Chữ dài ${w} đơn vị, tối đa ${max} (ký tự Nhật tính 2). "${t.text.slice(0, 30)}…"`);
    }
  }

  // 8. Tư liệu và giấy phép
  const usedAssets = new Set<string>();
  const needAsset = (path: string, id: string, type: string) => {
    const a = assets.get(id);
    if (!a) return err('missing-asset', path, `Không có tư liệu "${id}" trong assets.`);
    usedAssets.add(id);
    if (a.type !== type) err('asset-type', path, `Tư liệu "${id}" là "${a.type}", cần "${type}".`);
    if (!a.license.commercialUse) err('license', path, `Tư liệu "${id}" không được dùng thương mại (${a.license.name}).`);
    if (a.license.attributionRequired && !a.license.attributionText) err('attribution', path, `Tư liệu "${id}" yêu cầu ghi nguồn nhưng thiếu attributionText.`);
    if ((a.origin === 'ai') !== a.aiGenerated) err('ai-flag', path, `Tư liệu "${id}": origin và aiGenerated không nhất quán. Ảnh AI phải gắn cờ aiGenerated (D-11).`);
  };
  for (const [i, s] of spec.scenes.entries()) {
    if (s.kind === 'photo') needAsset(`scenes[${i}].assetId`, s.assetId, 'image');
    if (s.kind === 'map' && s.provider === 'static') s.assetId ? needAsset(`scenes[${i}].assetId`, s.assetId, 'image') : err('map-asset', `scenes[${i}].assetId`, 'Bản đồ tĩnh cần assetId.');
  }
  if (spec.music) needAsset('music.assetId', spec.music.assetId, 'audio');
  for (const [i, a] of spec.assets.entries()) if (!usedAssets.has(a.id)) warn('unused-asset', `assets[${i}]`, `Tư liệu "${a.id}" không được dùng.`);

  // 9. Thời lượng: dùng đúng bộ lập kế hoạch dựng (engine/plan.ts) với lời đọc ước lượng, để con số khớp với video thật.
  //    Khi có âm thanh thật, dịch vụ dựng kiểm lại bằng thời lượng thật (xem scripts/render-spec.ts).
  const plan = buildPlan(spec);
  const estimatedSeconds = planSeconds(plan);
  for (const p of pacingIssues(plan)) issues.push(p);
  if (estimatedSeconds > spec.qa.maxSeconds) err('too-long', 'scenes', `Ước tính ${estimatedSeconds}s, vượt tối đa ${spec.qa.maxSeconds}s. Rút bớt lời đọc hoặc bỏ cảnh.`);
  if (estimatedSeconds < spec.qa.minSeconds) err('too-short', 'scenes', `Ước tính ${estimatedSeconds}s, dưới tối thiểu ${spec.qa.minSeconds}s. Thêm cảnh có dữ kiện (không bịa) hoặc hạ minSeconds nếu bài quá ít thông tin.`);

  // 10. Phụ đề và lời đọc phải nhất quán
  if (spec.captions.enabled && !spec.narration.enabled) warn('captions-no-voice', 'captions', 'Bật phụ đề nhưng tắt lời đọc: phụ đề sẽ không có mốc thời gian thật.');
  if (spec.captions.enabled && spec.captions.timing === 'estimated') warn('captions-estimated', 'captions.timing', 'Phụ đề dùng mốc ước lượng, có thể lệch tiếng. Nên dùng "alignment".');

  return { ok: !issues.some((i) => i.level === 'error'), spec, issues, estimatedSeconds };
}

/**
 * Ngưỡng chống "trình chiếu slide" (style bible: video mẫu có phần tử mới mỗi ~0,9 s, cảnh trung bình ~4,7 s).
 * Phụ đề đổi trang không tính là thay đổi hình.
 */
export const PACING = { maxSceneSeconds: 9, maxStillSeconds: 4.5 } as const;

/**
 * Kiểm nhịp hình trên kế hoạch dựng. Chạy lại được với thời lượng âm thanh thật (dịch vụ dựng, scripts/render-spec.ts).
 * Chỉ cảnh báo: nhịp chậm không sai dữ kiện, nhưng là dấu hiệu video trông như slide.
 */
export function pacingIssues(plan: RenderPlan): Issue[] {
  const out: Issue[] = [];
  for (const p of plan.scenes) {
    const path = `scenes[${p.index}]`;
    const visible = p.durationInFrames - p.transitionOutFrames;
    const sec = visible / plan.fps;
    if (sec > PACING.maxSceneSeconds + 0.05) out.push({ level: 'warn', code: 'scene-long', path, message: `Cảnh "${p.scene.id}" dài ${sec.toFixed(1)}s (nên ≤ ${PACING.maxSceneSeconds}s). Tách thành hai cảnh hoặc rút lời đọc.` });
    // Các mốc hình đổi: lúc cảnh hiện, từng phần tử, lúc cảnh rời đi.
    const marks = [0, ...p.beats, visible].sort((a, b) => a - b);
    let still = 0;
    for (let i = 1; i < marks.length; i++) still = Math.max(still, marks[i]! - marks[i - 1]!);
    const stillSec = still / plan.fps;
    if (stillSec > PACING.maxStillSeconds + 0.05 && sec <= PACING.maxSceneSeconds + 0.05) out.push({ level: 'warn', code: 'static', path, message: `Cảnh "${p.scene.id}" đứng yên ${stillSec.toFixed(1)}s không có phần tử mới (nên ≤ ${PACING.maxStillSeconds}s). Thêm mốc "|" trong lời đọc hoặc thêm phần tử.` });
  }
  return out;
}

/** In danh sách vấn đề dễ đọc cho CLI và log. */
export function formatIssues(issues: Issue[]): string {
  if (!issues.length) return 'Không có vấn đề.';
  return issues.map((i) => `${i.level === 'error' ? '✕' : '!'} [${i.code}] ${i.path}: ${i.message}`).join('\n');
}
