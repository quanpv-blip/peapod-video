// Bảng kê đầu vào của Video Engine: mọi thứ cần có để thiết lập và vận hành. Một nguồn sự thật duy nhất.
// `npm run doctor` đọc bảng này để kiểm tra máy; `npm run manifest` xuất ra video-engine.manifest.json cho người và công cụ khác.
// Trạng thái cảnh: 'spec' = đã có hợp đồng dữ liệu và kiểm tra nhưng CHƯA có thành phần dựng; 'built' = đã dựng và có ảnh chuẩn.
import { SCENE_KINDS, type SceneKind } from './schema.ts';

export const REMOTION_VERSION = '4.0.540';

export interface SceneEntry {
  kind: SceneKind;
  title: string;
  purpose: string;
  /** Trường đầu vào chính của cảnh trong VideoSpec. */
  input: string[];
  /** Loại tư liệu hoặc fact cảnh cần. */
  needs: string[];
  packages: string[];
  /** Loại bài hợp với cảnh. */
  bestFor: string;
  /** spec: mới mô tả; built: có mã nhưng chưa xem ảnh; verified: đã dựng ảnh từ mẫu và xem bằng mắt. */
  status: 'spec' | 'built' | 'verified';
}

export const SCENE_CATALOG: SceneEntry[] = [
  { kind: 'hook', title: 'Mở đầu', purpose: 'Giữ người xem trong 3 giây đầu bằng một câu gợi tò mò, không phóng đại.', input: ['headline', 'sub', 'style', 'icon'], needs: [], packages: ['@remotion/layout-utils', '@remotion/animation-utils'], bestFor: 'mọi bài', status: 'verified' },
  { kind: 'stat', title: 'Con số lớn', purpose: 'Một con số đếm lên, khoanh bằng nét vẽ tay, có nhãn và ngữ cảnh.', input: ['factId', 'label', 'display', 'countUp', 'annotation', 'context'], needs: ['fact:number'], packages: ['@remotion/rough-notation', '@remotion/layout-utils'], bestFor: 'tin có số liệu nổi bật (quy mô vụ rò rỉ, thiệt hại, doanh thu)', status: 'verified' },
  { kind: 'compare', title: 'So sánh / cập nhật', purpose: 'Hai đến bốn mốc cùng đơn vị: trước và sau, hoặc các lần công bố.', input: ['title', 'items[].factId', 'mode', 'display'], needs: ['fact:number (cùng đơn vị)'], packages: ['@remotion/shapes', '@remotion/animation-utils'], bestFor: 'số liệu được cập nhật nhiều lần, so sánh hai đối tượng', status: 'verified' },
  { kind: 'timeline', title: 'Dòng thời gian', purpose: 'Hai đến sáu sự kiện nối tiếp theo ngày.', input: ['events[].when', 'events[].label', 'orientation'], needs: ['fact:date (tùy chọn)'], packages: ['@remotion/paths', '@remotion/shapes'], bestFor: 'sự cố diễn biến theo ngày, lộ trình sản phẩm', status: 'verified' },
  { kind: 'chart', title: 'Biểu đồ', purpose: 'Cột, đường hoặc vành khuyên từ các fact cùng đơn vị.', input: ['type', 'series[].factId', 'display'], needs: ['fact:number (cùng đơn vị)'], packages: ['@remotion/shapes', '@remotion/paths'], bestFor: 'phần trăm, thị phần, xu hướng', status: 'verified' },
  { kind: 'quote', title: 'Trích dẫn', purpose: 'Lời trích nguyên văn có người nói và nguồn; cụm then chốt được nhấn.', input: ['factId', 'attribution', 'highlight'], needs: ['fact:quote'], packages: ['@remotion/rough-notation'], bestFor: 'phát biểu của người trong cuộc', status: 'verified' },
  { kind: 'bullets', title: 'Các ý chính', purpose: 'Hai đến năm ý ngắn, mỗi ý có biểu tượng, có thể gắn fact.', input: ['title', 'items[].text', 'items[].icon'], needs: [], packages: ['@remotion/animation-utils', '@remotion/lottie (tùy chọn)'], bestFor: 'tóm tắt phạm vi ảnh hưởng, khuyến nghị', status: 'verified' },
  { kind: 'process', title: 'Quy trình / cơ chế', purpose: 'Hai đến sáu bước nối nhau, vẽ đường dẫn theo thời gian.', input: ['title', 'steps[]', 'direction'], needs: [], packages: ['@remotion/paths', '@remotion/shapes'], bestFor: 'giải thích cách một cuộc tấn công lan ra, cách một công nghệ hoạt động', status: 'verified' },
  { kind: 'map', title: 'Bản đồ', purpose: 'Địa điểm của sự kiện, có đánh dấu.', input: ['label', 'center', 'zoom', 'markers', 'provider', 'assetId'], needs: ['asset:image (static) hoặc khóa MAPTILER_API_KEY'], packages: ['@remotion/maptiler (chưa cài)'], bestFor: 'tin có địa điểm: nhà máy, trung tâm dữ liệu, quốc gia', status: 'built' },
  { kind: 'photo', title: 'Ảnh minh họa', purpose: 'Ảnh có chuyển động nhẹ và dòng ghi nguồn khi giấy phép yêu cầu.', input: ['assetId', 'motion', 'caption', 'credit'], needs: ['asset:image (giấy phép thương mại)'], packages: ['remotion', '@remotion/effects (chưa cài)'], bestFor: 'tin cần hình ảnh thực tế', status: 'built' },
  { kind: 'alert', title: 'Cảnh báo', purpose: 'Tông đỏ cho tin sự cố, tối đa ba điểm hệ quả.', input: ['level', 'title', 'points'], needs: [], packages: ['@remotion/light-leaks', '@remotion/noise'], bestFor: 'tin sự cố an ninh mạng', status: 'verified' },
  { kind: 'source', title: 'Thẻ nguồn', purpose: 'Tên báo, tiêu đề và ngày lấy từ spec.source. Bắt buộc có.', input: ['note'], needs: ['spec.source'], packages: [], bestFor: 'mọi bài', status: 'verified' },
  { kind: 'cta', title: 'Kêu gọi thảo luận', purpose: 'Một câu hỏi mở cuối video để người xem bình luận.', input: ['question', 'hashtags'], needs: [], packages: [], bestFor: 'mọi bài', status: 'verified' },
  { kind: 'cards', title: 'Thẻ số', purpose: 'Hai đến bốn thẻ, mỗi thẻ một con số đếm lên kèm nhãn; cỡ số chung theo số dài nhất.', input: ['items[].factId', 'items[].label', 'items[].tone', 'display'], needs: ['fact:number'], packages: ['@remotion/animation-utils'], bestFor: 'nhiều con số song song (số nạn nhân, số cửa hàng, số quốc gia)', status: 'verified' },
  { kind: 'checklist', title: 'Danh sách kiểm', purpose: 'Ba đến tám bước được đánh dấu xong lần lượt theo nhịp lời đọc, bước đang nói được làm nổi.', input: ['items[].text', 'items[].icon'], needs: [], packages: ['@remotion/paths'], bestFor: 'khuyến nghị cho doanh nghiệp', status: 'verified' },
  { kind: 'concept', title: 'Gộp khái niệm', purpose: 'Ba đến bảy chip khái niệm bay quanh tâm rồi gộp lại thành một câu kết quả.', input: ['chips[].text', 'chips[].icon', 'result', 'icon'], needs: [], packages: [], bestFor: 'thuật ngữ kỹ thuật người đọc B2B có thể chưa biết', status: 'verified' },
  { kind: 'recap', title: 'Tóm tắt', purpose: 'Hai đến năm ý "lưu lại" cuối video, trước thẻ nguồn.', input: ['items[].text', 'items[].icon'], needs: [], packages: [], bestFor: 'bài dài, nhiều chương', status: 'verified' },
];

