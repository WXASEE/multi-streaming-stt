import MicrophoneStream from 'microphone-stream';

export function floatToPCM16(float32: Float32Array) {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function downsampleTo16k(float32: Float32Array, inputRate: number) {
  if (inputRate === 16000) return floatToPCM16(float32);
  const ratio = inputRate / 16000;
  const newLen = Math.round(float32.length / ratio);
  const result = new Int16Array(newLen);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < newLen) {
    const nextOffset = Math.round((offsetResult + 1) * ratio);
    let accum = 0, count = 0;
    for (let i = offsetBuffer; i < nextOffset && i < float32.length; i++) { accum += float32[i]; count++; }
    const sample = Math.max(-1, Math.min(1, accum / count));
    result[offsetResult++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    offsetBuffer = nextOffset;
  }
  return result;
}

export async function* micPcm16Stream(mic: MicrophoneStream): AsyncGenerator<Int16Array, void, unknown> {
  const rate = (mic as any).context?.sampleRate ?? 48000;
  for await (const chunk of mic) {
    const raw = MicrophoneStream.toRaw(chunk) as Float32Array | null;
    if (!raw) continue;
    yield downsampleTo16k(raw, rate);
  }
}

export function rmsLevel(pcm: Int16Array) {
  if (!pcm.length) return 0;
  let sumSq = 0;
  for (let i = 0; i < pcm.length; i++) { const v = pcm[i] / 32768; sumSq += v * v; }
  return Math.sqrt(sumSq / pcm.length);
}