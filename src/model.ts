import { initLlama, type LlamaContext } from "llama.rn";
import * as FileSystem from "expo-file-system/legacy";
import { MODEL, SAMPLER, foldPrompt } from "./preset";

// Model delivery (test builds): download-on-first-run to app storage, then fully offline.
// SHIP note: for the final offline product, bundle the sha-verified GGUF as an asset instead
// (MODEL.sha256). URL below is the public Qwen GGUF of the same quant; VERIFY it loads before ship.
export const MODEL_URL =
  "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/" + MODEL.file;

const MODEL_PATH = FileSystem.documentDirectory + MODEL.file;
let ctx: LlamaContext | null = null;

export async function modelExists(): Promise<boolean> {
  const i = await FileSystem.getInfoAsync(MODEL_PATH);
  return i.exists && (i.size ?? 0) > 100 * 1024 * 1024; // sanity: >100MB
}

export async function downloadModel(onProgress: (frac: number) => void): Promise<void> {
  const dl = FileSystem.createDownloadResumable(
    MODEL_URL, MODEL_PATH, {},
    (p) => onProgress(p.totalBytesExpectedToWrite > 0
      ? p.totalBytesWritten / p.totalBytesExpectedToWrite : 0)
  );
  await dl.downloadAsync();
}

export async function loadModel(): Promise<void> {
  if (ctx) return;
  ctx = await initLlama({ model: MODEL_PATH, n_ctx: MODEL.n_ctx, n_gpu_layers: 0 });
}

// SCR inference — folded single user turn + frozen sampler. `note` is an optional reference note.
export async function ask(question: string, note?: string): Promise<string> {
  if (!ctx) throw new Error("model not loaded");
  const res = await ctx.completion({
    messages: [{ role: "user", content: foldPrompt(question, note) }],
    temperature: SAMPLER.temperature,
    top_p: SAMPLER.top_p,
    seed: SAMPLER.seed,
    n_predict: SAMPLER.n_predict,
    stop: ["<|im_end|>", "<|endoftext|>"],
  });
  return (res.text ?? "").trim();
}

export async function releaseModel(): Promise<void> {
  if (ctx) { await ctx.release(); ctx = null; }
}
