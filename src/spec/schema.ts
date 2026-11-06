// VideoSpec: hợp đồng dữ liệu đầu vào DUY NHẤT của bộ dựng video. Một file JSON mô tả trọn vẹn một video:
// sự kiện kèm chứng cứ, các cảnh, tư liệu có giấy phép, giọng đọc, nhạc, phụ đề, vùng an toàn và giới hạn kiểm tra.
//
// Nguyên tắc (xem .agents/skills/peapod-videospec):
//  1. Mọi con số hiện trên video phải tham chiếu một `fact` có `evidence.quote` trích nguyên văn từ bài nguồn.
//  2. Schema này chỉ kiểm cấu trúc. Kiểm tra chéo (tham chiếu, khớp chứng cứ, độ dài chữ theo ngôn ngữ, giấy phép)
//     nằm ở validate.ts. Cả hai phải đạt trước khi dựng.
//  3. Mô tả `.describe()` được xuất sang JSON Schema (schemas/video-spec.schema.json) để "đạo diễn AI" sinh đúng định dạng.
import { z } from 'zod';

export const SPEC_VERSION = 1 as const;

export const MARKETS = ['VN', 'JP'] as const;
export const LANGUAGES = ['vi', 'ja'] as const;
export const FORMATS = {
  'reel-9x16': { width: 1080, height: 1920 },
  'portrait-4x5': { width: 1080, height: 1350 },
  'square-1x1': { width: 1080, height: 1080 },
  'wide-16x9': { width: 1920, height: 1080 },
} as const;
export const FPS = 30 as const;

/** Biểu tượng có sẵn trong thư viện cảnh. Thêm biểu tượng mới thì thêm ở đây và ở thành phần Icon. */
export const ICONS = ['shield', 'alert', 'chip', 'cloud', 'server', 'money', 'people', 'globe', 'lock', 'bolt', 'chart', 'clock', 'check', 'mail', 'building', 'factory', 'robot', 'thermometer', 'link', 'document'] as const;

/** Hiệu ứng âm thanh có sẵn từ @remotion/sfx. Chỉ liệt kê những âm đã xác minh trong tài liệu 4.0.540. */
export const SFX = ['whoosh', 'whip', 'ding', 'page-turn', 'switch', 'mouse-click', 'shutter-modern'] as const;

// 'blur' là chuyển cảnh tùy chỉnh (mờ + nhòe + thu nhẹ) giống video mẫu; còn lại là presentation chính thức của @remotion/transitions.
export const TRANSITIONS = ['blur', 'fade', 'slide', 'wipe', 'flip', 'none'] as const;
export const SCENE_KINDS = ['hook', 'stat', 'cards', 'compare', 'timeline', 'chart', 'quote', 'bullets', 'checklist', 'concept', 'process', 'map', 'photo', 'alert', 'recap', 'source', 'cta'] as const;

/** Dấu tách nhịp trong lời đọc: phần tử thứ i của cảnh hiện ra khi đoạn thứ i bắt đầu được đọc. Bị bỏ khi đọc và khi hiện phụ đề. */
export const BEAT_MARK = '|';
export type SceneKind = (typeof SCENE_KINDS)[number];

const Id = z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/, 'id: chữ thường, số, gạch ngang/dưới; bắt đầu bằng chữ; tối đa 40 ký tự');
const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'màu dạng #RRGGBB');
const Text = (max: number) => z.string().trim().min(1).max(max);

// --- Sự kiện (fact) và chứng cứ ---

export const EvidenceSchema = z
  .object({
    url: z.url().max(500).describe('Địa chỉ bài nguồn chứa câu trích.'),
    quote: z.string().trim().min(6).max(600).describe('Câu trích NGUYÊN VĂN từ bài nguồn, chứa con số hoặc phát biểu. Không diễn đạt lại.'),
    paragraph: z.int().min(0).max(200).optional().describe('Số thứ tự đoạn văn trong bài (bắt đầu từ 0), nếu biết.'),
  })
  .strict();

const factBase = { id: Id, evidence: EvidenceSchema };

