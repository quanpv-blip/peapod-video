---
name: peapod-video-setup
description: Thiết lập ban đầu cho peapod-video, từ máy trắng đến "doctor đạt". Dùng khi cài đặt, cài thêm gói Remotion, nâng phiên bản, cài kỹ năng, chạy dịch vụ dựng, hoặc khi môi trường báo lỗi.
---

# Thiết lập ban đầu cho peapod-video

Mục tiêu: sau khi làm xong, `npm run doctor` báo **"✓ Thiết lập đạt"**. Mỗi bước dưới đây có cách kiểm tra.

## 0. Điều kiện

- Windows, Node ≥ 22, npm. (Máy hiện tại: Node 24.)
- Không có Python. Không cần cmake hay Visual Studio, **trừ** khi sau này quyết định chạy whisper.cpp cục bộ (xem `peapod-videospec`, mục phụ đề).
- Chrome cho dựng do Remotion tự quản (`openBrowser('chrome')`). Không đặt `browserExecutable` hay `chromeMode` trừ khi có yêu cầu rõ (quy tắc chính thức của `remotion-render`).

## 1. Cài gói

```
cd peapod-video
npm install
```
- Cảnh báo `allow-scripts ... esbuild postinstall` của npm: **bỏ qua**, không chạy `npm approve-scripts`. esbuild đã hoạt động.
- Chỉ ghim phiên bản **chính xác** (`--save-exact`), không dùng `^`.

## 2. Tệp `.env` (không commit, không in)

```
RENDER_TOKEN=<chuỗi ngẫu nhiên ≥ 32 ký tự>
RENDER_PORT=4100
RENDER_HOST=127.0.0.1
RENDER_CONCURRENCY=2
```
Tạo token mà không in ra màn hình: `node -e "require('fs').appendFileSync('.env','RENDER_TOKEN='+require('crypto').randomBytes(32).toString('hex')+'\n')"`. Token phải trùng `REMOTION_RENDER_TOKEN` trong `.env` của `peapod-ai`. Danh sách đầy đủ và biến tùy chọn: `ENV_VARS` trong `src/spec/manifest.ts`.

## 3. Kỹ năng

Bộ chính thức nằm ở `.agents/skills/` (nguồn: kho `remotion`, tag v4.0.540) và được liên kết vào `.claude/skills/` bằng junction để Claude Code đọc được. Danh sách bắt buộc: `OFFICIAL_SKILLS` và `PROJECT_SKILLS` trong manifest.

- **Cài thêm hoặc cập nhật một kỹ năng chính thức:** sao chép `remotion/packages/skills/skills/<tên>` vào `.agents/skills/<tên>`, rồi tạo junction: `New-Item -ItemType Junction -Path .claude\skills\<tên> -Target .agents\skills\<tên>`.
- **Cạm bẫy Windows:** trong kho gốc, các liên kết chéo giữa kỹ năng là *symlink của git*; trên Windows chúng thành tệp văn bản 18 byte và liên kết gãy. Sau khi sao chép phải thay các tệp đó bằng junction thật. Kiểm tra: không còn tệp nhỏ không có đuôi chứa `../`.
- `skills-lock.json` chỉ theo dõi bản cài bằng CLI từ GitHub; bản sao từ kho cục bộ không có trong đó. Đừng chạy lệnh cập nhật kỹ năng tự động mà không xem lại vì có thể ghi đè.

## 4. Kiểm tra

```
npm run doctor
```
Đọc từng dòng. `✕` phải sửa; `!` là lưu ý (ví dụ gói dành cho đợt sau chưa cài, thành phần cảnh chưa dựng: đúng hiện trạng). Các lỗi hay gặp:

| Dòng báo | Cách sửa |
|---|---|
| Gói Remotion lệch phiên bản | `npm install --save-exact <gói>@4.0.540`; đừng để hai phiên bản cùng tồn tại |
| `schemas/video-spec.schema.json` không khớp | `npm run manifest` |
| Kỹ năng chưa liên kết | tạo junction như mục 3 |
| `RENDER_TOKEN` quá ngắn | tạo lại token (mục 2) |
| ffmpeg không chạy | chạy `npx remotion ffmpeg -version` để xem lỗi thật |

## 5. Chạy dịch vụ dựng

Dịch vụ giữ cửa sổ terminal: **Ctrl+C hoặc đóng cửa sổ là tắt**. Chạy trong cửa sổ riêng:
```
Start-Process powershell -ArgumentList '-NoExit','-Command','cd D:\PROJECT\oasis\peapod-video; npm run serve'
```
Kiểm tra: `curl.exe http://127.0.0.1:4100/health` phải có `"ready":true` (trên PowerShell 5.1 dùng `curl.exe`, vì `curl` là `Invoke-WebRequest`).

**Thử bản mới mà không đụng dịch vụ đang chạy:** `RENDER_TOKEN=<tạm ≥32> RENDER_PORT=4101 RENDER_HOST=127.0.0.1 npx tsx src/render-service.ts`; xong thì tắt đúng tiến trình giữ cổng 4101.

## 6. Cài thêm một gói Remotion

1. `npm install --save-exact @remotion/<gói>@4.0.540` (hoặc `npx remotion add @remotion/<gói>`; kiểm tra lại số phiên bản sau khi chạy).
2. Thêm vào `REQUIRED_PACKAGES` (nếu cần ngay) hoặc xóa khỏi `PLANNED_PACKAGES` trong `src/spec/manifest.ts`.
3. `npm run doctor` và `npm run typecheck`.
4. Gói có yêu cầu đặc biệt: `@remotion/maptiler` cần khóa; `@remotion/effects` cần WebGL (máy dựng không GPU cần `chromiumOptions.gl: 'angle'` hoặc `'swangle'`, ⚠️ chưa thử); `@remotion/media` được ghi là thử nghiệm.

## 7. Nâng phiên bản Remotion

Nạp `remotion-upgrade`. Mọi gói phải lên **cùng một** phiên bản trong cùng một lần. Sau đó: đổi `REMOTION_VERSION` trong manifest, chạy `npm run doctor`, `npm test`, dựng lại toàn bộ ảnh chuẩn (xem `peapod-video-qa`) và xem từng ảnh. Tải lại kỹ năng chính thức từ tag mới của kho `remotion`.

## 8. Khi xong

Ghi lại vào `ba-team/docs/99-evidence-log.md` những gì đã kiểm chứng (mã E-xx, ngày, kết quả) và sửa `19-video-engine.md` nếu thực tế khác tài liệu.
