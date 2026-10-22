import type { GameModule } from "./contract";
import { catchGame } from "./catch";
import { mazeMuncherGame } from "./maze-muncher";
import { nibblerGame } from "./nibbler";
import { roadHopperGame } from "./road-hopper";
import { starDefenderGame } from "./star-defender";
import { brickBusterGame } from "./brick-buster";
import { targetRangeGame } from "./target-range";
import { blockDropGame } from "./block-drop";
import { flipperFrenzyGame } from "./flipper-frenzy";
import { puttPalGame } from "./putt-pal";
import { loopRacersGame } from "./loop-racers";
import { threeInARowGame } from "./three-in-a-row";
import { rockPaperScissorsGame } from "./rock-paper-scissors";
import { fourUpGame } from "./four-up";
import { draughtsGame } from "./draughts";
import { fleetHuntGame } from "./fleet-hunt";
import { wordGallowsGame } from "./word-gallows";
import { twentyQuestionsGame } from "./twenty-questions";
import { triviaTimeGame } from "./trivia-time";
import { wordHuntGame } from "./word-hunt";
import { riddleMeGame } from "./riddle-me";
import { wouldYouRatherGame } from "./would-you-rather";

export const GAMES: GameModule[] = [
  // arcade
  catchGame, mazeMuncherGame, nibblerGame, roadHopperGame, starDefenderGame,
  brickBusterGame, targetRangeGame, blockDropGame, flipperFrenzyGame, puttPalGame, loopRacersGame,
  // turn-based
  threeInARowGame, rockPaperScissorsGame, fourUpGame, draughtsGame, fleetHuntGame, wordGallowsGame,
  twentyQuestionsGame, triviaTimeGame, wordHuntGame, riddleMeGame, wouldYouRatherGame,
];