// Kiểm tra bảng kê luôn đủ mọi loại cảnh trong schema.
export const CATALOG_COMPLETE = SCENE_KINDS.every((k) => SCENE_CATALOG.some((e) => e.kind === k));

/** Thành phần dùng chung mà các cảnh cần (chưa dựng). */
export const PRIMITIVES = [
  { name: 'SafeArea', purpose: 'Bọc nội dung trong lề an toàn từ spec.safeArea; kiểm tra tràn bằng đo thật.' },
  { name: 'Theme', purpose: 'Bảng màu, nền (lưới, nhiễu, vệt sáng) theo spec.theme và thị trường.' },
  { name: 'FitText', purpose: 'Chữ tự co theo khung bằng @remotion/layout-utils, đúng với cả tiếng Việt và tiếng Nhật.' },
  { name: 'CountUp', purpose: 'Đếm số lên bằng formatNumber (VN: 3.386.187; JP: 338万6187), không dùng định dạng của trình duyệt.' },
  { name: 'Annotate', purpose: 'Bọc rough-notation: khoanh, gạch chân, tô sáng, khung theo tiến trình.' },
  { name: 'Icon', purpose: 'Bộ biểu tượng ICONS dạng SVG nét thống nhất.' },
  { name: 'CaptionsLayer', purpose: 'Phụ đề kiểu TikTok từ @remotion/captions, tôn trọng vùng an toàn.' },
  { name: 'SceneFrame', purpose: 'Khung chung cho cảnh: nền, tiêu đề phụ, dòng nguồn, hiệu ứng vào/ra.' },
  { name: 'AudioMix', purpose: 'Giọng đọc theo cảnh, nhạc nền có hạ âm (ducking), hiệu ứng âm; dùng @remotion/media.' },
  { name: 'SpecVideo', purpose: 'Composition gốc: đọc VideoSpec, dựng TransitionSeries, tính thời lượng bằng calculateMetadata.' },
] as const;

