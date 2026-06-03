import { useEffect, useMemo, useState } from 'react';
import { PlayerHistory, GameMode } from '../types';
import { CHAR_SETS, SPRINT_CHAR_COUNT } from '../params';
import { calculateLetterStats, getCharacterWeights } from '../utils/stats';

interface MainMenuProps {
  history: PlayerHistory;
  selectedCharSetId: string;
  setSelectedCharSetId: (id: string) => void;
  selectedGameMode: GameMode;
  setSelectedGameMode: (mode: GameMode) => void;
  onStartGame: () => void;
  onResetStats: () => void;
}

export default function MainMenu({
  history,
  selectedCharSetId,
  setSelectedCharSetId,
  selectedGameMode,
  setSelectedGameMode,
  onStartGame,
  onResetStats,
}: MainMenuProps) {
  const [isCharSetCollapsed, setIsCharSetCollapsed] = useState(true);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        onStartGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onStartGame]);

  const struggleLetters = useMemo(() => {
    if (!history.gameSessions || history.gameSessions.length === 0) return [];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const weights = getCharacterWeights(alphabet, history.gameSessions);
    const stats = calculateLetterStats(history.gameSessions);
    const statsMap = new Map(stats.map((s) => [s.letter.toUpperCase(), s]));

    return weights
      .map((w) => {
        const stat = statsMap.get(w.char);
        return {
          char: w.char,
          weight: w.weight,
          avgTime_ms: stat ? stat.avgTime_ms : 0,
          missedCt: stat ? stat.missedCt : 0,
        };
      })
      .filter((item) => item.avgTime_ms > 0 || item.missedCt > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);
  }, [history.gameSessions]);

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-2 text-zinc-100 flex flex-col gap-4 font-mono text-xs">
      {/* Mini UTILITY title */}
      <div className="border border-zinc-800 bg-zinc-900 p-4 rounded text-left">
        <h1 className="text-sm font-bold tracking-wider text-zinc-300">
          TYPING ACCURACY TRAINER
        </h1>
        <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
          Type each letter as quickly as possible. Mistyping or timing out ends the run.
          Select Survival mode for an intensifying speed test, or Sprint mode to rush through a fixed set of {SPRINT_CHAR_COUNT} letters.
        </p>
      </div>

      {/* Game Mode Choice */}
      <div className="border border-zinc-800 bg-zinc-900 p-4 rounded flex flex-col gap-3">
        <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold border-b border-zinc-800 pb-1.5">
          CHALLENGE MODE
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            id="mode-select-survival"
            onClick={() => setSelectedGameMode('SURVIVAL')}
            className={`w-full text-left p-3 rounded border flex flex-col gap-1 cursor-pointer transition-colors ${
              selectedGameMode === 'SURVIVAL'
                ? 'bg-zinc-100 border-zinc-200 text-zinc-950'
                : 'bg-zinc-950/40 border-zinc-850 text-zinc-450 hover:border-zinc-750 hover:text-zinc-200'
            }`}
          >
            <span className="font-bold text-xs uppercase tracking-wider">
              Survival
            </span>
            <span className={`text-[10px] leading-snug font-medium ${
              selectedGameMode === 'SURVIVAL' ? 'text-zinc-700' : 'text-zinc-500'
            }`}>
              Timer gets shorter after each correct character. Game over on incorrect character or if timer expires.
            </span>
          </button>

          <button
            id="mode-select-sprint"
            onClick={() => setSelectedGameMode('SPRINT')}
            className={`w-full text-left p-3 rounded border flex flex-col gap-1 cursor-pointer transition-colors ${
              selectedGameMode === 'SPRINT'
                ? 'bg-zinc-100 border-zinc-200 text-zinc-950'
                : 'bg-zinc-950/40 border-zinc-850 text-zinc-450 hover:border-zinc-750 hover:text-zinc-200'
            }`}
          >
            <span className="font-bold text-xs uppercase tracking-wider">
              Sprint
            </span>
            <span className={`text-[10px] leading-snug font-medium ${
              selectedGameMode === 'SPRINT' ? 'text-zinc-700' : 'text-zinc-500'
            }`}>
              No timer. {SPRINT_CHAR_COUNT} keys. Total sprint duration is the benchmark. A single incorrect character fails.
            </span>
          </button>
        </div>
      </div>

      {/* Main interactive setups */}
      <div className="border border-zinc-800 bg-zinc-900 p-4 rounded flex flex-col gap-3">
        <button 
          onClick={() => setIsCharSetCollapsed(!isCharSetCollapsed)}
          className="w-full flex justify-between items-center text-left text-[10px] uppercase tracking-wider text-zinc-400 font-bold border-b border-zinc-800 pb-1.5 cursor-pointer hover:text-zinc-300"
        >
          <span>CHARACTER SET{isCharSetCollapsed && ` - ${CHAR_SETS.find(set => set.id === selectedCharSetId)?.name}`}</span>
          <span>{isCharSetCollapsed ? '[+]' : '[-]'}</span>
        </button>
        
        {!isCharSetCollapsed && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CHAR_SETS.map((set) => {
              const isSelected = selectedCharSetId === set.id;
              return (
                <button
                  id={`charset-select-${set.id}`}
                  key={set.id}
                  onClick={() => setSelectedCharSetId(set.id)}
                  className={`w-full text-left p-2 rounded border flex items-center justify-between cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-zinc-100 border-zinc-200 text-zinc-950 font-bold'
                      : 'bg-zinc-950/40 border-zinc-850 text-zinc-450 hover:border-zinc-750 hover:text-zinc-200'
                  }`}
                >
                  <span>{set.name}</span>
                  <span className={`text-[9px] font-mono select-none px-1.5 py-0.5 rounded ${
                    isSelected ? 'bg-zinc-200 text-zinc-950' : 'bg-zinc-900 text-zinc-500'
                  }`}>
                    {set.chars.length} KEYS
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats container */}
      <div className="border border-zinc-800 bg-zinc-900 p-4 rounded flex flex-col gap-3">
        <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold border-b border-zinc-800 pb-1.5">
          STATS
        </span>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 bg-zinc-950 rounded border border-zinc-850">
            <span className="text-[9px] text-zinc-500 block leading-tight select-none font-semibold">BEST STREAK</span>
            <span className="text-sm font-bold text-amber-500">{history.bestStreak}</span>
          </div>
          <div className="p-2 bg-zinc-950 rounded border border-zinc-850">
            <span className="text-[9px] text-zinc-500 block leading-tight select-none font-semibold">BEST SPRINT</span>
            <span className="text-sm font-bold text-blue-400">
              {history.bestSprintTimeMs !== undefined ? `${(history.bestSprintTimeMs / 1000).toFixed(2)}s` : 'N/A'}
            </span>
          </div>
          <div className="p-2 bg-zinc-950 rounded border border-zinc-850">
            <span className="text-[9px] text-zinc-500 block leading-tight select-none font-semibold font-mono">KEYS TYPED</span>
            <span className="text-sm font-bold text-zinc-200">{history.totalKeysTyped}</span>
          </div>
        </div>

        {struggleLetters.length > 0 && (
          <div className="border border-zinc-850/60 bg-zinc-950/20 p-3 rounded flex flex-col gap-1.5 mt-1">
            <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-bold border-b border-zinc-850 pb-1 select-none">
              HISTORICAL WEAK SPOTS (MORE FREQUENT)
            </span>
            <div className="grid grid-cols-5 gap-1.5 text-center">
              {struggleLetters.map((item) => (
                <div key={item.char} className="p-1 px-1.5 block bg-zinc-950/60 rounded border border-zinc-850">
                  <span className="text-xs font-bold text-zinc-200 block">
                    {item.char}
                  </span>
                  <span className="text-[8px] text-zinc-450 block leading-tight">
                    {item.avgTime_ms > 0 ? `${item.avgTime_ms}ms` : 'No data'}
                  </span>
                  {item.missedCt > 0 && (
                    <span className="text-[8px] text-red-450 block leading-tight font-bold">
                      {item.missedCt}x Fails
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {history.totalKeysTyped > 0 && (
          <button
            id="btn-reset-stats"
            onClick={onResetStats}
            className="w-full text-center py-1 text-[9px] text-zinc-500 hover:text-red-400 border border-dashed border-zinc-800 hover:border-red-900/40 rounded transition-colors cursor-pointer"
          >
            Purge Cached Stats
          </button>
        )}
      </div>

      {/* Start Button */}
      <button
        id="btn-start-game"
        onClick={onStartGame}
        className="w-full text-center py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 border border-zinc-200 text-xs font-bold uppercase tracking-widest rounded cursor-pointer transition-colors"
      >
        INITIATE_SPEED_TEST [ENTER]
      </button>
    </div>
  );
}
