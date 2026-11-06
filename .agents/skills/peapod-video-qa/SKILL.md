---
name: peapod-video-qa
description: Kiểm chất lượng video và cảnh của peapod-video: test, ảnh chuẩn từng cảnh, ffprobe, trích khung, vùng an toàn, kiểm số liệu, quy trình thử dịch vụ dựng an toàn, mẫu báo cáo. Dùng trước khi báo "xong" bất kỳ thay đổi nào về video.
---

# Kiểm chất lượng video

Quy tắc chung: **chưa xem tận mắt thì chưa được báo là đúng.** Chạy lệnh rồi đọc kết quả thật; với hình ảnh thì mở ảnh. Kiểm cả **tiếng Việt lẫn tiếng Nhật**.

## Tầng 1: tự động, chạy nhanh (mỗi thay đổi)

```
npm run typecheck
npm test                 # số VN/JP, VideoSpec, chứng cứ, giấy phép
npm run spec:validate    # mọi mẫu phải 0 lỗi
npm run doctor           # môi trường, phiên bản, kỹ năng
```
Đã bắt được lỗi thật: số Nhật cắt sai (338万6187), `\b` không nhận chữ có dấu (`tỷ`), ngày "3/11/2026" bị đọc thành số 2026. Khi sửa luật, thêm test chặn đúng lỗi đó.

## Tầng 2: ảnh chuẩn từng cảnh (khi dựng/sửa cảnh)

Dựng một khung hình của composition với props từ một spec:
```
npx remotion still src/index.ts <CompositionId> out/<ten>.png --frame=<N> --props=<tep.json>
```
- Chọn khung ở **trạng thái ổn định** của cảnh (sau hiệu ứng vào), và thêm một khung giữa chuyển cảnh.
- Dựng cho: spec VN, spec JP, và chuỗi dài nhất của từng ngân sách (kiểm tràn).
- **Mở ảnh và xem**: chữ có tràn, bị cắt, nằm ngoài vùng an toàn, sai font (font có chân = thiếu `fontFamily`), số sai định dạng.
- Khi nâng phiên bản Remotion hoặc đổi mẫu: dựng lại toàn bộ và so sánh với bản trước.
- Ghi chú: bộ ảnh chuẩn tự động (so khớp pixel) **chưa có**; hiện kiểm bằng mắt.

## Tầng 3: video hoàn chỉnh

Dùng **dịch vụ thử ở cổng 4101**, không đụng dịch vụ đang chạy ở 4100:
```
RENDER_TOKEN=<token tạm ≥ 32 ký tự> RENDER_PORT=4101 RENDER_HOST=127.0.0.1 npx tsx src/render-service.ts
```
Chờ `/health` có `"ready":true`, gửi `POST /jobs/reel`, thăm dò `GET /jobs/<id>`, tải `GET /jobs/<id>/video`. **Xong thì tắt đúng tiến trình giữ cổng 4101** (tìm bằng `netstat -ano | findstr :4101`).

Kiểm tệp MP4 (đã dùng thật):
```
npx remotion ffprobe file.mp4                                   # thời lượng, codec, độ phân giải, luồng âm thanh
npx remotion ffmpeg -y -ss <giây> -i file.mp4 -frames:v 1 f.png  # trích khung để xem
```
Phải thấy: H.264, 1080×1920 (với `reel-9x16`), có luồng AAC khi có lời đọc, thời lượng bằng lời đọc cộng phần mở/kết (hoặc tổng cảnh trừ chuyển cảnh với đường VideoSpec).

## Kiểm theo từng khía cạnh

| Khía cạnh | Cách kiểm | Trạng thái |
|---|---|---|
| Số liệu khớp bài nguồn | `validateSpec`: `evidence-*`, `number-*` | ✅ có |
| Giấy phép tư liệu, cờ AI | `validateSpec`: `license`, `ai-flag` | ✅ có |
| Thời lượng | `estimatedSeconds` + `ffprobe` thật | ✅ ước tính / ✅ thật |
| Vùng an toàn | Xem ảnh chuẩn với lớp phủ lề; kiểm chữ nằm trong `safeArea` | ⚠️ thủ công; công cụ tự động chưa có |
| Chữ tràn | Đo bằng `measureText` khi dựng cảnh; xem ảnh chuẩn chuỗi dài nhất | ⚠️ thủ công |
| Âm lượng | Chuẩn hóa loudness bằng ffmpeg | ❌ chưa làm |
| Đồng bộ phụ đề–tiếng | Nghe và xem một đoạn; mốc ước lượng có thể lệch | ⚠️ thủ công |
| Giọng đọc tiếng Nhật | Người Nhật bản xứ nghe (cổng G-3) | ❓ chưa làm |
| Hiệu năng dựng | Đo `ms` ở log dịch vụ (`render reel job`); video 16 giây mất khoảng 12 giây trên máy dev | ✅ đã đo một lần |

## Điều không được làm khi kiểm

- Không gọi API tốn hạn mức (Gemini TTS/sinh bài) chỉ để thử. Dùng WAV mẫu ở `peapod-ai/poc/out/` (`e2e-VN.wav`, `e2e-JP.wav`).
- Không đăng lên Page thật. Không gọi API ghi của Meta.
- Không đọc hay in `.env`. Không dán token vào báo cáo.

## Mẫu báo cáo (ngắn, trung thực)

```
Đã kiểm:  <lệnh> → <kết quả thật>; <ảnh/MP4 đã xem: tên tệp, khung>
Phát hiện: <lỗi thật + vị trí>  /  Không phát hiện lỗi ở các mục trên
Chưa kiểm: <những gì chưa làm và vì sao>
Rủi ro còn lại: <...>
```
Không viết "đã kiểm chứng" cho thứ chưa chạy. Có test đỏ thì nói rõ test nào và kèm đầu ra.
