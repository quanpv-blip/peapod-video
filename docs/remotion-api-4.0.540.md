# Bảng tra API Remotion 4.0.540 (đã xác minh)

Phạm vi: các API cần để dựng video theo cảnh, điều khiển bằng dữ liệu, trong `peapod-video`.
Nguồn sự thật: tệp `.d.ts` trong `node_modules` (remotion và mọi `@remotion/*` đều 4.0.540) và mã nguồn ở `D:\PROJECT\oasis\remotion\packages\*` (cùng 4.0.540). Không dựa vào trí nhớ.

## Đã kiểm chứng những gì (ngày 2026-11-06, Windows 11, Node + npx)

Một tệp thử tạm `src/_probe/` (Probe.tsx, Root.tsx, index.ts, node-render.ts, public/ chứa tone.wav 3,0 s, tone.mp3 2,5 s, dot.svg và bản sao font) dùng **tất cả** API trong tài liệu này. Thư mục đã bị xóa sau khi thử. Không sửa `src/Root.tsx` hay mã có sẵn, không đụng dịch vụ cổng 4100.

| Lệnh | Kết quả |
|---|---|
| `npx tsc --noEmit` (toàn dự án + probe) | Đạt (exit 0), sau khi sửa 2 lỗi kiểu ghi ở mục Cạm bẫy (`premountFor` với `layout="none"`; mảng presentation trộn kiểu) |
| `npx remotion still src/_probe/index.ts Probe out.png --frame=N --public-dir=src/_probe/public` với N = 12, 30, 75, 100, 135 | Đạt. Bundle lần đầu ~12 s. `calculateMetadata` tính ra 189 khung = 60+60+60+45 − 3×12. Khung 190 báo lỗi đúng như mong đợi ("highest frame … is 188") |
| `npx tsx src/_probe/node-render.ts <out>`: `bundle` → `openBrowser` → 2× (`selectComposition` + `renderStill` jpeg) → `renderMedia` h264 khung 0–59, concurrency 4 | Đạt. bundle 4,5 s; selectComposition 0,24–0,39 s; renderStill ~0,4 s; renderMedia 60 khung 1080×1080 trong 3,1 s; MP4 có luồng h264 + aac, RMS âm thanh ~6200 (không câm) |
| mediabunny trong Node (`FilePathSource`) | WAV = 3, MP3 = 2.5088… s |
| mediabunny trong trình duyệt khi dựng (`UrlSource(staticFile(...))` trong calculateMetadata) | WAV = 3, MP3 = 2.5088… s |
| `getAudioDurationInSeconds` (@remotion/media-utils, đã deprecated) trong calculateMetadata | Chạy được, MP3 = 2.5 (làm tròn khác mediabunny) |
| Tệp âm thanh chép vào `<bundle>/public/job-123/voice.mp3` **sau** khi bundle, dùng `staticFile('job-123/voice.mp3')` | Đạt (đọc được độ dài, dựng ra tiếng) |
| Hiệu ứng `lightLeak()` trên `<Solid>` (WebGL/WebGPU) trong Chrome headless trên Windows | Đạt cả qua CLI (gl mặc định) và Node (`gl: 'angle'`) |

Ảnh kiểm tra đã xem bằng mắt: chữ Việt/Nhật đúng font Noto, rough-notation vẽ dần, light leak, hạt bụi, đường vẽ dần, hình shapes, Img, phụ đề tô từ đang đọc.

---

## Những điểm KHÁC với tài liệu cũ / trí nhớ thường gặp (đọc trước)

1. `Audio` của gói `remotion` **đã deprecated**, đổi tên thành `Html5Audio`. Dùng `Audio` từ `@remotion/media`.
2. `trimAfter` trên `<Audio>`/`<Video>` của `@remotion/media` **deprecated**: dùng `durationInFrames` (tính theo khung **nguồn**, trước `playbackRate`).
3. `getAudioDurationInSeconds` / `getVideoMetadata` của `@remotion/media-utils` **deprecated**, khuyên dùng Mediabunny. `parseMedia` / `@remotion/media-parser` **không được cài**.
4. `mediabunny` (1.64.0) có trong `node_modules` nhưng **không nằm trong `package.json`** (phụ thuộc gián tiếp). Nên thêm `"mediabunny": "1.64.0"` vào dependencies nếu dùng.
5. `<LightLeak>` của `@remotion/light-leaks` **deprecated**. Cách mới là hàm hiệu ứng `lightLeak()` gắn vào `effects` của `<Solid>` (hoặc `Img`, `Video`, shapes). `@remotion/light-leaks` tái xuất `lightLeak`, nên không cần thêm `@remotion/effects` vào package.json.
6. `@remotion/sfx` chỉ xuất **hằng chuỗi URL** `https://remotion.media/*.wav`; gói không chứa tệp âm thanh nào.
7. `@remotion/layout-utils` có thêm `fitTextOnNLines` (không nằm trong danh mục đề bài). Nó **chỉ tách theo dấu cách**, nên không ngắt được tiếng Nhật.
8. `interpolate` giờ nhận được cả `outputRange` là chuỗi có đơn vị (`['0px','100px']` → `'50px'`), mảng số (`[[0,0],[10,20]]` → `[5,10]`), `easing` dạng mảng (mỗi đoạn một easing), `extrapolate*: 'wrap'`, và `posterize`.
9. `Img`, `Solid`, shapes, rough-notation, `<Audio>` đều là thành phần "interactive": nhận `from`, `durationInFrames`, `premountFor`… và tự bọc trong `Sequence`.
10. `TransitionSeries.Overlay` có tồn tại (chèn hiệu ứng ở điểm cắt, không rút ngắn timeline).
11. `TransitionSeries` không còn nhận prop `layout` ở v5. Ở 4.0.540 nó vẫn là `FC<SequenceProps>`, nhưng nên coi như luôn absolute-fill.

