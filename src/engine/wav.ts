// Đọc thông số WAV PCM (đầu ra Gemini TTS: 24 kHz, mono, 16-bit) và tạo WAV im lặng để dựng thử. Thuần, chạy ở Node.
// Cùng thuật toán với peapod-ai/src/domain/wav.ts (đã chạy thật với WAV của Gemini, E-22).

export interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  dataBytes: number;
  durationSec: number;
}

export function parseWav(buf: Uint8Array): WavInfo {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tag = (o: number) => String.fromCharCode(...buf.subarray(o, o + 4));
  if (buf.byteLength < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('Không phải tệp WAV hợp lệ');
  let pos = 12;
  let fmt: { sampleRate: number; channels: number; bits: number } | undefined;
  while (pos + 8 <= buf.byteLength) {
    const id = tag(pos);
    const size = dv.getUint32(pos + 4, true);
    if (id === 'fmt ') {
      fmt = { channels: dv.getUint16(pos + 10, true), sampleRate: dv.getUint32(pos + 12, true), bits: dv.getUint16(pos + 22, true) };
    } else if (id === 'data') {
      if (!fmt) throw new Error('WAV thiếu khối fmt trước data');
      // Tiêu đề phát trực tiếp có thể ghi kích thước 0 hoặc 0xFFFFFFFF: dùng phần còn lại của tệp.
      const remaining = buf.byteLength - (pos + 8);
      const dataBytes = size === 0 || size === 0xffffffff || size > remaining ? remaining : size;
      const bytesPerSec = fmt.sampleRate * fmt.channels * (fmt.bits / 8);
      return { sampleRate: fmt.sampleRate, channels: fmt.channels, bitsPerSample: fmt.bits, dataBytes, durationSec: dataBytes / bytesPerSec };
    }
    pos += 8 + size + (size % 2);
  }
  throw new Error('WAV không có khối data');
}

/** WAV PCM 16-bit mono im lặng dài `seconds` giây (dựng thử đường âm thanh mà không gọi TTS). */
export function silentWav(seconds: number, sampleRate = 24000): Uint8Array {
  const samples = Math.max(1, Math.round(seconds * sampleRate));
  const dataBytes = samples * 2;
  const buf = new Uint8Array(44 + dataBytes);
  const dv = new DataView(buf.buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  dv.setUint32(4, 36 + dataBytes, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  w(36, 'data');
  dv.setUint32(40, dataBytes, true);
  return buf;
}
