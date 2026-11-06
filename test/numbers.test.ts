import { describe, expect, it } from 'vitest';
import { findNumbers, formatNumber, normalizeText, parseNumber } from '../src/spec/numbers.ts';

describe('số tiếng Nhật', () => {
  it('ghép 万 và phần dư: 338万6187件 = 3.386.187 (lỗi cũ cắt thành 6187)', () => {
    const p = parseNumber('338万6187件に増えた', 'ja')!;
    expect(p.value).toBe(3_386_187);
    expect(p.raw).toBe('338万6187');
    expect(p.unit).toBe('件');
  });
  it('41万1827件 = 411.827', () => {
    expect(parseNumber('41万1827件が流出', 'ja')!.value).toBe(411_827);
  });
  it('約7700万件 = 77.000.000, đánh dấu xấp xỉ, raw giữ chữ 約', () => {
    const p = parseNumber('約7700万件のメールアドレス', 'ja')!;
    expect(p.value).toBe(77_000_000);
    expect(p.approx).toBe(true);
    expect(p.raw).toBe('約7700万');
    expect(p.unit).toBe('件');
  });
  it('1億2300万円 và số thập phân 1.5億円', () => {
    expect(parseNumber('1億2300万円', 'ja')!.value).toBe(123_000_000);
    expect(parseNumber('1.5億円', 'ja')!.value).toBe(150_000_000);
  });
  it('chữ số toàn góc: ５社 = 5', () => {
    const p = parseNumber('５社が被害', 'ja')!;
    expect(p.value).toBe(5);
    expect(p.unit).toBe('社');
  });
  it('số thuần có dấu phẩy: 1,234件', () => {
    expect(parseNumber('1,234件', 'ja')!.value).toBe(1234);
  });
  it('chuỗi không bắt đầu bằng số thì null', () => {
    expect(parseNumber('流出した', 'ja')).toBeNull();
  });
  it('findNumbers không đọc lại phần dư của số ghép', () => {
    const nums = findNumbers('流出したメールアドレスが338万6187件に増え、契約企業（5社）が最大41万1827件', 'ja');
    expect(nums.map((n) => n.value)).toEqual([3_386_187, 5, 411_827]);
  });
});

describe('số tiếng Việt', () => {
  it('15.000 euro: dấu chấm là ngăn nghìn', () => {
    const p = parseNumber('15.000 euro (430 triệu đồng) bị hỏng', 'vi')!;
    expect(p.value).toBe(15_000);
    expect(p.unit).toBe('euro');
  });
  it('430 triệu đồng', () => {
    const p = parseNumber('430 triệu đồng', 'vi')!;
    expect(p.value).toBe(430_000_000);
    expect(p.raw).toBe('430 triệu');
    expect(p.unit).toBe('đồng');
  });
  it('50 độ C: đơn vị hai từ', () => {
    const p = parseNumber('50 độ C tại hàng trăm siêu thị', 'vi')!;
    expect(p.value).toBe(50);
    expect(p.unit).toBe('độ C');
  });
  it('3,5 tỷ: dấu phẩy là thập phân', () => {
    expect(parseNumber('3,5 tỷ USD', 'vi')!.value).toBe(3_500_000_000);
  });
  it('1.234.567 người', () => {
    expect(parseNumber('1.234.567 người', 'vi')!.value).toBe(1_234_567);
  });
  it('phần trăm: 25% và 12,5%', () => {
    expect(parseNumber('25% số bài', 'vi')!.value).toBe(25);
    expect(parseNumber('12,5%', 'vi')!.value).toBe(12.5);
  });
  it('từ xấp xỉ đứng trước', () => {
    const p = parseNumber('khoảng 2 triệu người', 'vi')!;
    expect(p.value).toBe(2_000_000);
    expect(p.approx).toBe(true);
  });
});

describe('lỗi do agent dữ liệu phát hiện (findNumbers tiếng Việt)', () => {
  it('đơn vị nhiều từ không bị cắt cụt', () => {
    expect(parseNumber('120 cửa hàng bị ảnh hưởng', 'vi')!.unit).toBe('cửa hàng');
    expect(parseNumber('30 địa điểm', 'vi')!.unit).toBe('địa điểm');
    expect(parseNumber('50 độ C', 'vi')!.unit).toBe('độ C');
  });
  it('đơn vị không có trong từ điển: lấy trọn một từ, không cắt', () => {
    expect(parseNumber('7 tủ đông', 'vi')!.unit).toBe('tủ');
  });
  it('giờ và ngày không bị coi là số liệu', () => {
    const nums = findNumbers('Lúc 2h sáng ngày 2/11, khoảng 3h30, tin tặc tăng nhiệt lên 50 độ C tại 120 cửa hàng.', 'vi');
    expect(nums.map((n) => n.value)).toEqual([50, 120]);
  });
  it('"tháng 10", "năm 2026", "quý 3" là thời gian, không phải số liệu', () => {
    expect(findNumbers('Giữa tháng 10, năm 2026, quý 3 có 13 cửa hàng', 'vi').map((n) => n.value)).toEqual([13]);
    expect(findNumbers('Giữa tháng 10, siêu thị ở Pháp', 'vi')).toEqual([]);
    expect(findNumbers('ước tính 15.000 euro tiền thịt', 'vi').map((n) => n.value)).toEqual([15000]);
  });
});

describe('định dạng', () => {
  it('JP đầy đủ: 3386187 -> 338万6187; 77000000 -> 7700万', () => {
    expect(formatNumber(3_386_187, 'ja')).toBe('338万6187');
    expect(formatNumber(77_000_000, 'ja')).toBe('7700万');
  });
  it('JP rút gọn: 3386187 -> 339万 (làm tròn); 150000000 -> 1.5億', () => {
    expect(formatNumber(3_386_187, 'ja', { mode: 'compact' })).toBe('339万');
    expect(formatNumber(150_000_000, 'ja', { mode: 'compact' })).toBe('1.5億');
  });
  it('VN: ngăn nghìn bằng dấu chấm, rút gọn triệu/tỷ', () => {
    expect(formatNumber(3_386_187, 'vi')).toBe('3.386.187');
    expect(formatNumber(3_386_187, 'vi', { mode: 'compact' })).toBe('3,39 triệu');
    expect(formatNumber(3_500_000_000, 'vi', { mode: 'compact' })).toBe('3,5 tỷ');
  });
  it('số nhỏ giữ nguyên', () => {
    expect(formatNumber(97, 'ja')).toBe('97');
    expect(formatNumber(50, 'vi')).toBe('50');
  });
  it('khứ hồi: định dạng đầy đủ rồi đọc lại ra đúng số', () => {
    for (const n of [97, 12345, 3_386_187, 411_827, 77_000_000, 123_000_000]) {
      expect(parseNumber(formatNumber(n, 'ja'), 'ja')!.value).toBe(n);
      expect(parseNumber(formatNumber(n, 'vi'), 'vi')!.value).toBe(n);
    }
  });
  it('normalizeText đổi toàn góc và gộp khoảng trắng', () => {
    expect(normalizeText('１２３　件  ')).toBe('123 件');
  });
});
