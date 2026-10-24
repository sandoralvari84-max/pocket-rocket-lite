import { initLlama, type LlamaContext } from "llama.rn";
import * as FileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import { MODEL, SAMPLER, foldPrompt } from "./preset";

// The ~1GB model canNOT be bundled inside the APK: Metro's asset transformer reads the
// whole file into a JS string and V8 caps strings at ~512MB, so require()-ing the .gguf
// always fails to bundle. Instead the model is delivered ALONGSIDE the app (QuickShare a
// folder with the APK + the .gguf) and imported once via the system file picker, or
// downloaded over Wi-Fi as a fallback. Either way it then runs fully offline forever.
export const MODEL_URL =
  "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/" + MODEL.file;

const MODEL_PATH = FileSystem.documentDirectory + MODEL.file;
const EXPECTED_SIZE = 1117320736; // full q4_k_m .gguf; a partial download is smaller
let ctx: LlamaContext | null = null;

// COMPLETE, not just present: a download interrupted by screen-sleep leaves a
// big-but-partial file that passes a ">100MB" check yet fails to load.
export async function modelExists(): Promise<boolean> {
  const i = await FileSystem.getInfoAsync(MODEL_PATH);
  return i.exists && (i.size ?? 0) >= EXPECTED_SIZE - 1024 * 1024;
}

// Discard a partial/corrupt model so the next attempt re-fetches a clean copy.
export async function clearModel(): Promise<void> {
  try { await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true }); } catch {}
}

// Import the model from a file the user picks — the .gguf that was QuickShared in the
// same folder as the APK. Copies it into app storage once; then fully offline forever.
// Returns false if the user cancels the picker. Uses the system picker (access to the one
// chosen file only), so it needs no broad storage permission. Screen-sleep-proof: a local
// file copy, not a network download that Android can pause when the screen turns off.
export async function importModel(): Promise<boolean> {
  const res = await DocumentPicker.getDocumentAsync({
    type: "*/*",            // .gguf has no registered MIME type, so don't filter it out
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return false;
  const picked = res.assets[0];
  if ((picked.size ?? 0) < EXPECTED_SIZE - 1024 * 1024) {
    throw new Error(
      "That file looks too small to be the model (expected ~1 GB). " +
      "Pick the qwen2.5-1.5b…q4_k_m.gguf file shared alongside the app."
    );
  }
  await clearModel(); // remove any stale/partial copy first
  await FileSystem.copyAsync({ from: picked.uri, to: MODEL_PATH });
  if (!(await modelExists())) { await clearModel(); throw new Error("Model copy did not complete — please try again."); }
  return true;
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
  try {
    ctx = await initLlama({ model: MODEL_PATH, n_ctx: Math.min(MODEL.n_ctx, 2048), n_gpu_layers: 0 });
  } catch (e) {
    // A corrupt/partial model won't load — delete it so Retry re-downloads cleanly
    // instead of looping on the broken file.
    await clearModel();
    ctx = null;
    throw e;
  }
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
  // The model's training data cannot answer current-date questions. Supply the device
  // clock and timezone on every turn; scheduling and date arithmetic must still be done
  // by deterministic application code, never inferred from this prompt context.
  const now = new Date();
  const formatter = new Intl.DateTimeFormat();
  const locale = formatter.resolvedOptions().locale || "en";
  const timeZone = formatter.resolvedOptions().timeZone || "device local time";
  const localNow = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "long",
  }).format(now);
  const clockContext = `Authoritative device date/time: ${localNow} (${timeZone}). ` +
    `UTC instant: ${now.toISOString()}. Use this context for questions about the current date or time. ` +
    "Do not guess dates for reminders or perform date arithmetic; the app must resolve those deterministically.";
  const res = await ctx.completion({
    messages: [
      { role: "system", content: `${BUDDY_SYSTEM}${tone}\n\n${clockContext}` },
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
