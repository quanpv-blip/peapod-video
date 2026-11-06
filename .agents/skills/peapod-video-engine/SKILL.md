---
name: peapod-video-engine
description: Cổng vào cho mọi việc về video của PeaPod (peapod-video). Đọc đầu tiên khi làm video, cảnh, VideoSpec, dịch vụ dựng, phụ đề, giọng đọc hoặc tư liệu minh họa. Nói rõ cái gì đã có, cái gì chưa, bất biến phải giữ và kỹ năng nào cần nạp tiếp.
---

# PeaPod Video Engine

`peapod-video` dựng video và thẻ ảnh cho PeaPod (nội dung Facebook B2B Việt/Nhật). Dịch vụ HTTP `src/render-service.ts` do worker PeaPod (`../peapod-ai`) gọi. Remotion được ghim đúng **4.0.540** cho mọi gói.

## Hai đường dựng

| | Đường cũ (đang chạy) | Đường mới: VideoSpec (đang xây) |
|---|---|---|
| Đầu vào | `{market,title,bullets,takeaway,source,date}` + tùy chọn `template/captions/voiceSeconds/audioBase64` | Một `VideoSpec` JSON đầy đủ (`src/spec/schema.ts`) |
| Mẫu | `PeaPodReel` (list, focus, alert), một composition | 17 loại cảnh, composition `SpecVideo` / `SpecVideoJP`, ghép bằng `TransitionSeries` |
| Số liệu | Không có chứng cứ | Mỗi số gắn một `fact` có câu trích nguyên văn |
| Trạng thái | Chạy qua `POST /jobs/reel` | **Chạy được** qua `POST /jobs/spec` và `scripts/render-spec.ts`. 15/17 cảnh đã dựng và xem ảnh; `photo`, `map` có mã nhưng chưa thử (cần tư liệu). Phụ đề đang dùng mốc **ước lượng**; giọng đọc thật từng cảnh chưa nối từ peapod-ai |

### Video v3 từ peapod-ai (storyboard)

peapod-ai không viết VideoSpec đầy đủ. AI viết **storyboard** gọn (`src/spec/storyboard.ts`, lược đồ `schemas/storyboard.schema.json`, `npm run manifest` chép sang `peapod-ai/schemas/`). Dịch vụ dựng: `POST /storyboard/check` (chuyển → VideoSpec → kiểm, trả lời đọc từng cảnh) và `POST /jobs/spec` với `{storyboard, options, audioWhole}`: **một** WAV giọng cho cả video, `src/engine/split.ts` cắt theo khoảng lặng. Mốc phụ đề lấy từ khoảng lặng trong âm thanh thật (`src/engine/align.ts`), không phải mốc từng từ của TTS. Sau dựng luôn chạy `src/engine/review.ts` (job lỗi nặng: `review_failed`).

### Đường mới chạy thế nào

1. `validateSpec` (`src/spec/validate.ts`): schema + kiểm chéo (chứng cứ số, số mốc nhịp `|`, thời lượng 30–60 s theo `qa`).
2. `prepareAudio` (`src/engine/prepare.ts`): đo thời lượng WAV thật từng cảnh (`silent` / `files` / `wavs`).
3. `buildPlan` (`src/engine/plan.ts`): **một nguồn duy nhất** cho khung bắt đầu, độ dài cảnh, mốc hiện phần tử, trang phụ đề, cửa sổ lời đọc. Dùng chung cho kiểm tra, `calculateMetadata` và dựng, nên xem trước và dựng thật luôn khớp.
4. Âm thanh từng job được chép vào `<bundle>/public/<jobId>/` để `staticFile` đọc được mà không bundle lại.

Mẫu: `samples/spec-vn-freezers.json` (~54 s), `spec-jp-arara.json` (~51 s), `spec-gallery-vn.json` (bộ thử biểu đồ/quy trình/danh sách). Ảnh kiểm từng cảnh: `npx tsx scripts/still-frames.ts <spec>` để lấy khung, rồi `npx remotion still`.

Đừng sửa đường cũ để thêm tính năng mới. Xây trên VideoSpec.

## Bất biến (vi phạm là lỗi)

