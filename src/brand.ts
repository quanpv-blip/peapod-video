// Bảng màu và nhãn chung của thẻ PeaPod. Thẻ Satori trong peapod-ai dùng cùng giá trị này (src/media/card.ts) để hai bên không lệch nhau.
export const BRAND = {
  INK: '#1c2024',
  MUTED: '#4b5563',
  SOFT: '#6b7280',
  LINE: '#e5e7eb',
  ACCENT: '#4f46e5', // indigo thương hiệu
  TINT: '#eef2ff', // nền nhạt của khối nhận định
} as const;

// Nhãn theo thị trường (SOP 14, mục 3): JP dùng 出典 và 当社の見方, VN dùng Nguồn và Nhận định của chúng tôi.
export const LABELS = {
  VN: { source: 'Nguồn', takeaway: 'Nhận định của chúng tôi' },
  JP: { source: '出典', takeaway: '当社の見方' },
} as const;
