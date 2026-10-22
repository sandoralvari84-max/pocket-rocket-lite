import type { GameModule } from "./contract";
import { catchGame } from "./catch";
// Agents append their modules here (one import + one array entry per game).
export const GAMES: GameModule[] = [catchGame];
