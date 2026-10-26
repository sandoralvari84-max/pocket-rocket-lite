import { initWhisper, type WhisperContext } from "whisper.rn";
import * as FileSystem from "expo-file-system/legacy";

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
export async function transcribe(audioPath: string, language = "en"): Promise<string> {
  if (!ctx) throw new Error("whisper not loaded");
  const { promise } = ctx.transcribe(audioPath, { language });
  const { result } = await promise;
  return (result ?? "").trim();
}