export const FactSchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...factBase,
      kind: z.literal('number'),
      label: Text(60).describe('Con số này đo cái gì. Ví dụ: "Số địa chỉ email bị lộ".'),
      value: z.number().finite().describe('Giá trị số đã quy đổi. Ví dụ 338万6187 thì 3386187.'),
      raw: Text(40).describe('Đoạn chữ số đúng như trong evidence.quote, ví dụ "338万6187" hoặc "15.000".'),
      unit: z.string().max(12).default('').describe('Đơn vị: 件, 円, %, euro, độ C, người...'),
      approx: z.boolean().default(false).describe('True nếu bài dùng từ xấp xỉ (約, khoảng, hơn...).'),
    })
    .strict(),
  z.object({ ...factBase, kind: z.literal('quote'), text: Text(220).describe('Lời trích nguyên văn.'), speaker: z.string().max(60).optional() }).strict(),
  z.object({ ...factBase, kind: z.literal('date'), label: Text(60), iso: z.iso.date(), raw: Text(30).describe('Ngày đúng như trong bài, ví dụ "2026年11月2日".') }).strict(),
  z.object({ ...factBase, kind: z.literal('claim'), text: Text(200).describe('Khẳng định đã được bài nguồn xác nhận, viết gọn nhưng không đổi nghĩa.') }).strict(),
]);
export type Fact = z.infer<typeof FactSchema>;

// --- Chuyển cảnh, hiệu ứng âm ---

export const TransitionSchema = z
  .object({
    type: z.enum(TRANSITIONS).default('blur'),
    direction: z.enum(['from-left', 'from-right', 'from-top', 'from-bottom']).optional().describe('Chỉ dùng cho slide và wipe.'),
    durationFrames: z.int().min(6).max(36).default(24).describe('Số khung chồng giữa hai cảnh (blur: mờ ra ~1/3, nền trống, hiện vào ~1/2). Lời đọc cảnh sau chỉ bắt đầu khi hình đã hiện.'),
  })
  .strict();

const SfxCue = z.object({ at: z.enum(['start', 'end']).default('start'), sound: z.enum(SFX) }).strict();

// --- Các loại cảnh ---

export const HeadingSchema = z
  .object({
    title: Text(32).describe('Dòng 1 tiêu đề chương, chữ trắng. Ví dụ "Agent".'),
    accent: z.string().trim().max(32).optional().describe('Dòng 2, màu nhấn. Ví dụ "= đạo diễn".'),
    icon: z.enum(ICONS).optional(),
  })
  .strict()
  .describe('Tiêu đề chương ở đầu khung. Các cảnh liền nhau có cùng heading giữ nguyên tiêu đề, không chạy lại hiệu ứng.');

const sceneBase = {
  id: Id,
  heading: HeadingSchema.optional(),
  eyebrow: z.string().trim().max(30).optional().describe('Dòng nhỏ trên tiêu đề, ví dụ "01 — HẬU QUẢ" để đánh số chương.'),
  note: z.string().trim().max(90).optional().describe('Chú thích nhỏ màu xám dưới nội dung, ví dụ "Theo VnExpress, 3/11/2026" hoặc "* Ví dụ minh hoạ".'),
  narration: z
    .object({ text: Text(320).describe(`Lời đọc của riêng cảnh. Dùng "${BEAT_MARK}" để đánh dấu lúc từng phần tử hiện ra.`) })
    .strict()
    .optional()
    .describe('Lời đọc của riêng cảnh này. Độ dài cảnh lấy theo âm thanh thật nếu có.'),
  seconds: z.number().min(1.5).max(15).optional().describe('Gợi ý thời lượng khi không có lời đọc. Có âm thanh thật thì bị ghi đè.'),
  sfx: z.array(SfxCue).max(2).default([]),
  transitionOut: TransitionSchema.optional().describe('Ghi đè chuyển cảnh mặc định khi rời cảnh này.'),
};

const Annotation = z.enum(['circle', 'underline', 'highlight', 'box', 'none']).default('none').describe('Nét vẽ tay nhấn mạnh (rough-notation).');
const FactRef = Id.describe('id của một fact có trong spec.facts.');