---

## 1. TransitionSeries, timing, presentation

```ts
import { TransitionSeries, linearTiming, springTiming, useTransitionProgress,
  type TransitionPresentation, type TransitionPresentationComponentProps } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';     // fade({enterStyle?, exitStyle?, shouldFadeOutExitingScene?})
import { slide } from '@remotion/transitions/slide';   // slide({direction?: 'from-left'|'from-top'|'from-right'|'from-bottom', enterStyle?, exitStyle?})
import { wipe } from '@remotion/transitions/wipe';     // wipe({direction?: 8 hướng 'from-top-left'..., outer/inner Enter/Exit Style})
import { flip } from '@remotion/transitions/flip';     // flip({direction?, perspective?, ...Style})
```
Các entry phụ khác có thật: `cube, clock-wipe, book-flip, zoom-blur, dreamy-zoom, film-burn, linear-blur, zoom-in-out, none, iris, dissolve, ripple, crosswarp, cross-zoom, swap, push-cut, blur-slide`. `blurSlide, crossZoom, dreamyZoom, filmBurn, linearBlur, pushCut` còn được xuất từ gốc `@remotion/transitions`.

Chữ ký:
- `linearTiming({durationInFrames, easing?})`
- `springTiming({config?, durationInFrames?, durationRestThreshold?, reverse?})`. Không truyền `durationInFrames` thì độ dài phụ thuộc `fps`.
- Cả hai trả về `TransitionTiming` có `getDurationInFrames({fps})` và `getProgress({frame,fps})`.
- `<TransitionSeries.Sequence durationInFrames offset? name? premountFor? postmountFor? style? className? hidden?>`. **Không** nhận `loop`.
- `<TransitionSeries.Transition presentation? timing>`
- `<TransitionSeries.Overlay durationInFrames offset? premountFor? postmountFor? hidden?>`

```tsx
<TransitionSeries>
  {scenes.map((s, i) => (
    <React.Fragment key={s.id}>
      {i > 0 ? <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 12 })} /> : null}
      <TransitionSeries.Sequence durationInFrames={frames[i]} premountFor={30}><Scene {...s} /></TransitionSeries.Sequence>
    </React.Fragment>
  ))}
</TransitionSeries>
```
`React.Fragment` hợp lệ (children được làm phẳng). Đã thử.

**Presentation tùy chỉnh (blur + scale + mờ dần), đã chạy được:**
```tsx
type BlurScaleProps = { maxBlur: number; scaleFrom: number };
const BlurScale: React.FC<TransitionPresentationComponentProps<BlurScaleProps>> = ({ children, presentationDirection, presentationProgress: p, passedProps }) => {
  const entering = presentationDirection === 'entering';
  const opacity = entering ? p : 1 - p;
  const blur = (entering ? 1 - p : p) * passedProps.maxBlur;
  const scale = entering ? interpolate(p, [0, 1], [passedProps.scaleFrom, 1]) : interpolate(p, [0, 1], [1, 2 - passedProps.scaleFrom]);
  return <AbsoluteFill style={{ opacity, filter: `blur(${blur}px)`, transform: `scale(${scale})` }}>{children}</AbsoluteFill>;
};
export const blurScale = (props: BlurScaleProps): TransitionPresentation<BlurScaleProps> => ({ component: BlurScale, props });
```
Props mà component nhận được: `presentationProgress` (0→1 cho **cả hai chiều**; với cảnh exiting, 0 là còn nguyên, 1 là đã đi), `presentationDirection: 'entering'|'exiting'`, `passedProps`, `presentationDurationInFrames`, `bothEnteringAndExiting` (cảnh ngắn nằm giữa hai transition), `onElementImage`, `onUnmount` (dành cho presentation html-in-canvas, có thể bỏ qua).

