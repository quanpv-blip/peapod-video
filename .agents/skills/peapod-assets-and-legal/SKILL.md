---
name: peapod-assets-and-legal
description: Chính sách tư liệu minh họa cho video PeaPod: nguồn ảnh/video/nhạc được phép, giấy phép, ghi nguồn, cờ AI, ảnh và chụp màn hình bài báo, khóa API, và các quyết định pháp lý còn mở. Dùng khi chọn hoặc thêm bất kỳ ảnh, video, nhạc, bản đồ, biểu tượng nào.
---

# Tư liệu minh họa và quyền sử dụng

Mọi tư liệu đi qua `spec.assets` với `license` đầy đủ. `validateSpec` từ chối tư liệu không được dùng thương mại, thiếu chữ ghi nguồn khi giấy phép yêu cầu, hoặc ảnh AI không gắn cờ. **Đừng nới các luật đó.** Chính sách pháp lý (D-09, D-10, D-11) vẫn là quyết định ❓ chưa chốt; kỹ năng này nêu mặc định an toàn.

## Thứ tự ưu tiên tư liệu

1. **Tự sinh từ dữ liệu**: biểu đồ, biểu tượng, sơ đồ, chữ động, đồ họa thương hiệu. Không vướng bản quyền. Ưu tiên số một.
2. **Tư liệu thương hiệu PeaPod** (`origin: 'brand'`, `license.name: 'Tự tạo'`).
3. **Ảnh/video stock có giấy phép thương mại** (`origin: 'stock'`).
4. **Ảnh AI** (`origin: 'ai'`, `aiGenerated: true`).
5. **Ảnh của bài báo / chụp màn hình bài báo**: **mặc định KHÔNG** (xem dưới).

## Ảnh và chụp màn hình bài báo ❓

Về kỹ thuật làm được: trình duyệt lấy được `og:image` và chụp trang (đã thử với VnExpress và Nikkei xTECH). Nhưng dùng ảnh hay trang của báo trong video thương mại là vấn đề bản quyền chưa có ý kiến pháp chế. **Mặc định:** chỉ trích dẫn ngắn dạng chữ, nguyên văn, có tên báo và đường dẫn (cảnh `quote` + `source`). Chỉ đổi khi có quyết định D-09/D-10 bằng văn bản.

Thêm: bài Nikkei xTECH có tường trả phí; chỉ phần hiển thị công khai mới dùng được, và việc đọc tự động toàn bài có thể trái điều khoản trang. Hệ thống hiện chỉ dùng tiêu đề và tóm tắt từ RSS cho việc sinh bài; **không mở rộng sang cào toàn văn khi chưa có quyết định**.

## Stock (Pexels và tương tự) ⚠️

Chưa tích hợp. Thông tin mới từ nguồn bên thứ ba, **phải đối chiếu trực tiếp trên pexels.com/api trước khi dùng**:
- Khóa API miễn phí; giới hạn mặc định 200 lượt/giờ và 20.000 lượt/tháng; không được lách giới hạn.
- Giấy phép cho dùng thương mại; đa số nguồn nói không bắt buộc ghi tên nhưng hướng dẫn API yêu cầu liên kết về Pexels; cấm dùng ảnh theo cách ngụ ý được chứng thực hoặc làm nhãn hiệu.
- Điền `license` đúng thực tế, kể cả `attributionRequired` và `attributionText` nếu có.

## Ảnh/video/giọng do AI sinh (D-11)

- Bắt buộc `aiGenerated: true` và `origin: 'ai'` (validate bắt lỗi không nhất quán).
- Cân nhắc dòng ghi "do AI tạo" trên video theo chính sách công ty/nền tảng. Mặc định D-11: **có gắn cờ**.
- Không sinh người thật, logo, hay chữ trong ảnh (chữ Việt/Nhật hay sai).
- Hạn mức và chi phí ảnh AI chưa đo: không gọi để thử khi chưa được đồng ý.

## Nhạc nền và hiệu ứng âm (D-10)

- Nhạc chỉ dùng tệp có giấy phép đã kiểm điều khoản; khai trong `assets` (`type: 'audio'`) và `music.assetId`.
- Hiệu ứng âm: chỉ các tên trong `SFX` của `schema.ts` (từ `@remotion/sfx`, đã xác minh trong tài liệu 4.0.540). Nếu thêm âm khác (ví dụ từ `remotion.media`), kiểm tra điều khoản trước.

## Bản đồ

`@remotion/maptiler` cần khóa MapTiler và có điều khoản hiển thị nguồn bản đồ; chưa cài, chưa quyết định ❓. Bản đồ tĩnh tự tạo (`provider: 'static'`) là phương án không cần khóa.

## Font

Noto Sans (Việt/Latin) và Noto Sans JP, giấy phép OFL, đã có trong `public/fonts`. Không thêm font khác nếu chưa rõ giấy phép.

## Khóa API

Đặt trong `.env`, không commit, không in, không dán vào chat. Biến chưa dùng nhưng đã dự kiến: `PEXELS_API_KEY`, `MAPTILER_API_KEY`, `ELEVENLABS_API_KEY` (xem `ENV_VARS`). Không tự gọi API bên ngoài tốn hạn mức hoặc tải tệp thực thi khi chưa được đồng ý rõ ràng.

## Giấy phép Remotion (D-08)

**Đã chốt 2026-11-06:** PeaPod là dự án cá nhân của chủ dự án, 1–2 người dùng → dùng **Remotion Free License** (cá nhân / tổ chức tối đa 3 người). Không mua Company License.

Phải xét lại (nạp `remotion-license`, báo người dùng) khi: số người làm hoặc dùng vượt 3, dự án được giao cho một công ty, hoặc bán/cho thuê dịch vụ dựng cho bên ngoài.

## Danh sách kiểm trước khi đưa tư liệu vào spec

- [ ] Biết chắc nguồn và giấy phép; đã ghi vào `license` đúng thực tế.
- [ ] Được dùng thương mại; ghi nguồn nếu yêu cầu.
- [ ] Ảnh AI đã gắn cờ.
- [ ] Không phải ảnh/trang của bài báo (trừ khi có quyết định bằng văn bản).
- [ ] Không chứa người thật, logo, nhãn hiệu của bên thứ ba.
- [ ] `npm run spec:validate` đạt.