1. **VideoSpec là đầu vào duy nhất của đường mới.** Không đưa số hay chữ vào cảnh bằng đường khác.
2. **Không có con số nào trên video mà không có `fact` + `evidence.quote` nguyên văn.** `validateSpec` chặn; đừng nới luật để cho qua.
3. **Mọi gói `remotion` và `@remotion/*` cùng đúng một phiên bản** (`REMOTION_VERSION` trong `src/spec/manifest.ts`). `npm run doctor` kiểm tra.
4. **Không đụng dịch vụ đang chạy ở cổng 4100.** Thử nghiệm dựng dùng cổng 4101 với token tạm rồi tắt đúng tiến trình đó.
5. **Không tải chương trình hay model từ Internet rồi chạy** (whisper.cpp, v.v.) khi chưa được người dùng đồng ý rõ ràng. Hệ thống đã từng chặn việc này.
6. **Page Facebook là Page thật.** Không đăng, không gọi API ghi của Meta.
7. **Không đọc hay in giá trị trong `.env`.** `doctor` chỉ báo có/không.
8. **Giữ nguyên chỉnh sửa của người dùng** nếu thấy thay đổi bất ngờ (quy tắc chính thức của Remotion): không ghi đè, hỏi lại.
9. Không dùng `saveDefaultProps` hay kéo thả trong Studio cho dữ liệu từng bài: nó ghi thẳng vào mã nguồn (đây là nguyên nhân dòng chữ rác trước đây).

## Nạp kỹ năng nào

| Việc | Kỹ năng |
|---|---|
| Thiết lập máy, cài gói, nâng phiên bản, kiểm tra môi trường | `peapod-video-setup` |
| Viết hoặc kiểm tra đầu vào VideoSpec, trích sự kiện, quy tắc số VN/JP | `peapod-videospec` |
| Dựng một thành phần cảnh hoặc thành phần dùng chung | `peapod-scene-authoring` (+ `remotion-markup`, `remotion-interactivity`) |
| Kiểm chất lượng: ảnh chuẩn, ffprobe, vùng an toàn, báo cáo | `peapod-video-qa` |
| Chọn ảnh/video/nhạc, quyền sử dụng, ảnh bài báo | `peapod-assets-and-legal` |
| Phụ đề và giọng đọc | `remotion-captions` + `peapod-videospec` |
| Bản đồ | `remotion-maps` (chỉ khi đã quyết định dùng MapTiler) |
| Nâng cấp Remotion | `remotion-upgrade` |
| Giấy phép Remotion | `remotion-license` (D-08 đã chốt: Free License, dự án cá nhân 1–2 người) |

## Lệnh thường dùng (trong `peapod-video`)

```
npm run doctor           # kiểm tra toàn bộ thiết lập
npm test                 # vitest: số VN/JP, VideoSpec, chứng cứ
npm run spec:validate    # kiểm tra mọi samples/spec-*.json (hoặc truyền đường dẫn)
npm run manifest         # xuất schemas/video-spec.schema.json và video-engine.manifest.json
npm run typecheck
npm run serve            # dịch vụ dựng, cổng 4100, chạy trong CỬA SỔ RIÊNG
npm run studio           # Remotion Studio, cổng 3100, để thiết kế mẫu cảnh
```

## Bảng kê

`src/spec/manifest.ts` là nguồn sự thật cho: loại cảnh và trạng thái, thành phần dùng chung, gói bắt buộc và gói dự kiến, kỹ năng cần có, font, biến môi trường, công cụ, quyết định còn mở. Cập nhật ở đó khi thêm bất cứ thứ gì, rồi chạy `npm run manifest` và `npm run doctor`.

## Quyết định còn mở (❓)

D-09/D-10 ảnh bài báo, ảnh stock, nhạc · D-11 gắn cờ AI · giọng đọc (Gemini hay ElevenLabs) · căn phụ đề (whisper.cpp, Whisper API hay ElevenLabs) · khóa Pexels/MapTiler · xác nhận vùng an toàn Reels. Chi tiết: `ba-team/docs/19-video-engine.md`.

Khảo sát bên ngoài (đọc trước khi chọn công cụ mới): `ba-team/docs/22-research-react-video-repos.md` (repo, giấy phép: **không chép mã OpenMontage, AGPL**) và `23-research-agent-skills-video.md` (skill/MCP/TTS có timestamp: đề xuất lấy mốc từ chính TTS, whisper-cpp chỉ để kiểm chéo).