`useTransitionProgress()` → `{entering, exiting, isInTransitionSeries}`: dùng bên trong cảnh để biết cảnh đang vào/ra.

**Cạm bẫy**
- Tổng thời lượng = tổng các Sequence − tổng các Transition. Overlay không trừ.
- Lỗi khi chạy (từ mã nguồn): Transition không được đứng cạnh Transition; Overlay không được đứng cạnh Transition hay Overlay; Sequence phải dài ≥ transition trước và sau nó; Overlay không được vượt quá cảnh trước/sau, và `offset` phải là số nguyên.
- Mảng presentation trộn kiểu (`[fade(), slide(), blurScale()]`) **không qua tsc** vì generic không tương thích. Khai báo `TransitionPresentation<any>[]` hoặc tạo phần tử JSX theo từng nhánh.
- Cảnh entering được vẽ chồng lên cảnh exiting. Với `fade()`, cảnh exiting không mờ đi trừ khi đặt `shouldFadeOutExitingScene: true`.

## 2. calculateMetadata bất đồng bộ (thời lượng theo cảnh)

```ts
import type { CalculateMetadataFunction } from 'remotion';
// options: { defaultProps, props, abortSignal, compositionId, isRendering }
// trả về (tùy chọn): durationInFrames, fps, width, height, props, defaultCodec, defaultOutName,
//   defaultVideoImageFormat, defaultPixelFormat, defaultProResProfile, defaultSampleRate
export const calculateMetadata: CalculateMetadataFunction<Props> = async ({ props, abortSignal }) => {
  const fps = 30, T = 12;
  const voiceSeconds = await getDurationSeconds(staticFile(props.voiceSrc)); // mục 3
  const sceneFrames = props.scenes.map((s) => Math.max(T + 1, Math.round(s.seconds * fps)));
  const visual = sceneFrames.reduce((a, b) => a + b, 0) - (sceneFrames.length - 1) * linearTiming({ durationInFrames: T }).getDurationInFrames({ fps });
  return { fps, durationInFrames: Math.max(visual, Math.ceil(voiceSeconds * fps)), props: { ...props, sceneFrames, voiceSeconds } };
};
<Composition id="X" component={C} schema={zodSchema} defaultProps={d} width={1080} height={1920} fps={30} durationInFrames={1} calculateMetadata={calculateMetadata} />
```
**Cạm bẫy**
- Các field do calculateMetadata thêm vào phải có trong zod schema (đặt `.optional()`), nếu không sẽ lệch kiểu.
- Hàm chạy **trong trình duyệt** (trang bundle), không phải Node. Không dùng `fs`. `staticFile`, `fetch` và mediabunny `UrlSource` dùng được.
- `inputProps` được trộn **nông** với `defaultProps` (đã thử: chỉ truyền `{voiceSrc}` thì `scenes` vẫn lấy từ default). Muốn thay mảng thì phải truyền cả mảng.
- Mỗi Sequence phải dài hơn transition, nếu không TransitionSeries sẽ ném lỗi. Hãy chặn dưới ngay ở đây.
- `durationInFrames` phải là số nguyên ≥ 1, nên làm tròn bằng `Math.ceil`.

## 3. Lấy thời lượng âm thanh

| Hàm | Có ở 4.0.540? | Nơi chạy | Ghi chú |
|---|---|---|---|
| mediabunny `new Input({formats: ALL_FORMATS, source: new UrlSource(url)}).computeDuration()` | Có (mediabunny 1.64.0, phụ thuộc gián tiếp) | Trình duyệt (calculateMetadata, đã thử) và Node | Cách được khuyên dùng. `getDurationFromMetadata()` nhanh hơn, có thể trả `null` |
| mediabunny `FilePathSource(path)` | Có | Chỉ Node | Đã thử với WAV và MP3. Gọi `input.dispose()` để đóng tệp |
| `getAudioDurationInSeconds(src)` (`@remotion/media-utils`) | Có, **deprecated** | Chỉ trình duyệt (tạo thẻ `<audio>`) | Đã thử trong calculateMetadata; MP3 trả 2.5 so với 2.5088 của mediabunny |
| `getAudioDuration` | Có, deprecated (tên cũ của hàm trên) | | |
| `parseMedia` / `@remotion/media-parser` | **Không được cài** | | |
| `@remotion/renderer` `getVideoMetadata` | Có | Node | Dành cho video |

