export type GameStatus = 'MENU' | 'PLAYING' | 'GAMEOVER';
export type GameMode = 'SURVIVAL' | 'SPRINT';

export interface GameStats {
  mode: GameMode;
  streak: number; // Concluding letter streak count
  date: string;
  avgReactionTimeMs: number;
  logs?: KeystrokeLog[]; // Saved logs for statistics calculation
  completed?: boolean; // For SPRINT mode: indicates if completed successfully
  totalTimeMs?: number; // For SPRINT mode: total time taken when completed
}

export interface KeystrokeLog {
  char: string;
  reactionTimeMs: number;
  correct: boolean;
}

export interface LetterStat {
  letter: string; // Lowercase letter, e.g. 'a'
  avgTime_ms: number; // Avg reaction time in milliseconds
  missedCt: number; // Count of times it ended the session as incorrect/missed
}

export interface PlayerHistory {
  bestStreak: number; // Best survival streak
  bestSprintTimeMs?: number; // Lowest sprint time (when fully completed)
  totalKeysTyped: number;
  totalErrors: number;
  avgReactionTimeMs: number;
  gameSessions: GameStats[];
}

