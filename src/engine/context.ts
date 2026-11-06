// Ngữ cảnh chung truyền cho mọi thành phần cảnh, và vài tiện ích bố cục.
import type { Lang } from '../spec/numbers.ts';
import type { Fact, VideoSpec } from '../spec/schema.ts';
import type { PlannedScene } from './plan.ts';
import type { Layout, Palette } from './theme.ts';

export interface SceneCtx {
  spec: VideoSpec;
  palette: Palette;
  layout: Layout;
  lang: Lang;
  ja: boolean;
  facts: Map<string, Fact>;
  ps: PlannedScene;
}

export type NumberFact = Extract<Fact, { kind: 'number' }>;

export function numberFact(ctx: SceneCtx, id: string): NumberFact {
  const f = ctx.facts.get(id);
  if (!f || f.kind !== 'number') throw new Error(`Fact "${id}" không phải dạng number (VideoSpec chưa qua validateSpec?)`);
  return f;
}

/**
 * Ước lượng độ rộng chuỗi theo "em" (không cần DOM, nên không phụ thuộc lúc font nạp xong và dựng xác định):
 * chữ số và Latin ~0,58em, dấu ~0,3em, CJK 1em. Dùng để chọn cỡ chữ cho số lớn và tiêu đề không tràn khung.
 */
export function estimateEm(text: string): number {
  let w = 0;
  for (const ch of text) {
    if (/[⺀-꓏가-힣＀-｠]/u.test(ch)) w += 1;
    else if (/[.,:;'"|!·\s]/u.test(ch)) w += 0.3;
    else if (/[mwMW@%]/u.test(ch)) w += 0.85;
    else w += 0.6;
  }
  return w;
}

/** Cỡ chữ lớn nhất ≤ max sao cho chuỗi vừa `width` px trên một dòng. */
export function fitSize(text: string, width: number, max: number, min = 24): number {
  const em = estimateEm(text) || 1;
  return Math.max(min, Math.min(max, Math.floor((width / em) * 0.96)));
}

/** Nhãn giao diện theo ngôn ngữ (phần chữ cố định trong cảnh, không phải nội dung bài). */
export const UI_TEXT = {
  vi: { source: 'Nguồn', comment: 'Bình luận cho chúng tôi biết nhé', follow: 'Theo dõi Trang', quoteVia: 'trích', recap: 'Lưu lại', alert: 'CẢNH BÁO', critical: 'KHẨN CẤP', published: 'Ngày đăng', by: 'Tác giả' },
  ja: { source: '出典', comment: 'コメントで教えてください', follow: 'フォローする', quoteVia: '引用', recap: 'まとめ', alert: '注意', critical: '重要', published: '公開日', by: '執筆' },
} as const;