export const SceneSchema = z.discriminatedUnion('kind', [
  z
    .object({
      ...sceneBase,
      kind: z.literal('hook'),
      headline: Text(60).describe('Câu mở 3 giây đầu, gợi tò mò, không phóng đại.'),
      sub: z.string().max(90).optional(),
      style: z.enum(['kinetic', 'card']).default('kinetic'),
      icon: z.enum(ICONS).optional(),
    })
    .strict(),
  z
    .object({
      ...sceneBase,
      kind: z.literal('stat'),
      factId: FactRef.describe('Fact dạng number cung cấp con số. KHÔNG nhập số trực tiếp.'),
      label: Text(48).describe('Nhãn nói con số đo cái gì.'),
      display: z.enum(['full', 'compact']).default('full').describe('full giữ nguyên độ chính xác; compact làm tròn (3,39 triệu; 339万).'),
      countUp: z.boolean().default(true),
      annotation: Annotation,
      context: z.string().max(80).optional().describe('Một dòng ngữ cảnh, ví dụ "tăng từ 301万 hôm 29/10".'),
      icon: z.enum(ICONS).optional(),
    })
    .strict(),
  z
    .object({
      ...sceneBase,
      kind: z.literal('compare'),
      title: Text(48),
      items: z.array(z.object({ factId: FactRef, label: Text(32) }).strict()).min(2).max(4),
      mode: z.enum(['bars', 'steps']).default('steps').describe('steps: các mốc nối tiếp (trước, sau); bars: cột so sánh.'),
      display: z.enum(['full', 'compact']).default('compact'),
    })
    .strict(),
  z
    .object({
      ...sceneBase,
      kind: z.literal('timeline'),
      title: z.string().max(48).optional(),
      events: z.array(z.object({ factId: FactRef.optional(), when: Text(24).describe('Mốc thời gian hiển thị, ví dụ "29/10".'), label: Text(60) }).strict()).min(2).max(6),
      orientation: z.enum(['vertical', 'horizontal']).default('vertical'),
    })
    .strict(),
  z
    .object({
      ...sceneBase,
      kind: z.literal('chart'),
      title: Text(48),
      type: z.enum(['bar', 'line', 'donut']),
      series: z.array(z.object({ factId: FactRef, label: Text(24) }).strict()).min(2).max(8),
      display: z.enum(['full', 'compact']).default('compact'),
    })
    .strict(),
  z
    .object({
      ...sceneBase,
      kind: z.literal('quote'),
      factId: FactRef.describe('Fact dạng quote.'),
      attribution: Text(60).describe('Ai nói, ở đâu. Bắt buộc để người xem biết nguồn.'),
      highlight: z.array(Text(40)).max(3).default([]).describe('Cụm từ trong lời trích cần nhấn (phải là chuỗi con của lời trích).'),
    })
    .strict(),
  z
    .object({
      ...sceneBase,
      kind: z.literal('bullets'),
      title: Text(48),
      items: z.array(z.object({ text: Text(72), icon: z.enum(ICONS).optional(), factId: FactRef.optional() }).strict()).min(2).max(5),
    })
    .strict(),
  z
    .object({
      ...sceneBase,
      kind: z.literal('process'),
      title: Text(48),
      steps: z.array(z.object({ label: Text(40), detail: z.string().max(72).optional() }).strict()).min(2).max(6),
      direction: z.enum(['down', 'right']).default('down'),
    })
    .strict(),
  z
    .object({
      ...sceneBase,
      kind: z.literal('map'),
      label: Text(48),
      center: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).strict(),
      zoom: z.number().min(1).max(16).default(8),
      markers: z.array(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), label: Text(32) }).strict()).max(5).default([]),
      provider: z.enum(['maptiler', 'static']).default('static').describe('maptiler cần khóa API; static dùng ảnh bản đồ đã có trong assets.'),
      assetId: Id.optional().describe('Bản đồ tĩnh (khi provider=static).'),
    })
    .strict(),
  z
    .object({
      ...sceneBase,
      kind: z.literal('photo'),
      assetId: Id.describe('id trong spec.assets. Phải có giấy phép dùng thương mại.'),
      motion: z.enum(['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'still']).default('zoom-in'),
      caption: z.string().max(80).optional(),
      credit: z.boolean().default(true).describe('Hiện dòng ghi nguồn ảnh nếu giấy phép yêu cầu.'),
    })
    .strict(),
  z
    .object({
      ...sceneBase,
      kind: z.literal('cards'),
      items: z
        .array(z.object({ factId: FactRef.describe('Fact dạng number.'), label: Text(40), tone: z.enum(['accent', 'gold', 'violet', 'mint']).optional() }).strict())
        .min(2)
        .max(4)
        .describe('Các thẻ số liệu xếp chồng, mỗi thẻ một con số đếm lên. Màu viền tự xoay vòng nếu không chỉ định.'),
      display: z.enum(['full', 'compact']).default('compact'),
    })
    .strict(),
  z
    .object({
      ...sceneBase,
      kind: z.literal('checklist'),
      items: z.array(z.object({ text: Text(40), icon: z.enum(ICONS).optional() }).strict()).min(3).max(8).describe('Các bước được đánh dấu xong lần lượt, bước đang nói được làm nổi.'),
    })
    .strict(),
  z
    .object({
      ...sceneBase,
      kind: z.literal('concept'),
      chips: z.array(z.object({ text: Text(24), icon: z.enum(ICONS).optional() }).strict()).min(3).max(7).describe('Các khái niệm bay quanh tâm.'),
      result: Text(48).describe('Câu kết quả hiện ra khi các chip gộp lại, ví dụ "= một hệ thống điều khiển từ xa".'),
      icon: z.enum(ICONS).optional(),
    })
    .strict(),
  z
    .object({
      ...sceneBase,
      kind: z.literal('recap'),
      items: z.array(z.object({ text: Text(56), icon: z.enum(ICONS).optional() }).strict()).min(2).max(5).describe('Tóm tắt "lưu lại" cuối video.'),
    })
    .strict(),
  z
    .object({
      ...sceneBase,
      kind: z.literal('alert'),
      level: z.enum(['warning', 'critical']).default('warning'),
      factId: FactRef.optional().describe('Fact dạng claim làm căn cứ cho cảnh báo.'),
      title: Text(48),
      points: z.array(Text(72)).min(1).max(3),
    })
    .strict(),
  z
    .object({
      ...sceneBase,
      kind: z.literal('source'),
      factId: FactRef.optional().describe('Fact dạng date: ngày công bố của số liệu.'),
    })
    .strict()
    .describe('Thẻ nguồn: tên báo, tiêu đề, ngày. Lấy từ spec.source. Bắt buộc có ít nhất một cảnh này.'),
  z
    .object({
      ...sceneBase,
      kind: z.literal('cta'),
      question: Text(90).describe('Câu hỏi mở để người xem bình luận. Không "theo dõi Fanpage" chung chung.'),
      hashtags: z.array(Text(30)).max(5).default([]),
    })
    .strict(),
]);
export type Scene = z.infer<typeof SceneSchema>;

