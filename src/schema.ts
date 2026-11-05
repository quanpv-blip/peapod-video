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
