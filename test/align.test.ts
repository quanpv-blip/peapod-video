import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { alignWords, voiceRegions } from '../src/engine/align.ts';
import { buildPlan } from '../src/engine/plan.ts';
import { sceneWords } from '../src/engine/prepare.ts';
import { silentWav } from '../src/engine/wav.ts';
import { VideoSpecSchema } from '../src/spec/schema.ts';

/** WAV 16-bit mono 24 kHz: các đoạn [giây có tiếng | giây lặng] xen kẽ, tiếng là sóng sin 220 Hz. */
function toneWav(parts: [number, boolean][], rate = 24000): Uint8Array {
  const n = parts.reduce((a, [s]) => a + Math.round(s * rate), 0);
  const buf = new Uint8Array(44 + n * 2);
  const dv = new DataView(buf.buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 2, true);
  let i = 0;
  for (const [sec, voiced] of parts) {
    for (let k = 0; k < Math.round(sec * rate); k++, i++) dv.setInt16(44 + i * 2, voiced ? Math.round(8000 * Math.sin((2 * Math.PI * 220 * i) / rate)) : 0, true);
  }
  return buf;
}

describe('căn phụ đề theo khoảng lặng', () => {
  it('tìm đúng các đoạn có tiếng', () => {
    const r = voiceRegions(toneWav([[0.2, false], [1.0, true], [0.4, false], [0.8, true], [0.1, false]]));
    expect(r).toHaveLength(2);
    expect(r[0]!.startMs).toBeGreaterThanOrEqual(190);
    expect(r[0]!.endMs).toBeLessThanOrEqual(1210);
    expect(r[1]!.startMs).toBeGreaterThanOrEqual(1590);
  });
  it('WAV im lặng: không có đoạn nào (giữ ước lượng)', () => {
    expect(voiceRegions(silentWav(2))).toEqual([]);
  });
  it('chỗ ngừng neo vào dấu phẩy, từ sau dấu phẩy bắt đầu sau khoảng lặng', () => {
    const wav = toneWav([[1.2, true], [0.5, false], [0.8, true]]);
    const words = ['Một', 'hai', 'ba', 'bốn,', 'năm', 'sáu'];
    const t = alignWords(words, voiceRegions(wav));
    expect(t).toHaveLength(6);
    expect(t[3]!.endMs).toBeLessThanOrEqual(1210);
    expect(t[4]!.startMs).toBeGreaterThanOrEqual(1690);
    t.forEach((w, i) => i && expect(w.startMs).toBeGreaterThanOrEqual(t[i - 1]!.endMs - 1));
  });
  it('nhiều chỗ ngừng hơn số từ thì không lỗi, vẫn đủ từ và tăng dần', () => {
    const wav = toneWav([[0.3, true], [0.3, false], [0.3, true], [0.3, false], [0.3, true]]);
    const t = alignWords(['a', 'b'], voiceRegions(wav));
    expect(t).toHaveLength(2);
    expect(t[1]!.startMs).toBeGreaterThan(t[0]!.startMs);
  });
});

describe('kế hoạch dùng mốc thật khi có', () => {
  const spec = VideoSpecSchema.parse(JSON.parse(readFileSync(new URL('../samples/spec-vn-freezers.json', import.meta.url), 'utf8')));
  const s = spec.scenes.find((x) => x.narration && x.narration.text.includes('|'))!;
  const words = sceneWords(s.narration!.text, 'vi');
  // Mốc giả: mỗi từ 250 ms, cách nhau 50 ms.
  const timed = words.map((w, i) => ({ text: w, startMs: i * 300, endMs: i * 300 + 250 }));
  const seconds = (words.length * 300) / 1000;
  const plan = buildPlan(spec, { [s.id]: { src: 'x.wav', seconds, words: timed } });
  const p = plan.scenes.find((x) => x.scene.id === s.id)!;
  it('phụ đề lấy đúng mốc từ âm thanh (cộng độ trễ đầu cảnh)', () => {
    const first = p.captions[0]!.tokens[0]!;
    expect(first.startMs).toBe(Math.round((p.speechFrom / plan.fps) * 1000));
    expect(p.captions.flatMap((c) => c.tokens)).toHaveLength(words.length);
  });
  it('phần tử hiện đúng lúc từ đầu của đoạn nhịp được đọc', () => {
    expect(p.beats.length).toBeGreaterThan(0);
    p.beats.forEach((b, k) => k && expect(b).toBeGreaterThan(p.beats[k - 1]!));
  });
  it('số từ không khớp (lời đọc đã sửa sau khi đọc) thì quay về ước lượng', () => {
    const bad = buildPlan(spec, { [s.id]: { src: 'x.wav', seconds, words: timed.slice(1) } });
    expect(bad.scenes.find((x) => x.scene.id === s.id)!.captions.flatMap((c) => c.tokens)).toHaveLength(words.length);
  });
});

describe('cắt lời đọc cả video thành từng cảnh', () => {
  it('cắt ở khoảng lặng giữa hai cảnh, mỗi cảnh đúng độ dài phần tiếng của nó', async () => {
    const { splitNarration } = await import('../src/engine/split.ts');
    const { parseWav } = await import('../src/engine/wav.ts');
    // cảnh A ~1,5 s tiếng; lặng 0,6 s; cảnh B ~1,0 s tiếng (có một chỗ ngắt nhỏ bên trong A)
    const wav = toneWav([[0.1, false], [0.7, true], [0.2, false], [0.8, true], [0.6, false], [1.0, true], [0.1, false]]);
    const r = splitNarration(wav, [
      { id: 'a', words: ['một', 'hai,', 'ba', 'bốn.'] },
      { id: 'b', words: ['năm', 'sáu', 'bảy.'] },
    ]);
    const a = parseWav(r.wavs.a!).durationSec;
    const b = parseWav(r.wavs.b!).durationSec;
    expect(a).toBeGreaterThan(1.6);
    expect(a).toBeLessThan(2.1);
    expect(b).toBeGreaterThan(0.9);
    expect(b).toBeLessThan(1.5);
    expect(r.weakCuts).toEqual([]);
  });
});

const POC = new URL('../../peapod-ai/poc/out/e2e-VN.wav', import.meta.url);
describe.skipIf(!existsSync(POC))('giọng thật (WAV PoC của Gemini)', () => {
  it('tách được nhiều đoạn có tiếng, nằm trong độ dài tệp', () => {
    const wav = new Uint8Array(readFileSync(POC));
    const r = voiceRegions(wav);
    expect(r.length).toBeGreaterThan(1);
    r.forEach((x) => expect(x.endMs).toBeGreaterThan(x.startMs));
  });
});