```ts
import { ALL_FORMATS, Input, UrlSource } from 'mediabunny';
const getDurationSeconds = async (src: string) => {
  const input = new Input({ formats: ALL_FORMATS, source: new UrlSource(src) });
  try { return await input.computeDuration(); } finally { input.dispose(); }
};
```
**Cạm bẫy:** URL http khác origin cần CORS khi chạy trong trình duyệt. Trong Node, `UrlSource` với đường dẫn tương đối (`/public/x.wav`) không chạy được. Cách chắc ăn nhất là tính độ dài **ở Node bằng `FilePathSource`** trước khi dựng, rồi truyền `voiceSeconds` qua inputProps (dịch vụ hiện tại đang làm vậy).

## 4. `@remotion/media` Audio / Video

```ts
import { Audio, Video } from '@remotion/media';
```
Props của `Audio` (theo `AudioProps`): `src` (bắt buộc), `trimBefore?`, `trimAfter?` (**deprecated**), `volume?: number | (frame) => number`, `loopVolumeCurveBehavior?: 'repeat'|'extend'`, `playbackRate?`, `preservePitch?` (mặc định false), `muted?`, `loop?`, `toneFrequency?` (0.01–2, chỉ có tác dụng khi dựng), `audioStreamIndex?`, `delayRenderRetries?`, `delayRenderTimeoutInMilliseconds?`, `onError?`, `requestInit?`, `fallbackHtml5AudioProps?`, `disallowFallbackToHtml5Audio?`, cùng với `from`, `durationInFrames`, `name`, `hidden`, `freeze`, `showInTimeline`, `premountFor`, `postmountFor`.
`Video` có thêm `objectFit`, `effects`, `headless`, `onVideoFrame`, crop…

```tsx
<Track name="Audio">
  <Audio src={staticFile(voiceSrc)} name="Voice" />
  <Audio src={staticFile(musicSrc)} name="Music" loop loopVolumeCurveBehavior="extend"
    volume={(f) => (f < voiceFrames ? 0.15 : interpolate(f, [voiceFrames, voiceFrames + 10], [0.15, 0.6], { extrapolateRight: 'clamp' }))} />
  <Audio src={staticFile(voiceSrc)} from={10} trimBefore={15} durationInFrames={30} playbackRate={1.25} volume={0.3} />
</Track>
```
Khác `Audio` cũ của `remotion`: bản cũ nay là `Html5Audio` (deprecated alias `Audio`), dùng thẻ `<audio>` và có `startFrom/endAt` (đã đổi tên). Bản `@remotion/media` giải mã bằng WebCodecs/Mediabunny, có `from`/`durationInFrames` ngay trên thẻ và tự quay về Html5Audio khi không giải mã được (trừ khi đặt `disallowFallbackToHtml5Audio`).

**Cạm bẫy**
- `volume` dạng hàm nhận **khung cục bộ** (0 tại lúc Audio bắt đầu, tức sau `from`), không phải khung của composition.
- Khi bật `loop`, mặc định `loopVolumeCurveBehavior='repeat'` sẽ **đặt lại `frame` về 0 ở mỗi vòng lặp**, làm hỏng logic hạ nhạc theo khung tuyệt đối. Với nhạc nền phải đặt `"extend"`.
- `durationInFrames` tính theo khung nguồn: thời lượng trên timeline = `durationInFrames / playbackRate` (ví dụ trên: 30 / 1.25 = 24 khung).
- `volume > 1` vẫn khuếch đại (có cảnh báo khi quá cao).

## 5. `@remotion/captions`

```ts
import { createTikTokStyleCaptions, parseSrt, serializeSrt, parseVtt, type Caption, type TikTokPage } from '@remotion/captions';
type Caption = { text: string; startMs: number; endMs: number; timestampMs: number | null; confidence: number | null; pageBreakAfter?: boolean };
createTikTokStyleCaptions({ captions, combineTokensWithinMilliseconds, breakOnSilenceAfterMilliseconds? }) // → { pages: TikTokPage[] }
// TikTokPage = { text, startMs, durationMs, tokens: { text, fromMs, toMs, pageBreakAfter? }[] }
```
**Ước lượng Caption[] khi không có mốc thời gian thật** (đã chạy, dùng chung với dữ liệu whisper thật vì cùng kiểu):
```ts
export const estimateCaptions = (text: string, totalMs: number, startMs = 0): Caption[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const weights = words.map((w) => Math.max(1, [...w].length) + (/[.,!?;:…。、]$/.test(w) ? 3 : 0)); // dấu câu thì dừng lâu hơn
  const sum = weights.reduce((a, b) => a + b, 0);
  let t = startMs;
  return words.map((w, i) => {
    const d = (weights[i] / sum) * totalMs;
    const c: Caption = { text: (i === 0 ? '' : ' ') + w, startMs: Math.round(t), endMs: Math.round(t + d), timestampMs: Math.round(t + d / 2), confidence: null };
    t += d; return c;
  });
};
const { pages } = createTikTokStyleCaptions({ captions: estimateCaptions(text, voiceSeconds * 1000), combineTokensWithinMilliseconds: 900 });
const ms = (frame / fps) * 1000;
const page = pages.find((p) => ms >= p.startMs && ms < p.startMs + p.durationMs);
```
**Cạm bẫy (đọc từ mã nguồn)**
- Trang mới **chỉ được tách khi token bắt đầu bằng dấu cách** (`text.startsWith(' ')`). Nghĩa là token phải có dấu cách đầu như `' từ'`.
- Tiếng Nhật không có dấu cách nên mọi token dồn vào một trang. Cách xử lý: tách bằng `Intl.Segmenter('ja',{granularity:'word'})` và đặt `pageBreakAfter: true` sau `。`/`、` hoặc sau mỗi N ký tự.
- Token trong trang giữ nguyên dấu cách đầu, nên khi hiển thị cần `whiteSpace: 'pre'`.

