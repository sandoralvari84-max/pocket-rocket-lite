# Game module spec — Skeptic Lite (read before writing any game)

Stack: Expo SDK 54, React Native 0.81, TypeScript STRICT. Project root: D:\skeptic-lite-build\skeptic-lite
Contract: src/games/contract.ts (GameModule, GameContext, AskModel).

## Each game = ONE self-contained file: src/games/<id>.tsx
Export exactly: `export const <camelId>Game: GameModule = { id, title, kind, Screen };`
- id: kebab-case, unique, matches filename (e.g. "maze-muncher" -> maze-muncher.tsx, export mazeMuncherGame).
- title: ORIGINAL name. NEVER a real branded title (no Tetris/Pac-Man/Snake-brand/Connect Four™ etc.) in name OR art.
- kind: "arcade" (deterministic, NO LLM) or "turn-based" (LLM opponent/banter via ctx.ask).
- Screen: React.ComponentType<GameContext>. GameContext = { ask(question, note?)=>Promise<string>, onExit()=>void }.

## Rules
- Full-screen <View>. Visible "← Menu" button at TOP calling onExit, positioned with useSafeAreaInsets()
  top inset (import { useSafeAreaInsets } from "react-native-safe-area-context") so it clears the status bar.
- Arcade: react-native-game-engine (installed) OR plain RN + useState/useRef + requestAnimationFrame. Touch controls.
  Clean up all loops/timers on unmount (useEffect return).
- Turn-based: use ctx.ask(prompt) for the opponent's move/banter. Keep ask calls short; handle the string reply
  defensively (it's a lite model — parse loosely, fall back gracefully). Model NEVER controls real-time logic.
- "Assets" = simple colored Views / Text / emoji only. Original. No copyrighted images.
- MUST pass `npx tsc --noEmit` strict. Prefer a SIMPLE working version over an ambitious broken one.
- Write ONLY your assigned game file(s). Do NOT touch src/games/index.ts, App.tsx, Home.tsx, or any shared file.
- Report back: each game's export const name + filename.