/** Gói Remotion bắt buộc cho phần đã làm. Tất cả phải cùng đúng một phiên bản. */
export const REQUIRED_PACKAGES = [
  'remotion', '@remotion/bundler', '@remotion/renderer', '@remotion/cli', '@remotion/fonts', '@remotion/google-fonts',
  '@remotion/transitions', '@remotion/media', '@remotion/layout-utils', '@remotion/rough-notation', '@remotion/shapes',
  '@remotion/paths', '@remotion/animation-utils', '@remotion/light-leaks', '@remotion/sfx', '@remotion/noise',
  '@remotion/media-utils', '@remotion/captions',
] as const;

/** Gói sẽ cần ở các đợt sau, CHƯA cài. Cài đúng REMOTION_VERSION khi tới đợt tương ứng. */
export const PLANNED_PACKAGES = [
  { name: '@remotion/player', when: 'V5: trình biên tập xem trước trong PeaPod' },
  { name: '@remotion/lottie', when: 'V4: biểu tượng động' },
  { name: '@remotion/maptiler', when: 'V4: cảnh bản đồ (cần MAPTILER_API_KEY, quyết định ❓)' },
  { name: '@remotion/effects', when: 'V4: blur/mirror trên ảnh (cần kiểm WebGL khi dựng không GPU)' },
  { name: '@remotion/elevenlabs', when: 'V2: nếu chọn ElevenLabs cho giọng và timestamp (quyết định ❓)' },
  { name: '@remotion/openai-whisper', when: 'V2: nếu chọn Whisper API để căn phụ đề (quyết định ❓)' },
] as const;

/** Kỹ năng cần có trong .agents/skills (liên kết sang .claude/skills). */
export const OFFICIAL_SKILLS = [
  'remotion-best-practices', 'remotion-markup', 'remotion-captions', 'remotion-interactivity', 'remotion-multimedia',
  'remotion-render', 'remotion-studio', 'remotion-docs', 'remotion-license', 'remotion-upgrade', 'remotion-saas', 'remotion-create', 'remotion-maps',
] as const;
export const PROJECT_SKILLS = [
  'peapod-video-engine', 'peapod-video-setup', 'peapod-videospec', 'peapod-scene-authoring', 'peapod-video-qa', 'peapod-assets-and-legal',
] as const;

export const FONTS = [
  'noto-sans-vietnamese-400-normal.woff', 'noto-sans-vietnamese-700-normal.woff',
  'noto-sans-jp-japanese-400-normal.woff', 'noto-sans-jp-japanese-700-normal.woff',
] as const;