// --- Tư liệu (ảnh, video, âm thanh) có giấy phép ---

export const LicenseSchema = z
  .object({
    name: Text(60).describe('Tên giấy phép hoặc nguồn, ví dụ "Pexels License", "Tự tạo", "Gemini (AI)".'),
    commercialUse: z.boolean().describe('Được dùng thương mại không. False thì validate.ts từ chối.'),
    attributionRequired: z.boolean().default(false),
    attributionText: z.string().max(120).optional(),
    url: z.url().max(300).optional(),
  })
  .strict();

export const AssetSchema = z
  .object({
    id: Id,
    type: z.enum(['image', 'video', 'audio', 'lottie']),
    origin: z.enum(['stock', 'ai', 'brand', 'upload', 'generated']),
    provider: z.string().max(40).optional(),
    src: z.string().regex(/^(https:\/\/|public\/|assets\/)/, 'src: https:// hoặc đường dẫn public/ hoặc assets/').max(500),
    alt: z.string().max(120).optional(),
    width: z.int().min(1).max(8000).optional(),
    height: z.int().min(1).max(8000).optional(),
    durationSeconds: z.number().min(0.1).max(600).optional(),
    aiGenerated: z.boolean().default(false).describe('True với ảnh/video do AI sinh: bắt buộc gắn cờ AI (D-11).'),
    license: LicenseSchema,
  })
  .strict();
export type Asset = z.infer<typeof AssetSchema>;

// --- Âm thanh, phụ đề, bố cục ---

export const NarrationSchema = z
  .object({
    enabled: z.boolean().default(true),
    provider: z.enum(['gemini', 'elevenlabs']).default('gemini'),
    voice: z.string().max(60).optional(),
    rate: z.number().min(0.8).max(1.3).default(1),
  })
  .strict();

