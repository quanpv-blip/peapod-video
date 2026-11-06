# peapod-video

Thẻ ảnh và video Reels của PeaPod dựng bằng Remotion **4.0.540** (ghim đúng số phiên bản, không dùng `^`). Dịch vụ HTTP `src/render-service.ts` được worker PeaPod (`../peapod-ai`) gọi.

## Cấu trúc
- `src/PeaPodCard.tsx`: thẻ 1080×1350. `src/PeaPodReel.tsx`: video 1080×1920, 30 fps.
- Reel có 3 mẫu (`list`, `focus`, `alert`), phụ đề cháy cứng, lời đọc (`audioUrl`) và nhạc nền (`musicUrl`, chưa có nhạc đã kiểm bản quyền). Độ dài = lời đọc + 3 giây mở + 3 giây kết; không có lời đọc thì 15 giây (`calculateMetadata` trong `Root.tsx`).
- `src/schema.ts`: hợp đồng dữ liệu (zod), **phải khớp** `CardInput` trong `../peapod-ai/src/media/card.ts`. `src/brand.ts`: màu/nhãn, Satori ở peapod-ai dùng cùng giá trị. Đổi một bên thì đổi bên kia.
- Skill Remotion: `.agents/skills/remotion-markup`.

## Chạy và kiểm tra
- Dịch vụ: `npm run serve` (cổng 4100, cần `.env` có `RENDER_TOKEN` ≥ 32 ký tự trùng `REMOTION_RENDER_TOKEN` của peapod-ai). **Chạy trong cửa sổ riêng**; Ctrl+C hoặc đóng cửa sổ là dịch vụ tắt. Dùng `curl.exe http://127.0.0.1:4100/health` kiểm tra.
- Chạy thử bản mới mà không đụng dịch vụ đang chạy: `RENDER_PORT=4101 RENDER_HOST=127.0.0.1` với token tạm, xong thì tắt tiến trình đó.
- Studio: `npm run studio` (cổng 3100). Kiểm kiểu: `npx tsc --noEmit`.
- Xem một khung hình: `npx remotion still src/index.ts PeaPodReel out.png --frame=210 --props=props.json`.
- Kiểm MP4: `npx remotion ffprobe file.mp4`, trích khung: `npx remotion ffmpeg -ss 6 -i file.mp4 -frames:v 1 f.png`.
- Test tự động có cho phần spec và số (`npm test`). Bố cục composition **chưa** có test tự động: dựng thật rồi **xem ảnh**, kiểm tra cả tiếng Việt lẫn tiếng Nhật.

## Video Engine (đường VideoSpec): đọc trước khi làm video
Cổng vào là kỹ năng `peapod-video-engine` (nằm ở `.agents/skills`, liên kết ở `.claude/skills`). Đầu vào duy nhất của đường mới là **VideoSpec** (`src/spec/schema.ts`), kiểm bằng `src/spec/validate.ts`; số VN/JP ở `src/spec/numbers.ts`.
- Kiểm tra thiết lập: `npm run doctor` (phải báo "Thiết lập đạt"). Test: `npm test`. Kiểm spec: `npm run spec:validate`. Xuất schema và bảng kê: `npm run manifest`.
- Bảng kê mọi thành phần, gói, kỹ năng, biến môi trường, quyết định mở: `src/spec/manifest.ts` (nguồn sự thật; cập nhật ở đó khi thêm bất cứ thứ gì).
- **Trạng thái:** hợp đồng dữ liệu, bộ kiểm tra, mẫu và kỹ năng đã xong. **13 loại cảnh chưa có thành phần dựng** (`status: 'spec'` trong manifest).
- Bất biến: không con số nào trên video thiếu fact và câu trích nguyên văn; mọi gói Remotion cùng `4.0.540`; không tải hay chạy chương trình từ Internet khi chưa được đồng ý; không đụng dịch vụ cổng 4100 (thử ở 4101).
- Kỹ năng chính thức sao từ kho `../remotion` (tag v4.0.540). Trên Windows các liên kết chéo là symlink git bị thành tệp văn bản: phải thay bằng junction (xem kỹ năng `peapod-video-setup`).
- Khi sửa tệp có dấu huyền hoặc dấu ngoặc: dùng công cụ Edit/Write, **không** nhúng vào `node -e "..."` của shell (dấu huyền sẽ bị shell chạy như lệnh).

## API
- `GET /health`, `POST /render/card` (PNG), `POST /jobs/reel` (nhận thêm `template`, `captions`, `voiceSeconds`, `audioBase64`), `GET|DELETE /jobs/:id`, `GET /jobs/:id/video`.
- Mọi endpoint trừ `/health` cần header `X-Render-Token`. Hàng đợi job tối đa 20 (429 khi đầy). Job nằm trong RAM, khởi động lại là mất.
- Endpoint đồng bộ `/render/reel` đã bị xóa; đừng thêm lại.
- Âm thanh tạm được phục vụ tại `/audio/<uuid>.wav`, chỉ nhận yêu cầu từ chính máy render.

## Lưu ý
- Font: `NotoVN`, `NotoJP` nạp từ `public/fonts`. Phần tử nằm ngoài khung chính (ví dụ phụ đề) phải tự đặt `fontFamily`, nếu không sẽ rơi về font có chân.
- Âm thanh phải bọc trong `<Sequence from={INTRO}>` để khớp với phụ đề và cảnh.
- Gói `@remotion/captions` và `@remotion/install-whisper-cpp` đã cài để dựng phụ đề bằng Whisper (mốc thời gian thật). **Chưa dùng, chưa tải model, chưa kiểm chứng với tiếng Nhật.**
- Giấy phép Remotion (D-08, chốt 2026-11-06): dự án cá nhân, 1–2 người → Free License. Báo người dùng xét lại nếu vượt 3 người hoặc giao cho công ty.
- Không commit `*.log`, `.env`, `out/`.
