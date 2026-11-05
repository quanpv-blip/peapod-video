# peapod-video

Thẻ tin và video của PeaPod, dựng bằng Remotion. Dịch vụ này chạy trên máy chủ nội bộ; worker PeaPod gọi qua HTTP khi cần thẻ. Nếu dịch vụ tắt, PeaPod tự quay về thẻ Satori (không mất thẻ).

Remotion phiên bản `4.0.540`, trùng với repo `remotion` đã clone. Repo gốc không bị sửa.

## Cấu trúc
- `src/PeaPodCard.tsx`: composition thẻ 1080×1350 (bố cục khớp thẻ Satori của PeaPod).
- `src/brand.ts`: màu và nhãn theo thị trường. Thẻ Satori (`peapod-ai/src/media/card.ts`) dùng cùng giá trị, đổi thì đổi cả hai.
- `src/schema.ts`: hợp đồng dữ liệu (zod). Khớp với `CardInput` của PeaPod.
- `src/render-service.ts`: dịch vụ HTTP. Đóng gói project một lần khi khởi động, giữ một trình duyệt mở, mỗi yêu cầu chỉ render một khung hình.
- `scripts/render.ts`: render thẻ ra PNG từ file JSON, dùng để thử nhanh.
- `samples/`: dữ liệu thẻ mẫu lấy từ bài thật (#26 VN, #25 JP).
- `public/fonts/`: Noto Sans và Noto Sans JP (giấy phép OFL), cùng bộ với thẻ Satori.

## Cài đặt (một lần)
```powershell
cd D:\PROJECT\oasis\peapod-video
npm install
```

Tạo file `.env` (không đưa lên git):
```
RENDER_TOKEN=<chuỗi ngẫu nhiên ≥ 32 ký tự, ví dụ: openssl rand -hex 32>
RENDER_PORT=4100
RENDER_HOST=0.0.0.0
RENDER_CONCURRENCY=2
```
Token phải trùng với `REMOTION_RENDER_TOKEN` trong `.env` của PeaPod.

## Chạy dịch vụ
```powershell
npm run serve
```
Lần đầu mất khoảng 20 giây để đóng gói, và Remotion có thể tải Chromium (khoảng 130 MB, một lần). Log in ra dạng JSON. Khi thấy `render service listening` là sẵn sàng.

Kiểm tra nhanh:
```powershell
curl http://127.0.0.1:4100/health
```

## Endpoint
- `GET /health`: trạng thái và số yêu cầu đang xử lý.
- `POST /render/card`: body là JSON theo `schema.ts`, header `X-Render-Token`. Trả về PNG 1080×1350.
  - Thiếu hoặc sai token: 401.
  - Dữ liệu sai: 400, chỉ kèm tên trường lỗi (không trả lại nội dung).
  - Body quá 64 KB: 413.

Số liệu đo trên máy phát triển: lần render đầu khoảng 1,7 giây, các lần sau khoảng 1,4 giây. Cách cũ (đóng gói lại mỗi lần) mất 178 giây.

## Thử nhanh
```powershell
npx tsx scripts/render.ts samples/card-jp-25.json out/card-jp-25.png
```

## Chạy cùng lúc với studio
Studio dùng để xem trước và chỉnh composition, không cần cho dịch vụ:
```powershell
npm run studio
```
Cổng mặc định của studio là 3000; dịch vụ render dùng 4100, không xung đột.

## Lưu ý
- Mỗi lần render dùng một Chromium. `RENDER_CONCURRENCY` giới hạn số lần render cùng lúc; yêu cầu thừa được xếp hàng.
- Dịch vụ lắng nghe trên `0.0.0.0` để container PeaPod gọi được qua `host.docker.internal`. Token là lớp bảo vệ duy nhất, nên giữ bí mật và không mở cổng này ra Internet.
- Giấy phép Remotion: PeaPod là tổ chức có hơn 3 nhân viên, cần Company License cho việc dùng thương mại (xem `LICENSE.md` của repo Remotion). Đây là quyết định D-08 đang chờ.
