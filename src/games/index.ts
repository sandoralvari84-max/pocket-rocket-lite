import type { GameModule } from "./contract";
import { catchGame } from "./catch";
import { mazeMuncherGame } from "./maze-muncher";
import { nibblerGame } from "./nibbler";
import { roadHopperGame } from "./road-hopper";
import { blockDropGame } from "./block-drop";
import { flipperFrenzyGame } from "./flipper-frenzy";
import { puttPalGame } from "./putt-pal";
import { threeInARowGame } from "./three-in-a-row";
import { rockPaperScissorsGame } from "./rock-paper-scissors";
import { fourUpGame } from "./four-up";
import { draughtsGame } from "./draughts";
import { fleetHuntGame } from "./fleet-hunt";
import { wordGallowsGame } from "./word-gallows";
import { twentyQuestionsGame } from "./twenty-questions";

export const GAMES: GameModule[] = [
  // arcade
  catchGame, mazeMuncherGame, nibblerGame, roadHopperGame,
  blockDropGame, flipperFrenzyGame, puttPalGame,
  // turn-based
  threeInARowGame, rockPaperScissorsGame, fourUpGame, draughtsGame, fleetHuntGame, wordGallowsGame,
  twentyQuestionsGame,
];