## 6. `@remotion/layout-utils`

```ts
import { measureText, fitText, fitTextOnNLines, fillTextBox } from '@remotion/layout-utils';
measureText({ text, fontFamily, fontSize, fontWeight?, letterSpacing?, fontVariantNumeric?, textTransform?, validateFontIsLoaded?, additionalStyles? }) // → {width, height}
fitText({ text, withinWidth, fontFamily, fontWeight?, letterSpacing?, fontVariantNumeric?, textTransform?, validateFontIsLoaded?, additionalStyles? }) // → {fontSize}  (một dòng)
fitTextOnNLines({ text, maxLines, maxBoxWidth, fontFamily, fontWeight?, ..., maxFontSize? }) // → {fontSize, lines}
fillTextBox({ maxBoxWidth, maxLines }).add(word: Word) // → {exceedsBox, newLine}
```
Ví dụ đã chạy. Chờ font xong rồi mới đo:
```tsx
const { delayRender, continueRender, cancelRender } = useDelayRender();
const [handle] = useState(() => delayRender('fonts'));
const [ready, setReady] = useState(false);
useEffect(() => { Promise.all([document.fonts.load('700 40px NotoVN'), document.fonts.load('700 40px NotoJP', 'あ')])
  .then(() => { setReady(true); continueRender(handle); }).catch(cancelRender); }, []);
const fit = useMemo(() => ready ? fitText({ text, withinWidth: 920, fontFamily: FONT_FAMILY, fontWeight: '700', validateFontIsLoaded: true }) : null, [ready, text]);
```
Ngắt dòng tiếng Nhật, viết thêm trên `fillTextBox` (đã chạy: 3 dòng đúng chỗ):
```ts
const seg = new Intl.Segmenter('ja', { granularity: 'word' });
const box = fillTextBox({ maxBoxWidth: 700, maxLines: 3 });
for (const { segment } of seg.segment(text)) { const r = box.add({ text: segment, fontFamily: FONT_FAMILY, fontSize: 64, fontWeight: '700' }); if (r.exceedsBox) break; if (r.newLine) lines.push(''); lines[lines.length-1] += segment; }
```
**Cạm bẫy**
- Chỉ chạy trong trình duyệt (gọi `document`). Gọi trong Node sẽ ném lỗi.
- `src/fonts.ts` nạp font bất đồng bộ và **không xuất promise**. Component render **trước** khi font xong, nên nếu đo ngay trong lần render đầu sẽ đo bằng font dự phòng. Hãy chờ `document.fonts.load(...)` cộng `delayRender` như trên.
- `validateFontIsLoaded: true` chỉ ném lỗi khi kích thước trùng với font dự phòng **và** chuỗi có hơn 4 ký tự khác nhau, nên nó chỉ là lưới an toàn.
- Kết quả đo được cache theo khóa không gồm `fontVariantNumeric`.
- `fitTextOnNLines` tách theo `' '`: với câu tiếng Nhật, cả câu thành một "từ", cho ra `lines=1` và cỡ chữ rất nhỏ (thử: 22px). Không dùng nó cho JP.
- `fitText` không có `maxFontSize`, cần tự `Math.min`.
- Với tiếng Việt, `FONT_FAMILY = 'NotoVN, NotoJP, sans-serif'` đo đúng (thử: 920×102 ở 74.4px).

## 7. `@remotion/rough-notation`