export const ENV_VARS = [
  { name: 'RENDER_TOKEN', where: 'peapod-video/.env', required: true, note: '≥ 32 ký tự, trùng REMOTION_RENDER_TOKEN của peapod-ai. Không in ra, không commit.' },
  { name: 'RENDER_PORT', where: 'peapod-video/.env', required: false, note: 'Mặc định 4100.' },
  { name: 'RENDER_HOST', where: 'peapod-video/.env', required: false, note: 'Mặc định 0.0.0.0; nên 127.0.0.1 khi chỉ chạy cùng máy.' },
  { name: 'RENDER_CONCURRENCY', where: 'peapod-video/.env', required: false, note: 'Số lần dựng đồng thời, mặc định 2.' },
  { name: 'REMOTION_RENDER_URL', where: 'peapod-ai/.env', required: true, note: 'Địa chỉ dịch vụ dựng, ví dụ http://host.docker.internal:4100.' },
  { name: 'REMOTION_RENDER_TOKEN', where: 'peapod-ai/.env', required: true, note: 'Trùng RENDER_TOKEN.' },
  { name: 'GEMINI_API_KEY', where: 'peapod-ai/.env', required: false, note: 'Cho lời đọc và đạo diễn AI. Có hạn mức ngày, xem trang Hạn mức.' },
  { name: 'PEXELS_API_KEY', where: 'peapod-video/.env', required: false, note: 'Ảnh/video stock. Chưa dùng; cần quyết định ❓ và đối chiếu giấy phép.' },
  { name: 'MAPTILER_API_KEY', where: 'peapod-video/.env', required: false, note: 'Cảnh bản đồ. Chưa dùng; cần quyết định ❓.' },
  { name: 'AZURE_SPEECH_KEY', where: 'peapod-ai/.env', required: false, note: 'Giọng đọc đã chọn (VOICE): Azure Speech gói Free F0. Khóa của tài nguyên Speech trên Azure Portal. Không in ra.' },
  { name: 'AZURE_SPEECH_REGION', where: 'peapod-ai/.env', required: false, note: 'Vùng của tài nguyên Speech, ví dụ southeastasia hoặc japaneast.' },
  { name: 'ELEVENLABS_API_KEY', where: 'peapod-video/.env', required: false, note: 'Không dùng (đã chọn Azure; gói Free ElevenLabs cấm thương mại).' },
] as const;

export const TOOLS = [
  { name: 'Playwright MCP', status: 'đã nối', use: 'Xem giao diện thật, chụp ảnh, trích dữ liệu bài nguồn bằng trình duyệt.' },
  { name: 'Context7 MCP', status: 'đã nối', use: `Tra tài liệu Remotion đúng phiên bản ${REMOTION_VERSION} (libraryId /remotion-dev/remotion/v${REMOTION_VERSION}).` },
  { name: 'Remotion CLI', status: 'có', use: 'npx remotion still / render / compositions / ffmpeg / ffprobe.' },
  { name: 'vitest', status: 'có', use: 'Test spec, bộ phân tích số, kiểm tra chứng cứ.' },
  { name: 'whisper.cpp', status: 'chưa cài', use: 'Căn phụ đề theo âm thanh. Cần bạn cho phép tải chương trình và model từ Internet (đã bị chặn khi tự chạy).' },
  { name: 'Exa / Firecrawl MCP', status: 'chưa cài', use: 'Tìm kiếm sâu và đọc trang đầy đủ khi nghiên cứu nội dung. Không cần cho việc dựng.' },
] as const;

export const DECIDED = [
  { id: 'D-08', date: '2026-11-06', decision: 'Remotion Free License: dự án cá nhân, 1–2 người dùng. Xét lại nếu vượt 3 người hoặc giao cho công ty.' },
  { id: 'VOICE', date: '2026-11-06', decision: 'Azure Speech gói Free F0 (0,5 triệu ký tự/tháng, được dùng thương mại). Giọng vi-VN-HoaiMyNeural / NamMinhNeural, ja-JP-NanamiNeural / KeitaNeural. Chưa có khóa.' },
  { id: 'ALIGN', date: '2026-11-06', decision: 'Mốc phụ đề lấy từ sự kiện WordBoundary của Azure, không căn lại bằng Whisper.' },
] as const;

export const OPEN_DECISIONS = [
  { id: 'D-09/D-10', topic: 'Chính sách ảnh bài báo, ảnh stock, nhạc nền, bản quyền' },
  { id: 'D-11', topic: 'Gắn cờ AI cho ảnh/video/giọng do AI sinh' },
  { id: 'KEYS', topic: 'Khóa API cho Pexels và MapTiler' },
  { id: 'SAFE', topic: 'Xác nhận vùng an toàn Reels từ tài liệu Instagram (hiện ⚠️ nguồn bên thứ ba)' },
] as const;

export const MANIFEST = {
  remotionVersion: REMOTION_VERSION,
  scenes: SCENE_CATALOG,
  primitives: PRIMITIVES,
  requiredPackages: REQUIRED_PACKAGES,
  plannedPackages: PLANNED_PACKAGES,
  skills: { official: OFFICIAL_SKILLS, project: PROJECT_SKILLS },
  fonts: FONTS,
  env: ENV_VARS,
  tools: TOOLS,
  decided: DECIDED,
  openDecisions: OPEN_DECISIONS,
};
