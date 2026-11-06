---
name: peapod-scene-authoring
description: Cách dựng một thành phần cảnh hoặc thành phần dùng chung cho Video Engine (Interactive.create, TransitionSeries, vùng an toàn, font Việt/Nhật, số, rough-notation, ảnh chuẩn). Dùng khi viết hoặc sửa bất kỳ cảnh nào trong src/.
---

# Dựng thành phần cảnh

Trước khi viết, nạp thêm: `remotion-markup` (quy tắc chung, `multi-scene-video.md`, `transitions.md`, `text-highlights.md`, `measuring-text.md`, `calculate-metadata.md`) và `remotion-interactivity` (`timeline-structure.md`). Kỹ năng này chỉ bổ sung ràng buộc **riêng của PeaPod**.

## Nguyên tắc

1. **Một loại cảnh = một component riêng**, nhận đúng các trường của loại đó trong `schema.ts` (kiểu `Extract<Scene,{kind:'stat'}>`). Không có logic "một cảnh làm mọi thứ".
2. **Cảnh là dữ liệu thuần**: không tự gọi mạng, không tự đọc spec. Composition gốc (`SpecVideo`, chưa dựng) đọc spec, tính thời lượng bằng `calculateMetadata`, đưa dữ liệu xuống.
3. **Ghép cảnh bằng `TransitionSeries`** (cảnh liền kề, chuyển cảnh chồng nhau). Tổng thời lượng = tổng các cảnh trừ tổng khung chuyển cảnh (công thức chính thức: 40 + 60 − 30 = 70). Tính đúng trong `calculateMetadata`, nếu sai video sẽ bị cụt hoặc thừa.
4. **Presentation**: `fade`, `slide`, `wipe`, `flip`, `clockWipe` từ `@remotion/transitions/<tên>` (đường dẫn đã xác minh trong `transitions.md`); thời gian bằng `linearTiming`.
5. **Chỉ gọi `useCurrentFrame()` ở component nhỏ nhất cần nó.** Component cảnh và component cha sắp xếp không đăng ký theo khung (quy tắc chính thức, tránh dựng lại thừa).
6. **Cảnh sắp tới nên `premountFor`** (ví dụ 3 giây) để tải trước ảnh/font.
7. **Chỉnh sửa được trong Studio** khi hợp lý: bọc bằng `Interactive.create({Component, layout:'absolute-fill', schema})` theo ví dụ trong `timeline-structure.md`. Nhưng dữ liệu từng bài chỉnh trong trình biên tập riêng (V5), **không** dùng `saveDefaultProps`.

## Ràng buộc PeaPod

### Vùng an toàn
Đọc `spec.safeArea` (mặc định trên 210, dưới 320, trái 60, phải 120 trên khung 1080×1920; ⚠️ chưa xác nhận từ Instagram). Mọi chữ và con số quan trọng nằm trong vùng này. Phần nền được phép tràn ra ngoài. Phụ đề không đặt ở 150px cách đáy như bản cũ.

### Font và chữ
- `src/fonts.ts` nạp `NotoVN` và `NotoJP` qua `delayRender`; dùng `FONT_FAMILY`. **Mọi phần tử nằm ngoài khung chính phải tự đặt `fontFamily`**, nếu không rơi về font có chân (đã gặp ở phụ đề).
- Chữ tự co bằng `@remotion/layout-utils` (`measureText`, `fitText`), không đoán cỡ chữ. Đo bằng đúng font đã nạp.
- Tiêu đề Nhật cần ngắt dòng đẹp: ⚠️ cách ngắt chưa được kiểm chứng; xem ảnh chuẩn JP trước khi chốt.

### Số
Luôn `formatNumber(value, lang, {mode})` từ `src/spec/numbers.ts` (VN `3.386.187`, JP `338万6187`). Đếm số lên bằng cách nội suy **giá trị** rồi định dạng từng khung, không nội suy chuỗi.

### Nhấn mạnh
`@remotion/rough-notation`: `Highlight`, `Circle`, `Underline`, `StrikeThrough`, `CrossedOff`, `Box`, `Bracket`. Tiến trình (`progress`) lấy từ `interpolate(useCurrentFrame(), ...)` để dựng xác định. Dùng cho con số và cụm then chốt, không rắc khắp nơi.

### Hiệu ứng và âm thanh
- Âm thanh bằng `Audio` từ `@remotion/media` (không dùng `Audio` cũ từ `remotion`). Hiệu ứng có sẵn từ `@remotion/sfx`: chỉ dùng tên trong `SFX` của `schema.ts`.
- `@remotion/effects`, `lottie`, `maptiler`, `light-leaks`: kiểm tra trong `PLANNED_PACKAGES` đã cài chưa trước khi import.
- Chuyển động có chủ đích: một nhịp vào, một nhịp nhấn, một nhịp ra. Tránh hiệu ứng rải đều.

### Không làm
- Không dùng `Interactive.Div` hay thêm phần tử kéo thả trong Studio rồi để lại trong mã. Nếu thấy phần tử lạ do Studio thêm (ví dụ chữ thử) thì **hỏi người dùng** trước khi xóa (quy tắc giữ thay đổi của người dùng).
- Không đọc `process.env` trong composition.
- Không nhúng URL ngoài cho ảnh/font; tư liệu đi qua `spec.assets` và được dịch vụ dựng chuẩn bị sẵn.

## Thêm một loại cảnh (quy trình)

1. Hợp đồng đã có trong `schema.ts` và bảng `SCENE_CATALOG` (`status: 'spec'`). Nếu loại cảnh mới: thêm vào `SCENE_KINDS`, schema, `validate.ts` (tham chiếu, ngân sách chữ), `SCENE_CATALOG`; chạy `npm run manifest`.
2. Viết component trong `src/scenes/<tên>.tsx` + test hợp đồng nếu có logic.
3. Dựng **ảnh chuẩn** cho tiếng Việt và tiếng Nhật (`peapod-video-qa`), xem bằng mắt.
4. Đặt `status: 'built'` trong manifest; chạy `npm run doctor`.
5. Cập nhật `ba-team/docs/19-video-engine.md` và `99-evidence-log.md`.

## Danh sách kiểm một cảnh xong

- [ ] Chữ và số nằm trong vùng an toàn; không tràn với chuỗi dài nhất của ngân sách (VN và JP).
- [ ] Số hiển thị qua `formatNumber`; không có số nào ngoài `factId`.
- [ ] `fontFamily` có ở mọi phần tử ngoài khung chính.
- [ ] Chỉ component nhỏ nhất gọi `useCurrentFrame()`.
- [ ] Có ảnh chuẩn VN và JP và đã xem.
- [ ] Thời lượng vào/ra tính đúng với `TransitionSeries`.
- [ ] `npm run typecheck`, `npm test`, `npm run doctor` đạt.