```ts
import { Highlight, Underline, StrikeThrough, CrossedOff, Box, Bracket, Circle } from '@remotion/rough-notation';
```
Props chung: `children`, **`progress: number` (bắt buộc, 0→1)**, `seed?`, `disabled?`, `style?`, `roughness?`, `bowing?`, `maxRandomnessOffset?`, `disableMultiStroke?`, `preserveVertices?`, cùng với `from`/`durationInFrames`/`premountFor`….
Props riêng: `color?`, `strokeWidth?` (trừ Highlight), `padding?: Partial<{left,right,top,bottom}>` (Underline chỉ có `{top}`), `iterations?`, `rtl?`. `Bracket` có `bracketLeft/Right/Top/Bottom`, `Circle` có `box?: 'inside'|'around'` và `curveFitting` cùng các thông số đường cong.

```tsx
const hl = interpolate(frame, [10, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
<Highlight progress={hl} color="rgba(255,200,0,0.5)" seed={1}>{text}</Highlight>
```
**Cạm bẫy:** animation hoàn toàn do bạn điều khiển qua `progress`, thư viện không tự chạy theo khung. Phần tử được bọc trong `<span style="display:inline-block">` và đo bằng ResizeObserver (có `delayRender` chờ kích thước). Nên đặt `seed` cố định để nét vẽ giống nhau giữa các lần dựng. `Circle` của rough-notation trùng tên với `Circle` của `@remotion/shapes`, nên đổi tên khi import.

## 8. noise, light-leaks, shapes, paths

**`@remotion/noise`**: `noise2D(seed, x, y)`, `noise3D(seed, x, y, z)`, `noise4D(seed, x, y, z, w)`, trả về giá trị trong khoảng [-1, 1] và xác định theo seed.
```tsx
const dx = noise3D('dust', i * 10, frame * 0.01, 0) * 40;
```
Cạm bẫy: mỗi seed tạo một bộ sinh và cache **chỉ giữ 10 seed** (FIFO). Một seed cho mỗi hạt sẽ phá cache và chậm. Hãy dùng **một seed** và lệch tọa độ theo chỉ số hạt.

**Light leak**
```tsx
import { lightLeak } from '@remotion/light-leaks'; // tái xuất từ @remotion/effects/light-leak
import { Solid } from 'remotion';
<TransitionSeries.Overlay durationInFrames={20}>
  <Solid width={width} height={height} style={{ mixBlendMode: 'screen' }}
    effects={[lightLeak({ seed: 3, hueShift: 30, progress: interpolate(f, [a, b], [0, 1], clamp) })]} />
</TransitionSeries.Overlay>
```
`lightLeak({seed?, hueShift? 0–360, progress? 0–1 (mặc định 0.5), disabled?})`. Pha đầu là lan ra, pha sau là rút đi.
Cạm bẫy: quanh progress 0.5, alpha gần 1 trên phần lớn khung, **che hết nội dung**. Đặt `mixBlendMode: 'screen'` hoặc giảm `opacity`. `<LightLeak>` cũ vẫn chạy nhưng đã deprecated. Hiệu ứng cần WebGL/WebGPU; đã chạy được trong Chrome headless trên Windows.

**`@remotion/shapes`**: `Rect{width,height,cornerRadius?,edgeRoundness?}`, `Circle{radius}`, `Ellipse`, `Star{points,innerRadius,outerRadius,cornerRadius?,edgeRoundness?}`, `Triangle`, `Polygon`, `Pie`, `Heart`, `Arrow`, `Callout`, `Spark`. Props SVG path như `fill`, `stroke`… cùng `pathStyle`, `effects`, `debug`. Có các hàm `make*()` trả `{path, width, height, instructions, transformOrigin}`.
```tsx
<Star points={5} innerRadius={20} outerRadius={45} fill="#e9c46a" />
```

**`@remotion/paths`**: `evolvePath(progress, d)` → `{strokeDasharray, strokeDashoffset}`, `getLength(d)`, `getPointAtLength(d, len)` → `{x,y} | null`, `getTangentAtLength`, `interpolatePath`, `scalePath`, `translatePath`, `reversePath`, `getBoundingBox`, `parsePath`, `warpPath`, `cutPath`…
```tsx
const evo = evolvePath(progress, PATH);
<path d={PATH} fill="none" stroke="#e9c46a" strokeWidth={8} strokeDasharray={evo.strokeDasharray} strokeDashoffset={evo.strokeDashoffset} />
```

## 9. `@remotion/sfx`

Các export (đều kiểu chuỗi literal): `whip, whoosh, pageTurn, uiSwitch, mouseClick, shutterModern, shutterOld, ding, bruh, vineBoom, windowsXpError, fah, spongebobFail, omgHellNah, priceIsRightFail, romanceMeme, boneCrack, animeWow, yippee, loadingLag, wilhelmScream, macQuack, skedaddle, snapchatNotification, nellyAhh, sanctuaryGuardianWhat, minecraftHurt, ohMyGodVine, illuminatiConfirmed, dramaticBoomer, triggered, recordScratch`.

