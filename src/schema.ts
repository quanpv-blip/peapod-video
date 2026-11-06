// Dữ liệu đầu vào của thẻ PeaPod. Khớp với CardInput trong peapod-ai/src/media/card.ts để hai bên dùng chung một hợp đồng.
import { z } from 'zod';

export const cardSchema = z.object({
  market: z.enum(['VN', 'JP']),
  title: z.string().min(1).max(90),
  bullets: z.array(z.string().max(80)).max(3),
  takeaway: z.string().max(160).nullable(),
  source: z.string().max(80),
  date: z.string().max(20),
});

export type CardProps = z.infer<typeof cardSchema>;

export const sampleCard: CardProps = {
  market: 'VN',
  title: 'Chuyển động nổi bật ngành chip bán dẫn',
  bullets: ['FPT vận hành nhà máy kiểm thử chip Bắc Ninh', 'Hãng kim cương Trung Quốc sang chip AI', 'Tranh luận quanh nhu cầu chip nhớ RAM'],
  takeaway: 'Chuỗi giá trị bán dẫn đang mở rộng nhanh nhờ hạ tầng mới và sự tham gia từ nhiều ngành.',
  source: 'VnExpress',
  date: '03/11/2026',
};

// --- Video Reels v2 ---
// Mẫu bố cục: list (danh sách ý, mặc định), focus (mỗi cảnh một ý lớn), alert (tin cảnh báo, tông đỏ).
export const REEL_TEMPLATES = ['list', 'focus', 'alert'] as const;
export type ReelTemplate = (typeof REEL_TEMPLATES)[number];

export const captionSchema = z.object({
  start: z.number().min(0).max(120),
  end: z.number().min(0).max(120),
  text: z.string().max(120),
});
export type Caption = z.infer<typeof captionSchema>;

export const reelSchema = cardSchema.extend({
  template: z.enum(REEL_TEMPLATES).default('list'),
  /** Phụ đề cháy cứng, tính bằng giây từ đầu video. Rỗng thì không hiện phụ đề. */
  captions: z.array(captionSchema).max(60).default([]),
  /** Thời lượng lời đọc (giây). Có thì video dài bằng lời đọc cộng phần mở và kết; không có thì 15 giây. */
  voiceSeconds: z.number().min(3).max(90).nullable().default(null),
  /** Đường dẫn tới tệp âm thanh lời đọc (do dịch vụ render tự gán khi nhận audioBase64). */
  audioUrl: z.string().max(300).nullable().default(null),
  /** Nhạc nền tùy chọn, cũng do dịch vụ gán. */
  musicUrl: z.string().max(300).nullable().default(null),
});
export type ReelProps = z.infer<typeof reelSchema>;

/** Phần dịch vụ nhận thêm ở POST /jobs/reel (không nằm trong props của composition). */
export const reelRequestSchema = reelSchema.omit({ audioUrl: true, musicUrl: true }).extend({
  /** WAV của lời đọc, mã hóa base64 (tối đa ~6 MB). */
  audioBase64: z.string().max(8_000_000).nullable().default(null),
});
export type ReelRequest = z.infer<typeof reelRequestSchema>;

export const sampleReel: ReelProps = {
  ...sampleCard,
  template: 'list',
  captions: [],
  voiceSeconds: null,
  audioUrl: null,
  musicUrl: null,
};
