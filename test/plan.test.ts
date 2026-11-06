import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPlan } from '../src/engine/plan.ts';
import { parseWav, silentWav } from '../src/engine/wav.ts';
import { VideoSpecSchema } from '../src/spec/schema.ts';

const load = (n: string) => VideoSpecSchema.parse(JSON.parse(readFileSync(new URL(`../samples/${n}.json`, import.meta.url), 'utf8')));

describe('kế hoạch dựng: bất biến thời gian', () => {
  for (const name of ['spec-vn-freezers', 'spec-jp-arara']) {
    const plan = buildPlan(load(name));
    it(`${name}: tổng = tổng cảnh − tổng chồng chuyển cảnh (công thức TransitionSeries)`, () => {
      const sum = plan.scenes.reduce((a, p) => a + p.durationInFrames, 0) - plan.scenes.reduce((a, p) => a + p.transitionOutFrames, 0);
      expect(plan.totalFrames).toBe(sum);
      plan.scenes.forEach((p, i) => i && expect(p.from).toBe(plan.scenes[i - 1]!.from + plan.scenes[i - 1]!.durationInFrames - plan.scenes[i - 1]!.transitionOutFrames));
    });
    it(`${name}: lời đọc bắt đầu sau khi hình đã hiện và kết thúc trước khi chuyển cảnh`, () => {
      plan.scenes.forEach((p, i) => {
        if (!p.speechTo) return;
        const prevTrans = i ? plan.scenes[i - 1]!.transitionOutFrames : 0;
        expect(p.speechFrom).toBeGreaterThanOrEqual(Math.ceil(prevTrans * 0.55));
        expect(p.speechTo).toBeLessThanOrEqual(p.durationInFrames - p.transitionOutFrames);
      });
    });
    it(`${name}: nhịp hình nằm trong cảnh, tăng dần; phụ đề nằm trong cửa sổ lời đọc`, () => {
      for (const p of plan.scenes) {
        p.beats.forEach((b, k) => {
          expect(b).toBeGreaterThanOrEqual(0);
          expect(b).toBeLessThan(p.durationInFrames);
          if (k) expect(b).toBeGreaterThan(p.beats[k - 1]!);
        });
        for (const pg of p.captions) {
          expect(pg.startMs).toBeGreaterThanOrEqual((p.speechFrom / plan.fps) * 1000 - 1);
          expect(pg.endMs).toBeLessThanOrEqual((p.speechTo / plan.fps) * 1000 + 1);
        }
      }
    });
  }

  it('âm thanh thật: cảnh dài/ngắn theo thời lượng âm thanh, không còn đánh dấu ước lượng', () => {
    const spec = load('spec-vn-freezers');
    const est = buildPlan(spec);
    const audio = Object.fromEntries(spec.scenes.filter((s) => s.narration).map((s) => [s.id, { src: `x/${s.id}.wav`, seconds: 2 }]));
    const real = buildPlan(spec, audio);
    expect(est.estimatedTiming).toBe(true);
    expect(real.estimatedTiming).toBe(false);
    const hook = real.scenes[0]!;
    expect(hook.speechTo - hook.speechFrom).toBe(60); // 2 giây ở 30 fps
    expect(real.totalFrames).toBeLessThan(est.totalFrames);
  });

  it('cùng tiêu đề chương: chuyển cảnh nhẹ (fade ≤ 8 khung) và tiêu đề được giữ', () => {
    const plan = buildPlan(load('spec-vn-freezers'));
    const i = plan.scenes.findIndex((p) => p.scene.id === 's-loss');
    expect(plan.scenes[i]!.headingContinues).toBe(true);
    expect(plan.scenes[i - 1]!.transitionOutType).toBe('fade');
    expect(plan.scenes[i - 1]!.transitionOutFrames).toBeLessThanOrEqual(8);
    expect(plan.scenes[i]!.chapter).toBe(plan.scenes[i - 1]!.chapter);
  });
});

describe('WAV', () => {
  it('WAV im lặng đọc lại đúng thời lượng', () => {
    const info = parseWav(silentWav(3.5));
    expect(info.durationSec).toBeCloseTo(3.5, 3);
    expect(info.sampleRate).toBe(24000);
  });
  it('không phải WAV thì báo lỗi', () => {
    expect(() => parseWav(new Uint8Array(100))).toThrow();
  });
});
