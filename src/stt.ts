import { initWhisper, type WhisperContext } from "whisper.rn";
import * as FileSystem from "expo-file-system/legacy";
import LiveAudioStream from "@fugood/react-native-audio-pcm-stream";

// On-device speech-to-text via whisper.cpp (tiny model, ~78MB). Fully offline after first download.
const WHISPER_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin";
const WHISPER_PATH = FileSystem.documentDirectory + "ggml-tiny.bin";
let ctx: WhisperContext | null = null;

export async function whisperExists(): Promise<boolean> {
  const i = await FileSystem.getInfoAsync(WHISPER_PATH);
  return i.exists && (i.size ?? 0) > 10 * 1024 * 1024;
}
export async function downloadWhisper(onProgress: (f: number) => void): Promise<void> {
  const dl = FileSystem.createDownloadResumable(WHISPER_URL, WHISPER_PATH, {},
    (p) => onProgress(p.totalBytesExpectedToWrite > 0 ? p.totalBytesWritten / p.totalBytesExpectedToWrite : 0));
  await dl.downloadAsync();
}
export async function loadWhisper(): Promise<void> {
  if (ctx) return;
  ctx = await initWhisper({ filePath: WHISPER_PATH });
}
export async function ensureWhisper(onProgress: (f: number) => void): Promise<void> {
  if (!(await whisperExists())) await downloadWhisper(onProgress);
  await loadWhisper();
}
// whisper-tiny is multilingual — pass an ISO code (en/es/hu/de/…) for the spoken language.
// --- Mic capture for whisper ----------------------------------------------------------------
// whisper needs 16 kHz mono 16-bit PCM; expo-audio only records m4a/AAC (which whisper can't read).
// @fugood/react-native-audio-pcm-stream STREAMS raw PCM through its "data" event — it does NOT
// write a WAV file (its native stop() returns nothing). So we accumulate the PCM chunks and hand
// the raw buffer to whisper's transcribeData().
let pcmChunks: Uint8Array[] = [];
let dataHooked = false;

// Minimal base64 -> bytes (no atob/Buffer dependency under Hermes).
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const B64I = (() => { const a = new Int16Array(256).fill(-1); for (let i = 0; i < B64.length; i++) a[B64.charCodeAt(i)] = i; return a; })();
function b64ToBytes(s: string): Uint8Array {
  let len = s.length; while (len > 0 && s[len - 1] === "=") len--;
  const out = new Uint8Array((len * 3) >> 2);
  let o = 0, buf = 0, bits = 0;
  for (let i = 0; i < len; i++) {
    const v = B64I[s.charCodeAt(i)]; if (v < 0) continue;
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 0xff; }
  }
  return o === out.length ? out : out.subarray(0, o);
}

export function startRecording(): void {
  pcmChunks = [];
  LiveAudioStream.init({ sampleRate: 16000, channels: 1, bitsPerSample: 16, audioSource: 6, wavFile: "pr-stt.wav", bufferSize: 4096 });
  if (!dataHooked) {
    LiveAudioStream.on("data", (b64: string) => { pcmChunks.push(b64ToBytes(b64)); });
    dataHooked = true;
  }
  LiveAudioStream.start();
}

// Stop the mic, assemble the streamed raw PCM, and transcribe it. Returns the text ("" if empty).
export async function stopRecordingAndTranscribe(language = "en"): Promise<string> {
  if (!ctx) throw new Error("whisper not loaded");
  LiveAudioStream.stop();
  let total = 0; for (const c of pcmChunks) total += c.length;
  const pcm = new Uint8Array(total); let off = 0;
  for (const c of pcmChunks) { pcm.set(c, off); off += c.length; }
  pcmChunks = [];
  if (total === 0) return "";
  const { promise } = ctx.transcribeData(pcm.buffer as ArrayBuffer, { language });
  const { result } = await promise;
  return (result ?? "").trim();
}

export async function transcribe(audioPath: string, language = "en"): Promise<string> {
  if (!ctx) throw new Error("whisper not loaded");
  const { promise } = ctx.transcribe(audioPath, { language });
  const { result } = await promise;
  return (result ?? "").trim();
}