export const MusicSchema = z
  .object({
    assetId: Id.describe('Bản nhạc trong spec.assets (type=audio, giấy phép dùng thương mại).'),
    volume: z.number().min(0).max(1).default(0.12),
    duckDb: z.number().min(-24).max(-3).default(-12).describe('Hạ nhạc bao nhiêu dB khi có lời đọc.'),
  })
  .strict();

export const CaptionsSchema = z
  .object({
    enabled: z.boolean().default(true),
    style: z.enum(['karaoke', 'tiktok', 'subtitle']).default('karaoke').describe('karaoke: từ đang đọc có ô nền màu nhấn (như video mẫu).'),
    position: z.enum(['safe-lower', 'center']).default('safe-lower'),
    maxWordsPerPage: z.int().min(2).max(8).default(5).describe('Video mẫu: tối đa 5 từ, một dòng.'),
    highlight: Hex.optional(),
    timing: z.enum(['alignment', 'estimated']).default('alignment').describe('alignment: mốc thật từ âm thanh (Whisper/ElevenLabs). estimated: ước lượng theo ký tự, kém chính xác.'),
  })
  .strict();

export const SafeAreaSchema = z
  .object({
    top: z.int().min(0).max(600).default(210),
    bottom: z.int().min(0).max(600).default(320),
    left: z.int().min(0).max(300).default(60),
    right: z.int().min(0).max(300).default(120),
  })
  .strict()
  .describe('Lề an toàn (px, trên khung 1080×1920) tránh giao diện Reels đè lên. ⚠️ Số mặc định từ một nguồn bên thứ ba, cần kiểm trên máy thật.');

export const ThemeSchema = z
  .object({
    palette: z.enum(['ember', 'indigo', 'ink', 'alert']).default('ember').describe('ember: cam ấm như video mẫu; alert: đỏ cho tin sự cố.'),
    background: z.enum(['aurora', 'grid', 'solid', 'noise']).default('grid'),
    accent: Hex.optional(),
    chapterColors: z.boolean().default(true).describe('Đổi màu nhấn theo chương như video mẫu. Bảng "alert" luôn giữ màu đỏ.'),
  })
  .strict();

export const SourceSchema = z
  .object({
    outlet: Text(60).describe('Tên báo hoặc trang, ví dụ "VnExpress".'),
    title: Text(160),
    url: z.url().max(500),
    publishedAt: z.iso.date().optional(),
    author: z.string().max(60).optional(),
  })
  .strict();

export const QaLimitsSchema = z
  .object({
    minSeconds: z.number().min(5).max(120).default(30),
    maxSeconds: z.number().min(10).max(180).default(60),
    maxScenes: z.int().min(3).max(18).default(16),
  })
  .strict();

// --- VideoSpec ---

export const VideoSpecSchema = z
  .object({
    version: z.literal(SPEC_VERSION),
    id: Id.describe('id duy nhất của video, thường là "p<id bài>-r<bản>" nhưng viết thường.'),
    market: z.enum(MARKETS),
    language: z.enum(LANGUAGES).describe('VN phải là vi, JP phải là ja.'),
    format: z.enum(['reel-9x16', 'portrait-4x5', 'square-1x1', 'wide-16x9']).default('reel-9x16'),
    fps: z.literal(FPS).default(FPS),
    theme: ThemeSchema.default(() => ThemeSchema.parse({})),
    source: SourceSchema,
    facts: z.array(FactSchema).max(24).default([]),
    scenes: z.array(SceneSchema).min(3).max(18),
    assets: z.array(AssetSchema).max(40).default([]),
    narration: NarrationSchema.default(() => NarrationSchema.parse({})),
    music: MusicSchema.nullable().default(null),
    captions: CaptionsSchema.default(() => CaptionsSchema.parse({})),
    transition: TransitionSchema.default(() => TransitionSchema.parse({})).describe('Chuyển cảnh mặc định giữa các cảnh.'),
    safeArea: SafeAreaSchema.default(() => SafeAreaSchema.parse({})),
    qa: QaLimitsSchema.default(() => QaLimitsSchema.parse({})),
  })
  .strict();

/** Dạng người viết/AI sinh ra (còn thiếu các trường có mặc định). */
export type VideoSpecInput = z.input<typeof VideoSpecSchema>;
/** Dạng sau khi đã điền mặc định, dùng trong composition và dịch vụ dựng. */
export type VideoSpec = z.output<typeof VideoSpecSchema>;
