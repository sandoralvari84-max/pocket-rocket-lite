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
// Mic capture for whisper. whisper needs 16 kHz mono 16-bit PCM/WAV — expo-audio only produces
// m4a/AAC (which whisper can't read), so we record with the native PCM recorder instead and hand
// the resulting WAV straight to transcribe(). init → start → stop; stop() resolves to the WAV path.
export function startRecording(): void {
  LiveAudioStream.init({ sampleRate: 16000, channels: 1, bitsPerSample: 16, audioSource: 6, wavFile: "pr-stt.wav", bufferSize: 4096 });
  LiveAudioStream.start();
}
export async function stopRecording(): Promise<string> {
  return LiveAudioStream.stop(); // resolves to the recorded 16 kHz mono WAV file path
}

export async function transcribe(audioPath: string, language = "en"): Promise<string> {
  if (!ctx) throw new Error("whisper not loaded");
  const { promise } = ctx.transcribe(audioPath, { language });
  const { result } = await promise;
  return (result ?? "").trim();
}
