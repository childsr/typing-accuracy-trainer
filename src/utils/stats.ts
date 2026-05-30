import { HISTORY_LENGTH } from '../params';
import { GameStats, LetterStat } from '../types';

/**
 * Calculates letter stats (avg reaction time and missed counts) 
 * across the last HISTORY_LENGTH sessions.
 */
export function calculateLetterStats(gameSessions: GameStats[]): LetterStat[] {
  const lastSessions = (gameSessions || []).slice(0, HISTORY_LENGTH);

  const correctTimesMap: Record<string, number[]> = {};
  const missedCountMap: Record<string, number> = {};

  const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
  for (const char of LETTERS) {
    correctTimesMap[char] = [];
    missedCountMap[char] = 0;
  }

  lastSessions.forEach((session) => {
    const logs = session.logs || [];
    if (logs.length === 0) return;

    // Collect correct times from all correct typed characters
    logs.forEach((log) => {
      if (log.correct) {
        const charLower = log.char.toLowerCase();
        if (correctTimesMap[charLower]) {
          correctTimesMap[charLower].push(log.reactionTimeMs);
        }
      }
    });

    // Mark the last log entry if the session ended with an incorrect/missed keystroke
    const finalLog = logs[logs.length - 1];
    if (finalLog && !finalLog.correct) {
      const charLower = finalLog.char.toLowerCase();
      if (typeof missedCountMap[charLower] === 'number') {
        missedCountMap[charLower] += 1;
      }
    }
  });

  return LETTERS.split('').map((char) => {
    const times = correctTimesMap[char];
    const avgTime_ms = times.length > 0
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : 0;

    return {
      letter: char,
      avgTime_ms,
      missedCt: missedCountMap[char] || 0,
    };
  });
}

/**
 * Assigns frequency selection weights to characters based on historical struggle.
 */
export function getCharacterWeights(
  charSet: string,
  gameSessions: GameStats[]
): { char: string; weight: number }[] {
  const stats = calculateLetterStats(gameSessions);
  const statsMap = new Map<string, LetterStat>();
  stats.forEach((s) => statsMap.set(s.letter, s));

  const lastSessions = (gameSessions || []).slice(0, HISTORY_LENGTH);
  const numGames = lastSessions.filter((s) => s.logs && s.logs.length > 0).length;

  return charSet.split('').map((c) => {
    const charLower = c.toLowerCase();
    const stat = statsMap.get(charLower);

    const avgTime = stat ? stat.avgTime_ms : 0;
    const missedCt = stat ? stat.missedCt : 0;

    // "Use the ratio of missedCt to HISTORY_LENGTH (or just total games if the player hasn't played that many games yet)"
    const totalGamesDenom = Math.min(HISTORY_LENGTH, numGames);
    const ratio_missed = totalGamesDenom > 0 ? (missedCt / totalGamesDenom) : 0;

    // Base weight starts at 1.0
    // If they have high reaction times, increase weight (struggle weight)
    // E.g., if avgTime > 0, scaling factor = 1.0 + (avgTime / 500)
    // Else if avgTime == 0, use neutral 1.0
    const speedFactor = avgTime > 0 ? (avgTime / 500) : 1.0;

    // If missed ratio is high, significantly scale up selection probability so they get plenty of practice
    // E.g., multiplier is 1.0 + ratio_missed * 10 (which scales from 1.0x to 11.0x)
    const missedFactor = 1.0 + ratio_missed * 10;

    const weight = speedFactor * missedFactor;

    return {
      char: c.toUpperCase(),
      weight: Math.max(0.1, weight), // limit low end to prevent completely turning off any letters
    };
  });
}

/**
 * Chooses a random character based on weight, excluding the specified character.
 */
export function pickWeightedCharacter(
  weights: { char: string; weight: number }[],
  excludeChar?: string
): string {
  let filtered = excludeChar
    ? weights.filter((w) => w.char !== excludeChar.toUpperCase())
    : weights;

  if (filtered.length === 0) {
    filtered = weights;
  }

  const totalWeight = filtered.reduce((sum, item) => sum + item.weight, 0);
  let randomValue = Math.random() * totalWeight;

  for (const item of filtered) {
    randomValue -= item.weight;
    if (randomValue <= 0) {
      return item.char;
    }
  }

  return filtered[filtered.length - 1]?.char || 'A';
}