Mỗi export là **URL ngoài** dạng `'https://remotion.media/<tên>.wav'`. Gói chỉ có `index.mjs`, không chứa tệp âm thanh.

Hệ quả: máy dựng không có mạng sẽ dựng lỗi (delayRender hết giờ hoặc lỗi tải). Cách đóng gói cục bộ:
1. Tải một lần trên máy có mạng (kiểm tra giấy phép theo skill `peapod-assets-and-legal`).
2. Lưu vào `public/sfx/whoosh.wav`.
3. Dùng `<Audio src={staticFile('sfx/whoosh.wav')} />`. Có thể giữ bảng ánh xạ `{whoosh: 'sfx/whoosh.wav'}` thay cho các hằng của gói.

Probe không phát URL này (chỉ import hằng).

## 10. Lõi `remotion`

```ts
import { Sequence, Series, AbsoluteFill, spring, interpolate, interpolateColors, Easing, random, useCurrentFrame,
  useVideoConfig, staticFile, delayRender, continueRender, useDelayRender, Img, Solid, Track, Interactive } from 'remotion';
```
- `<Sequence from? durationInFrames? name? layout? premountFor? postmountFor? style? styleWhilePremounted? trimBefore? playbackRate? loop? freeze? hidden? showInTimeline?>`. Mặc định `layout='absolute-fill'`.
  Cạm bẫy (tsc báo lỗi): **`premountFor`/`postmountFor`/`style`/`className` chỉ hợp lệ với `layout='absolute-fill'`**. Kết hợp với `layout="none"` sẽ lỗi kiểu.
- `<Series>` (mặc định `layout='none'`) với `<Series.Sequence durationInFrames offset? layout? name? ...>`. `offset` dương tạo khoảng trống, âm tạo chồng lấn.
- `<Track name>`: nhóm các clip trên một hàng timeline của Studio. Áp timing như Sequence, mặc định `layout='none'`.
- `spring({frame, fps, config?: {damping, mass, stiffness, overshootClamping}, from?, to?, durationInFrames?, delay?, reverse?, durationRestThreshold?})`. Có thêm `measureSpring`.
- `interpolate(input, inRange, outRange, {easing?, extrapolateLeft?, extrapolateRight?: 'extend'|'clamp'|'identity'|'wrap', posterize?, output?: 'linear'|'perceptual-scale', outputType?})`. `easing` có thể là mảng (mỗi đoạn một easing).
- `Easing.bezier(x1,y1,x2,y2)`, `Easing.in/out/inOut(f)`, `Easing.cubic`, `Easing.spring({...})`, `Easing.elastic(b)`, `Easing.back(s)`.
- `interpolateColors(input, inRange, colors[])` → chuỗi `rgba(...)`.
- `random(seed: number|string|null)`: xác định theo seed. **`random(null)` = `Math.random()`**, không xác định nên đừng dùng.
- `useDelayRender()` → `{delayRender, continueRender, cancelRender}`, nên dùng trong component. `delayRender(label?, {timeoutInMilliseconds?, retries?})`.
- `staticFile(path)` → `${window.remotion_staticBase}/path`. Gọi `staticFile` hai lần lên cùng chuỗi sẽ ném lỗi.
- `<Img src ... maxRetries? pauseWhenLoading? effects? from? durationInFrames? premountFor?>` tự `delayRender` đến khi ảnh tải xong. Dùng `layout='none'` nên không phá bố cục.

## 11. Dựng từ Node (giống `src/render-service.ts`)

```ts
const serveUrl = await bundle({ entryPoint: resolve('src/index.ts'), publicDir: resolve('public') });  // một lần
const browser = await openBrowser('chrome', { chromiumOptions: { gl: 'angle' } });                     // một lần
const composition = await selectComposition({ serveUrl, id, inputProps, puppeteerInstance: browser });  // chạy calculateMetadata
await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation, inputProps, puppeteerInstance: browser,
  concurrency: 4, imageFormat: 'jpeg', jpegQuality: 80, x264Preset: 'veryfast', crf: 23, hardwareAcceleration: 'disable',
  frameRange?: [0, 59], cancelSignal, onProgress, overwrite: true, logLevel: 'warn' });
await renderStill({ composition, serveUrl, output, frame, imageFormat: 'png'|'jpeg', jpegQuality, puppeteerInstance: browser, inputProps });
```
Tùy chọn hiệu năng (kiểm trong `options-map.ts` và `render-media.d.ts`):
- `concurrency`: số, chuỗi `'50%'`, hoặc null. Mặc định `round(min(8, max(1, CPU/2)))`, vượt số lõi sẽ ném lỗi.
- `imageFormat`: `'jpeg'` (mặc định cho video, nhanh) hoặc `'png'` (cần khi có alpha). `jpegQuality` từ 0–100.
- `x264Preset`: chỉ áp dụng cho libx264. `crf`.
- `hardwareAcceleration`: `'disable'` (mặc định), `'if-possible'`, hoặc `'required'`. Trên **win32**, h264 cộng `if-possible` sẽ chọn **`h264_nvenc` mà không kiểm tra có GPU NVIDIA**; đặt `crf`, `encodingMaxRate` hoặc `encodingBufferSize` thì sẽ tắt HW. Giữ `'disable'` nếu không chắc phần cứng.
- Còn có: `disallowParallelEncoding`, `disableSharedMemoryCapture`, `mediaCacheSizeInBytes`, `offthreadVideoThreads`, `preferredEffectBackend`, `chromeMode`, `licenseKey` (`apiKey` deprecated).

