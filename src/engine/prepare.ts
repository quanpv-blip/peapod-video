// Chuẩn bị âm thanh lời đọc cho từng cảnh (chạy ở Node, KHÔNG import vào composition).
// Nguồn giọng:
//   - silent: WAV im lặng đúng độ dài ước tính (dựng thử, không tốn hạn mức TTS)
//   - files:  thư mục chứa <sceneId>.wav (ví dụ WAV đã tạo trước)
//   - wavs:   WAV đã có trong bộ nhớ theo id cảnh (peapod-ai gửi sang base64 sau khi gọi Gemini TTS ở phía nó)
// Kết quả: tệp WAV ghi vào `outDir`, cùng thời lượng thật đọc từ header; composition nhận đường dẫn tương đối `publicPrefix/<sceneId>.wav`.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitBeats, stripBeats } from '../spec/beats.ts';
import { alignWords, voiceRegions } from './align.ts';
import { tokenize } from './captions.ts';
import type { Lang } from '../spec/numbers.ts';
import type { VideoSpec } from '../spec/schema.ts';
import { estimateSpeechSeconds, type SceneAudio } from './plan.ts';
import { parseWav, silentWav } from './wav.ts';

export type VoiceSource = { kind: 'silent' } | { kind: 'files'; dir: string } | { kind: 'wavs'; wavs: Record<string, Uint8Array> };

/** Giới hạn an toàn cho một đoạn lời đọc (giây): ngoài khoảng này coi như âm thanh hỏng. */
const MIN_SEC = 0.4;
const MAX_SEC = 30;

export interface PreparedAudio {
  audio: Record<string, SceneAudio>;
  /** Cảnh có lời đọc nhưng thiếu âm thanh (sẽ dựng với thời lượng ước lượng, không có tiếng). */
  missing: string[];
  /** Tổng thời lượng lời đọc thật (giây). */
  speechSeconds: number;
}

export function prepareAudio(spec: VideoSpec, source: VoiceSource, outDir: string, publicPrefix: string): PreparedAudio {
  mkdirSync(outDir, { recursive: true });
  const lang = spec.language as Lang;
  const audio: Record<string, SceneAudio> = {};
  const missing: string[] = [];
  let speechSeconds = 0;
  if (!spec.narration.enabled) return { audio, missing, speechSeconds };
  for (const s of spec.scenes) {
    if (!s.narration || !stripBeats(s.narration.text)) continue;
    let wav: Uint8Array | null = null;
    if (source.kind === 'silent') wav = silentWav(estimateSpeechSeconds(s.narration.text, lang));
    else if (source.kind === 'files') {
      const p = join(source.dir, `${s.id}.wav`);
      wav = existsSync(p) ? new Uint8Array(readFileSync(p)) : null;
    } else wav = source.wavs[s.id] ?? null;
    if (!wav) {
      missing.push(s.id);
      continue;
    }
    const info = parseWav(wav);
    if (info.durationSec < MIN_SEC || info.durationSec > MAX_SEC) throw new Error(`Lời đọc cảnh "${s.id}" dài ${info.durationSec.toFixed(2)} giây, ngoài khoảng ${MIN_SEC}–${MAX_SEC} giây: âm thanh có thể hỏng.`);
    writeFileSync(join(outDir, `${s.id}.wav`), wav);
    // Mốc từng từ theo khoảng lặng trong âm thanh thật (không áp dụng cho WAV im lặng).
    const words = source.kind === 'silent' ? [] : alignWords(sceneWords(s.narration.text, lang), voiceRegions(wav));
    audio[s.id] = { src: `${publicPrefix}/${s.id}.wav`, seconds: Math.round(info.durationSec * 1000) / 1000, ...(words.length ? { words } : {}) };
    speechSeconds += info.durationSec;
  }
  return { audio, missing, speechSeconds };
}

/** Từ hiển thị của lời đọc một cảnh, tách theo từng đoạn nhịp "|" rồi nối lại (để biết từ nào mở đầu đoạn nào). */
export function sceneWords(text: string, lang: Lang): string[] {
  return splitBeats(text).flatMap((seg) => tokenize(seg, lang));
}
