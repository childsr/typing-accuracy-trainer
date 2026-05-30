import { useState, useEffect } from 'react';
import { GameStatus, KeystrokeLog, PlayerHistory, GameStats, GameMode } from './types';
import { CHAR_SETS, STORAGE_KEY_HISTORY } from './params';
import MainMenu from './components/MainMenu';
import GameScreen from './components/GameScreen';
import StatsView from './components/StatsView';

const INITIAL_HISTORY: PlayerHistory = {
  bestStreak: 0,
  bestSprintTimeMs: undefined,
  totalKeysTyped: 0,
  totalErrors: 0,
  avgReactionTimeMs: 0,
  gameSessions: []
};

export default function App() {
  const [status, setStatus] = useState<GameStatus>('MENU');
  const [selectedCharSetId, setSelectedCharSetId] = useState<string>('all');
  const [selectedGameMode, setSelectedGameMode] = useState<GameMode>('SURVIVAL');
  const [sessionStreak, setSessionStreak] = useState<number>(0);
  const [sessionLogs, setSessionLogs] = useState<KeystrokeLog[]>([]);
  const [history, setHistory] = useState<PlayerHistory>(INITIAL_HISTORY);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (stored) {
        const parsed = JSON.parse(stored);

        // Robust migration: if storing a legacy object for bestStreak, collapse it to a number.
        let parsedBestStreak = 0;
        if (parsed.bestStreak && typeof parsed.bestStreak === 'object') {
          parsedBestStreak = Math.max(...Object.values(parsed.bestStreak).map((v: any) => typeof v === 'number' ? v : 0), 0);
        } else if (typeof parsed.bestStreak === 'number') {
          parsedBestStreak = parsed.bestStreak;
        }

        const merged: PlayerHistory = {
          bestStreak: parsedBestStreak,
          bestSprintTimeMs: typeof parsed.bestSprintTimeMs === 'number' ? parsed.bestSprintTimeMs : undefined,
          totalKeysTyped: typeof parsed.totalKeysTyped === 'number' ? parsed.totalKeysTyped : 0,
          totalErrors: typeof parsed.totalErrors === 'number' ? parsed.totalErrors : 0,
          avgReactionTimeMs: typeof parsed.avgReactionTimeMs === 'number' ? parsed.avgReactionTimeMs : 0,
          gameSessions: Array.isArray(parsed.gameSessions) ? parsed.gameSessions : []
        };
        setHistory(merged);
      }
    } catch {
      // Safe fallback
    }
  }, []);

  // Save history helper
  const saveHistory = (newHistory: PlayerHistory) => {
    setHistory(newHistory);
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(newHistory));
    } catch {
      // Storage quota or restrictions
    }
  };

  // Reset metrics
  const handleResetHistory = () => {
    if (confirm('Are you sure you want to reset your local stats and high scores?')) {
      saveHistory(INITIAL_HISTORY);
    }
  };

  // Handle Game End - update history records
  const handleGameEnd = (
    finalStreak: number,
    logs: KeystrokeLog[],
    mode: GameMode,
    completed?: boolean,
    totalTimeMs?: number
  ) => {
    setSessionStreak(finalStreak);
    setSessionLogs(logs);

    // Filter correct steps
    const correctSteps = logs.filter((l) => l.correct);
    const avgSessionReactionMs =
      correctSteps.length > 0
        ? correctSteps.reduce((sum, p) => sum + p.reactionTimeMs, 0) / correctSteps.length
        : 0;

    // Build new metrics
    let newBestStreak = history.bestStreak;
    let newBestSprintTimeMs = history.bestSprintTimeMs;

    if (mode === 'SURVIVAL') {
      newBestStreak = Math.max(history.bestStreak, finalStreak);
    } else if (mode === 'SPRINT' && completed && totalTimeMs) {
      if (newBestSprintTimeMs === undefined) {
        newBestSprintTimeMs = totalTimeMs;
      } else {
        newBestSprintTimeMs = Math.min(newBestSprintTimeMs, totalTimeMs);
      }
    }

    const newKeysCount = history.totalKeysTyped + logs.length;
    const newErrorsCount = history.totalErrors + logs.filter((l) => !l.correct).length;

    // Weight reaction time correctly
    let overallAvgTime = history.avgReactionTimeMs;
    const totalCorrectSoFar = history.totalKeysTyped - history.totalErrors;
    const currentCorrectCount = correctSteps.length;
    if (totalCorrectSoFar + currentCorrectCount > 0) {
      overallAvgTime = Math.round(
        (history.avgReactionTimeMs * totalCorrectSoFar +
          avgSessionReactionMs * currentCorrectCount) /
          (totalCorrectSoFar + currentCorrectCount)
      );
    }

    // Capture new session detail
    const newSession: GameStats = {
      mode: mode,
      streak: finalStreak,
      date: new Date().toLocaleDateString(),
      avgReactionTimeMs: avgSessionReactionMs,
      logs: logs,
      completed: completed,
      totalTimeMs: totalTimeMs
    };

    // Keep max 25 logs in history list to save space
    const updatedSessions = [newSession, ...history.gameSessions].slice(0, 25);

    const updatedHistory: PlayerHistory = {
      bestStreak: newBestStreak,
      bestSprintTimeMs: newBestSprintTimeMs,
      totalKeysTyped: newKeysCount,
      totalErrors: newErrorsCount,
      avgReactionTimeMs: overallAvgTime,
      gameSessions: updatedSessions
    };

    saveHistory(updatedHistory);
    setStatus('GAMEOVER');
  };

  const activeCharSet = CHAR_SETS.find((c) => c.id === selectedCharSetId) || CHAR_SETS[0];

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-200 flex flex-col justify-between selection:bg-zinc-700 selection:text-white">
      {/* Main Container */}
      <main className="flex-grow flex flex-col justify-center py-6">
        {status === 'MENU' && (
          <MainMenu
            history={history}
            selectedCharSetId={selectedCharSetId}
            setSelectedCharSetId={setSelectedCharSetId}
            selectedGameMode={selectedGameMode}
            setSelectedGameMode={setSelectedGameMode}
            onStartGame={() => setStatus('PLAYING')}
            onResetStats={handleResetHistory}
          />
        )}

        {status === 'PLAYING' && (
          <GameScreen
            charSet={activeCharSet.chars}
            charSetName={activeCharSet.name}
            gameSessions={history.gameSessions}
            gameMode={selectedGameMode}
            onGameEnd={handleGameEnd}
            onGoBack={() => setStatus('MENU')}
          />
        )}

        {status === 'GAMEOVER' && (
          <StatsView
            streak={sessionStreak}
            logs={sessionLogs}
            history={history}
            onRetry={() => setStatus('PLAYING')}
            onGoHome={() => setStatus('MENU')}
          />
        )}
      </main>


      {/* Footer bar */}
      <footer className="py-3.5 border-t border-zinc-900/60 bg-zinc-950/30 text-center text-[10px] text-zinc-650 font-mono mt-auto select-none">
        <div className="max-w-2xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>LATENCY_CALIBRATED_ENGINE // 2026</span>
          <div className="flex gap-4">
            <span>STRICT_ERR_MATCHING: ON</span>
            <span>LATENCY: CALIBRATED</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