Dùng chung bundle và trình duyệt:
- Đã thử 2 lần selectComposition + renderStill + renderMedia trên **một** browser. Mỗi `renderMedia` mở `concurrency` tab trong browser đó.
- Khi đã truyền `puppeteerInstance` thì `chromiumOptions` của renderMedia không còn tác dụng; đặt `gl` ở `openBrowser`.
- Gọi `browser.close({silent:true})` khi tắt.

Truyền tệp âm thanh cục bộ cho trình duyệt:
- (a) `bundle({publicDir})` **chép** public vào `<serveUrl>/public` lúc bundle. Tệp thêm sau vào `public/` gốc sẽ **không** thấy được.
- (b) **Đã thử và chạy:** sau khi bundle, chép tệp vào `join(serveUrl, 'public', jobId, 'voice.mp3')` rồi truyền `staticFile('<jobId>/voice.mp3')`. Máy chủ tĩnh của renderer đọc thư mục lúc có request. Nhớ dọn sau mỗi job; `getStaticFiles()` sẽ không liệt kê tệp này.
- (c) URL http từ một máy chủ cục bộ cũng được, nhưng cần CORS và không được dùng cổng 4100 đang chạy.
- Không dùng đường dẫn `file://` hay đường dẫn ổ đĩa (trang chạy qua http; chưa thử).

`npx remotion still|render` trên CLI nhận `--public-dir`.

## 12. `Interactive.create` / `Track`

```tsx
const Badge = Interactive.create({ Component: BadgeInner, layout: 'none' }); // BadgeInner phải nhận prop `style`
<Badge label="..." from={15} durationInFrames={40} />
```
`Interactive.create` bọc component vào một Sequence có schema để Studio chỉnh được (translate/scale/rotate/opacity, from/duration). Ngoài ra có `Interactive.withSchema`, `Interactive.Div/Span/Svg/...`, và các mảnh schema (`textSchema`, `backgroundSchema`…).

`layout: 'absolute-fill'` yêu cầu component **không** nhận `style/width/height`. `layout: 'none'` yêu cầu component nhận `style`.

**Không cần cho dựng tự động.** Chỉ có ích khi muốn chỉnh tay trong Studio. Dùng cũng không hại: đã chạy trong probe. Tương tự, `Track` chỉ phục vụ việc sắp xếp hàng trên timeline của Studio.

---

## Cạm bẫy quan trọng nhất (tóm tắt)

1. Nhạc nền `loop` cộng `volume` dạng hàm phải đặt `loopVolumeCurveBehavior="extend"`. Nếu không, frame đặt lại mỗi vòng và việc hạ nhạc theo giọng bị sai.
2. `@remotion/sfx` là URL Internet. Máy dựng offline phải chép tệp vào `public/sfx/`.
3. layout-utils phải đo **sau** khi font nạp xong (`document.fonts.load` + `delayRender`). `fitTextOnNLines` và `createTikTokStyleCaptions` đều dựa vào dấu cách nên hỏng với tiếng Nhật; dùng `Intl.Segmenter` hoặc `pageBreakAfter`.
4. `premountFor` không đi chung với `layout="none"`.
5. TransitionSeries ném lỗi khi Sequence ngắn hơn transition, hoặc Overlay đứng cạnh Transition.
6. Thời lượng audio: tính ở Node bằng mediabunny `FilePathSource` (ổn định, không phụ thuộc CORS). mediabunny cần được khai báo trong package.json.
7. Tệp theo job: chép vào `<serveUrl>/public/<jobId>/` sau khi bundle, không cần bundle lại.
8. `hardwareAcceleration: 'if-possible'` trên Windows luôn chọn NVENC, dễ lỗi trên máy không có GPU NVIDIA.
9. Chạy `npx remotion still` với entry khác sẽ in "Webpack config change detected. Clearing cache". Điều này vô hại nhưng làm lần bundle sau chậm hơn.
