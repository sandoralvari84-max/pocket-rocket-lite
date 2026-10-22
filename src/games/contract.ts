import type React from "react";
// FROZEN game-module contract. Every game (arcade or turn-based) is one GameModule.
// Arcade games ignore `ask`; turn-based games use it for the LLM opponent/banter.
export type AskModel = (question: string, note?: string) => Promise<string>;

export interface GameContext {
  ask: AskModel;            // inference interface (turn-based games only)
  onExit: () => void;       // return to the launcher
}

export interface GameModule {
  id: string;               // kebab-case unique
  title: string;            // original name (NEVER a real branded title)
  kind: "arcade" | "turn-based";
  // A self-contained screen. Owns its own assets/state. Must clean up on unmount.
  Screen: React.ComponentType<GameContext>;
}
