// Phân tích và định dạng số theo tiếng Việt và tiếng Nhật. Thuần, không phụ thuộc React, dùng được ở cả Node lẫn composition.
// Lý do tồn tại: bộ lọc đơn giản cắt sai số Nhật ("338万6187件" thành "6187件") và nhầm dấu chấm/phẩy của tiếng Việt.
// Mọi con số trong video phải đi qua đây để khớp được với câu gốc (evidence) và hiển thị đúng quy ước từng thị trường.

export type Lang = 'vi' | 'ja';

export interface ParsedNumber {
  /** Giá trị số, ví dụ 3386187. */
  value: number;
  /** Đoạn chữ số (kèm đơn vị cỡ lớn như 万/triệu) đúng như xuất hiện trong văn bản, đã chuẩn hóa NFKC. */
  raw: string;
  /** Từ đơn vị đứng sau con số (件, 円, %, euro, độ C...); rỗng nếu không có. */
  unit: string;
  /** Có từ chỉ số xấp xỉ đứng trước (約, およそ, 最大, xấp xỉ, khoảng...). */
  approx: boolean;
}

/** Chuẩn hóa: chữ số/dấu toàn góc thành bán góc, gộp khoảng trắng. */
export function normalizeText(s: string): string {
  return s.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

const JA_UNITS: Record<string, number> = { 兆: 1e12, 億: 1e8, 万: 1e4 };
const VI_UNITS: Record<string, number> = { nghìn: 1e3, ngàn: 1e3, triệu: 1e6, tỷ: 1e9, tỉ: 1e9 };

// Thứ tự quan trọng: cụm dài đứng trước để không bị cụm ngắn nuốt mất ("最大約" trước "最大").
const JA_APPROX = /^(最大で約|最大約|少なくとも|およそ|ほぼ|最大|約)/;
// Đơn vị đếm và tiền tệ thường gặp trong tin tức. Không có trong danh sách thì không đoán đơn vị.
const JA_COUNTER = /^(%|万円|億円|ドル|ユーロ|か所|ヶ所|カ所|種類|時間|件|通|人|名|社|台|円|倍|回|年|月|日|個|店|歳|本|枚|行|分|秒|度)/;

/** Đọc số Nhật ở đầu chuỗi: hỗ trợ ghép đơn vị như 1億2300万円, 338万6187件, 7700万件, 1.5億円. */
function parseJa(text: string): ParsedNumber | null {
  const s = normalizeText(text);
  const approx = JA_APPROX.test(s);
  const body = s.replace(JA_APPROX, '').trimStart();
  const re = /(\d[\d,]*(?:\.\d+)?)\s*(兆|億|万)?/y;
  let total = 0;
  let pos = 0;
  let lastUnit = Infinity;
  let matchedAny = false;
  for (;;) {
    re.lastIndex = pos;
    const m = re.exec(body);
    if (!m) break;
    const num = Number(m[1]!.replace(/,/g, ''));
    const unit = m[2];
    if (unit) {
      const mag = JA_UNITS[unit]!;
      if (mag >= lastUnit) break; // 万 không được đứng trước 億: dừng, coi là hết số
      total += num * mag;
      lastUnit = mag;
    } else {
      // phần dư không đơn vị (6187 trong 338万6187) chỉ hợp lệ sau một đơn vị lớn hoặc khi là số thuần
      total += num;
      lastUnit = 1;
    }
    matchedAny = true;
    pos = re.lastIndex;
    if (!unit) break; // số không đơn vị luôn là phần cuối
  }
  if (!matchedAny) return null;
  const rawNumeric = body.slice(0, pos).trim();
  const rest = body.slice(pos).trimStart();
  const unitWord = (JA_COUNTER.exec(rest)?.[1] ?? '').trim();
  const rawPrefix = approx ? s.slice(0, s.length - body.length) : '';
  return { value: total, raw: `${rawPrefix}${rawNumeric}`.trim(), unit: unitWord, approx };
}

/** Đơn vị tiếng Việt nhiều từ thường gặp trong tin tức. Thêm vào đây khi gặp đơn vị mới; cụm dài đặt trước. */
const VI_MULTI_UNITS = ['độ C', 'cửa hàng', 'siêu thị', 'địa điểm', 'doanh nghiệp', 'công ty', 'quốc gia', 'người dùng', 'tài khoản', 'nhân viên', 'máy chủ', 'thiết bị', 'sản phẩm', 'tỷ lệ', 'điểm phần trăm'];

/** Đọc số Việt: "15.000" nghìn bằng dấu chấm, "3,5" thập phân bằng dấu phẩy, kèm triệu/tỷ/nghìn. */
function parseVi(text: string): ParsedNumber | null {
  const s = normalizeText(text);
  const lead = /^(xấp xỉ|khoảng|hơn|gần|tối đa|ít nhất|trên|dưới)\s+/i.exec(s);
  const body = lead ? s.slice(lead[0].length) : s;
  const m = /^(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?|\d+\.\d+)(?:\s*(nghìn|ngàn|triệu|tỷ|tỉ)(?![\p{L}]))?/iu.exec(body);
  if (!m) return null;
  const numText = m[1]!;
  let n: number;
  if (/^\d{1,3}(\.\d{3})+$/.test(numText)) n = Number(numText.replace(/\./g, '')); // 15.000 = 15 nghìn
  else if (numText.includes(',')) n = Number(numText.replace(',', '.')); // 3,5
  else n = Number(numText); // 1.5 (kiểu Anh) hoặc số nguyên
  const word = m[2]?.toLowerCase();
  if (word) n *= VI_UNITS[word]!;
  const rest = body.slice(m[0].length).trimStart();
  // đơn vị: % / °C, hoặc cụm nhiều từ có trong từ điển (cửa hàng, độ C...), nếu không thì TRỌN một từ (không cắt cụt).
  const multi = VI_MULTI_UNITS.find((u) => rest.toLowerCase().startsWith(u.toLowerCase()) && !/\p{L}/u.test(rest[u.length] ?? ''));
  const unit = multi ? rest.slice(0, multi.length) : (/^(%|°C|[\p{L}]+)/u.exec(rest)?.[1] ?? '');
  return { value: n, raw: `${lead ? lead[0] : ''}${m[0]}`.trim(), unit, approx: !!lead };
}

/** Đọc con số đầu tiên của chuỗi. Trả về null nếu chuỗi không bắt đầu bằng số. */
export function parseNumber(text: string, lang: Lang): ParsedNumber | null {
  return lang === 'ja' ? parseJa(text) : parseVi(text);
}

/** Tìm mọi con số trong một đoạn văn (dùng để trích sự kiện ứng viên từ bài gốc). */
export function findNumbers(text: string, lang: Lang): ParsedNumber[] {
  // Giờ và ngày không phải số liệu: che đi (giữ độ dài) trước khi dò. VN: 2h, 3h30, 14:05, 2/11, 3/11/2026. JP: 10月29日, 2026年 do đơn vị lọc ở nơi dùng.
  let s = normalizeText(text);
  if (lang === 'vi') {
    s = s
      .replace(/\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/g, (m) => ' '.repeat(m.length))
      .replace(/\b\d{1,2}(?::\d{2}|h(?:\d{2})?)(?![\p{L}\d])/gu, (m) => ' '.repeat(m.length))
      .replace(/(?<=(?:tháng|năm|ngày|quý)\s+)\d{1,4}(?!\d|[.,]\d)/giu, (m) => ' '.repeat(m.length));
  }
  const out: ParsedNumber[] = [];
  const start = lang === 'ja' ? /\d/g : /\d/g;
  let i = 0;
  while (i < s.length) {
    start.lastIndex = i;
    const hit = start.exec(s);
    if (!hit) break;
    // lùi lại để bắt từ chỉ số xấp xỉ đứng ngay trước (約, khoảng...)
    let from = hit.index;
    if (lang === 'ja') {
      const pre = /(最大で約|最大約|およそ|少なくとも|最大|約|ほぼ)$/.exec(s.slice(Math.max(0, from - 4), from));
      if (pre) from -= pre[0].length;
    }
    const p = parseNumber(s.slice(from), lang);
    if (p) {
      out.push(p);
      i = from + Math.max(p.raw.length, 1);
    } else {
      i = hit.index + 1;
    }
    // bỏ qua phần dư của số vừa đọc (tránh đọc lại "6187" trong "338万6187")
    while (i < s.length && /[\d.,]/.test(s[i]!)) i++;
  }
  return out;
}

const nf = (n: number, maxDecimals: number) => {
  const r = Number(n.toFixed(maxDecimals));
  return r;
};

export interface FormatOptions {
  /** 'full' giữ nguyên độ chính xác; 'compact' làm tròn 3 chữ số có nghĩa và dùng đơn vị lớn (triệu/tỷ, 万/億). */
  mode?: 'full' | 'compact';
  maxDecimals?: number;
}

/** Hiển thị số theo quy ước từng thị trường: VN dùng "." ngăn nghìn và "," thập phân; JP dùng 万/億/兆. */
export function formatNumber(value: number, lang: Lang, opts: FormatOptions = {}): string {
  const mode = opts.mode ?? 'full';
  const dec = opts.maxDecimals ?? 2;
  const neg = value < 0 ? '-' : '';
  const v = Math.abs(value);
  if (lang === 'ja') {
    if (v < 1e4) return `${neg}${nf(v, dec).toLocaleString('en-US')}`;
    const parts: [number, string][] = [[1e12, '兆'], [1e8, '億'], [1e4, '万']];
    if (mode === 'compact') {
      for (const [mag, ch] of parts) {
        if (v >= mag) {
          const x = v / mag;
          const digits = x >= 100 ? 0 : x >= 10 ? 1 : 2;
          return `${neg}${nf(x, Math.min(dec, digits))}${ch}`;
        }
      }
    }
    // đầy đủ: 3386187 -> 338万6187
    let rest = Math.round(v);
    let out = '';
    for (const [mag, ch] of parts) {
      if (rest >= mag) {
        const q = Math.floor(rest / mag);
        out += `${q}${ch}`;
        rest -= q * mag;
      }
    }
    if (rest > 0) out += String(rest);
    return neg + out;
  }
  // tiếng Việt
  const grp = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const dc = (x: number) => String(x).replace('.', ',');
  if (mode === 'compact') {
    if (v >= 1e9) return `${neg}${dc(nf(v / 1e9, dec))} tỷ`;
    if (v >= 1e6) return `${neg}${dc(nf(v / 1e6, dec))} triệu`;
  }
  if (!Number.isInteger(v)) return `${neg}${grp(Math.floor(v))},${String(nf(v - Math.floor(v), dec)).slice(2)}`;
  return `${neg}${grp(v)}`;
}
