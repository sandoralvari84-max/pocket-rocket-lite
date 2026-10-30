import { initLlama, type LlamaContext } from "llama.rn";
import * as FileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import { MODEL, SAMPLER, foldPrompt } from "./preset";
import { ownerContext } from "./data/profile";
import { searchKB, type KBChunk } from "./data/kb";
import * as Device from "expo-device";
import { getSettings } from "./settings";

// RAG over the bundled knowledge packs. Retrieval is deterministic (searchKB); the
// model only phrases the retrieved passages and must not invent beyond them. With no
// model installed, the caller shows the passages directly (sources, grounded:true).
export type ExpertResult = { answer: string; sources: KBChunk[]; grounded: boolean };

export async function askExpert(question: string, nicheId?: string): Promise<ExpertResult> {
  const chunks = searchKB(question, nicheId, 4);
  if (!chunks.length) {
    return { answer: "I don’t have anything on that in my knowledge packs yet. Try different words, or pick a specific topic.", sources: [], grounded: false };
  }
  if (!ctx) return { answer: "", sources: chunks, grounded: true };
  const notes = chunks.map((c, i) => `[${i + 1}] ${c.title} › ${c.file} › ${c.heading}\n${c.text}`).join("\n\n");
  const system =
    "You are Pocket Rocket's knowledge assistant. Answer the question USING ONLY the reference notes " +
    "provided. If the notes don't cover it, say you don't have that in your knowledge packs. Be concise " +
    "and practical. Never invent facts, numbers or sources beyond the notes.";
  try {
    const res = await ctx.completion({
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Reference notes:\n\n${notes}\n\nQuestion: ${question}` },
      ],
      temperature: 0.3, top_p: 0.9, n_predict: 400, stop: ["<|im_end|>", "<|endoftext|>"],
    });
    return { answer: (res.text ?? "").trim(), sources: chunks, grounded: true };
  } catch {
    // Model error — still return the retrieved passages (deterministic, factual).
    return { answer: "", sources: chunks, grounded: true };
  }
}

// The model canNOT be bundled inside the APK (Metro reads assets into a JS string and
// V8 caps strings at ~512MB). It is delivered ALONGSIDE the app (QuickShare the .gguf with
// the APK) and imported via the file picker, or downloaded over Wi-Fi. Then offline forever.
//
// TWO PROFILES so the app survives low-RAM phones: a 0.5B (~491MB file, ~0.6GB RAM) for
// 4GB devices, and the 4B (Qwen3-4B-Instruct-2507, ~2.5GB file, ~3.5GB RAM) for roomy phones. The active one
// is chosen by device RAM (expo-device) unless the user pins a choice in Settings.
export type ModelProfile = {
  id: "small" | "large"; label: string; file: string; url: string; bytes: number; n_ctx: number;
};
export const MODEL_PROFILES: Record<"small" | "large", ModelProfile> = {
  small: {
    id: "small", label: "0.5B",
    file: "qwen2.5-0.5b-instruct-q4_k_m.gguf",
    url: "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
    bytes: 491400032, n_ctx: 4096,
  },
  large: {
    id: "large", label: "4B",
    file: "Qwen3-4B-Instruct-2507-Q4_K_M.gguf",
    url: "https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q4_K_M.gguf",
    bytes: 2497281120, n_ctx: 8192,
  },
};

// <= ~6GB total RAM picks the 0.5B (safe on 4GB phones); more picks the 4B (needs ~3.5GB free).
const LOW_RAM_BYTES = 6 * 1024 * 1024 * 1024;
export function recommendedProfile(): ModelProfile {
  const total = Device.totalMemory ?? 0; // bytes; 0 = unknown, assume roomy
  return total > 0 && total <= LOW_RAM_BYTES ? MODEL_PROFILES.small : MODEL_PROFILES.large;
}
export function activeProfile(): ModelProfile {
  const pref = getSettings().modelProfile;
  if (pref === "small") return MODEL_PROFILES.small;
  if (pref === "large") return MODEL_PROFILES.large;
  return recommendedProfile();
}
export function activeModelLabel(): string { return activeProfile().label; }
const pathFor = (p: ModelProfile): string => FileSystem.documentDirectory + p.file;
const gb = (bytes: number): string => (bytes / 1e9).toFixed(1);

let ctx: LlamaContext | null = null;

// COMPLETE, not just present: a download interrupted by screen-sleep leaves a
// big-but-partial file that passes a loose check yet fails to load.
export async function modelExists(): Promise<boolean> {
  const p = activeProfile();
  const i = await FileSystem.getInfoAsync(pathFor(p));
  return i.exists && (i.size ?? 0) >= p.bytes - 2 * 1024 * 1024;
}

// Discard a partial/corrupt copy of the ACTIVE model so the next attempt re-fetches clean.
export async function clearModel(): Promise<void> {
  const p = activeProfile();
  try { await FileSystem.deleteAsync(pathFor(p), { idempotent: true }); } catch {}
}

// Import the active model .gguf from a file the user picks (QuickShared beside the APK).
export async function importModel(): Promise<boolean> {
  const p = activeProfile();
  const res = await DocumentPicker.getDocumentAsync({
    type: "*/*",            // .gguf has no registered MIME type, so do not filter it out
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return false;
  const picked = res.assets[0];
  if ((picked.size ?? 0) < p.bytes - 4 * 1024 * 1024) {
    throw new Error(
      `That file looks too small (expected ~${gb(p.bytes)} GB). Pick the ${p.file} shared alongside the app.`
    );
  }
  await clearModel(); // remove any stale/partial copy first
  await FileSystem.copyAsync({ from: picked.uri, to: pathFor(p) });
  if (!(await modelExists())) { await clearModel(); throw new Error("Model copy did not complete — please try again."); }
  return true;
}

export async function downloadModel(onProgress: (frac: number) => void): Promise<void> {
  const p = activeProfile();
  const dl = FileSystem.createDownloadResumable(
    p.url, pathFor(p), {},
    (pr) => onProgress(pr.totalBytesExpectedToWrite > 0
      ? pr.totalBytesWritten / pr.totalBytesExpectedToWrite : 0)
  );
  await dl.downloadAsync();
}

export async function loadModel(): Promise<void> {
  if (ctx) return;
  const p = activeProfile();
  try {
    // On-device tuning (safe, no Android changes): use the fast CPU cluster,
    // enable flash attention when the backend supports it, and a prefill batch.
    // GPU (OpenCL) offload is kept off here as a separate experiment — enabling it
    // on a build without the Vulkan/OpenCL backend can fail the load.
    ctx = await initLlama({
      model: pathFor(p),
      n_ctx: Math.min(p.n_ctx, 2048),
      n_gpu_layers: 0,
      n_threads: 6,
      flash_attn_type: "auto",
      n_batch: 512,
    });
  } catch (e) {
    // A corrupt/partial model will not load. Delete it so Retry re-downloads cleanly.
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

export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function chat(
  question: string,
  persona?: "sentinel" | "nova",
  history: ChatTurn[] = [],
  onToken?: (partial: string) => void,
): Promise<string> {
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
  // Owner memory: who they are + facts they asked to remember (deterministic, user-owned).
  const owner = ownerContext();
  const system = [`${BUDDY_SYSTEM}${tone}`, clockContext, owner].filter(Boolean).join("\n\n");
  // Recent conversation so the buddy actually follows context (trimmed to protect the
  // small model's window).
  const recent = history.slice(-6).map((t) => ({ role: t.role, content: t.content }));
  let acc = "";
  const res = await ctx.completion({
    messages: [
      { role: "system", content: system },
      ...recent,
      { role: "user", content: question },
    ],
    temperature: 0.6,
    top_p: 0.9,
    n_predict: 220,
    stop: ["<|im_end|>", "<|endoftext|>"],
  }, (data) => {
    // Stream tokens to the UI as they generate — the biggest felt-speed win.
    const piece = (data as { token?: string }).token ?? "";
    if (piece) { acc += piece; onToken?.(acc.trim()); }
  });
  const out = (res.text || acc || "").trim();
  // Graceful default when the model runs out of room (hit the token cap) or
  // returns nothing — rather than a cut-off ramble.
  if (!out || (res as { stopped_limit?: number }).stopped_limit) {
    return "I can’t pull together enough to answer that one — I’m a small offline model, so try a shorter or more specific question.";
  }
  return out;
}
