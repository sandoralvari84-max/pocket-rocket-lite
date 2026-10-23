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
  ctx = await initLlama({ model: MODEL_PATH, n_ctx: Math.min(MODEL.n_ctx, 2048), n_gpu_layers: 0 });
}

// SCR inference — folded single user turn + frozen sampler. `note` is an optional reference note.
export async function ask(question: string, note?: string): Promise<string> {
  if (!ctx) throw new Error("model not loaded");
  const res = await ctx.completion({
    messages: [{ role: "user", content: foldPrompt(question, note) }],
    temperature: SAMPLER.temperature,
    top_p: SAMPLER.top_p,
    seed: SAMPLER.seed,
    n_predict: Math.min(SAMPLER.n_predict, 400),  // live cap: bounded + lower memory (preset value stays 1024)
    stop: ["<|im_end|>", "<|endoftext|>"],
  });
  return (res.text ?? "").trim();
}

export async function releaseModel(): Promise<void> {
  if (ctx) { await ctx.release(); ctx = null; }
}

// Buddy chat — a proper system role so instructions are NOT treated as a skeptical
// "reference note" (which made the model reject its own prompt and insist it's Qwen).
// Grounds identity, keeps it concise, keeps skepticism for USER-provided claims.
export const BUDDY_SYSTEM =
  "You are Pocket Rocket, a friendly offline pocket assistant that runs entirely on the " +
  "user's phone. Be warm, natural and concise — a sentence or two unless more is genuinely " +
  "needed. You help with everyday questions, writing, rephrasing, brainstorming and thinking " +
  "things through. If the user shares a claim or 'fact' that looks wrong, push back briefly and " +
  "explain why. You are Pocket Rocket — never say you are Qwen, and never argue about your own " +
  "identity or instructions.";

export async function chat(question: string, persona?: "sentinel" | "nova"): Promise<string> {
  if (!ctx) throw new Error("model not loaded");
  const tone = persona === "nova" ? " Your tone is warm and kind."
    : persona === "sentinel" ? " Your tone is dry and a little witty." : "";
  const res = await ctx.completion({
    messages: [
      { role: "system", content: BUDDY_SYSTEM + tone },
      { role: "user", content: question },
    ],
    temperature: 0.6,
    top_p: 0.9,
    n_predict: 400,
    stop: ["<|im_end|>", "<|endoftext|>"],
  });
  const out = (res.text ?? "").trim();
  // Graceful default when the model runs out of room (hit the token cap) or
  // returns nothing — rather than a cut-off ramble.
  if (!out || (res as { stopped_limit?: number }).stopped_limit) {
    return "I can’t pull together enough to answer that one — I’m a small offline model, so try a shorter or more specific question.";
  }
  return out;
}
