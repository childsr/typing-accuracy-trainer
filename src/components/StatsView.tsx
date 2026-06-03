import { useEffect, useMemo } from 'react';
import { KeystrokeLog, PlayerHistory } from '../types';
import { calculateLetterStats, getCharacterWeights } from '../utils/stats';
import { HISTORY_LENGTH } from '../params';

interface StatsViewProps {
  streak: number;
  logs: KeystrokeLog[];
  history: PlayerHistory;
  onRetry: () => void;
  onGoHome: () => void;
}

export default function StatsView({
  streak,
  logs,
  history,
  onRetry,
  onGoHome,
}: StatsViewProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        onRetry();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onRetry]);

  // Retrieve the top 4 weak spot characters historically
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
      .slice(0, 4);
  }, [history.gameSessions]);

  const lastSession = history.gameSessions[0];
  const isSprintMode = lastSession?.mode === 'SPRINT';
  const isCompletedSprint = isSprintMode && lastSession?.completed;
  const isNewSprintRecord = isCompletedSprint && lastSession?.totalTimeMs === history.bestSprintTimeMs;
  const isNewMaxStreak = !isSprintMode && streak > 0 && streak === history.bestStreak;

  const isNewRecord = isSprintMode ? isNewSprintRecord : isNewMaxStreak;
  const recordLabel = isSprintMode ? 'NEW BEST SPRINT' : 'NEW MAX STREAK';

  const correctLogs = logs.filter((l) => l.correct);
  const avgReactionTime = 
    correctLogs.length > 0
      ? (lastSession.totalTimeMs / correctLogs.length).toFixed(0)
      : "N/A";

  // Find trouble keys: keys that were missed OR had the slowest reaction times
  const troubleKeysMap: Record<string, { count: number; incorrectCount: number; sumReactionTime: number }> = {};
  logs.forEach((log) => {
    const char = log.char.toUpperCase();
    if (!troubleKeysMap[char]) {
      troubleKeysMap[char] = { count: 0, incorrectCount: 0, sumReactionTime: 0 };
    }
    troubleKeysMap[char].count += 1;
    if (!log.correct) {
      troubleKeysMap[char].incorrectCount += 1;
    } else {
      troubleKeysMap[char].sumReactionTime += log.reactionTimeMs;
    }
  });

  const troubleKeysList = Object.entries(troubleKeysMap)
    .map(([char, stats]) => {
      const avgTime = stats.count - stats.incorrectCount > 0 
        ? Math.round(stats.sumReactionTime / (stats.count - stats.incorrectCount))
        : 9999;
      return {
        char,
        errorCount: stats.incorrectCount,
        avgTime,
        frictionLevel: stats.incorrectCount * 500 + avgTime
      };
    })
    .sort((a, b) => b.frictionLevel - a.frictionLevel)
    .slice(0, 4);

  // Configure SVG graph
  const chartWidth = 700;
  const chartHeight = 160;
  const chartPaddingLeft = 45;
  const chartPaddingRight = 15;
  const chartPaddingTop = 20;
  const chartPaddingBottom = 25;

  const chartData = logs.slice(-20);
  const maxTime = Math.max(...chartData.map((d) => d.reactionTimeMs), 600);
  const minTime = 0;

  const getX = (index: number) => {
    if (chartData.length <= 1) return chartPaddingLeft + (chartWidth - chartPaddingLeft - chartPaddingRight) / 2;
    const step = (chartWidth - chartPaddingLeft - chartPaddingRight) / (chartData.length - 1);
    return chartPaddingLeft + index * step;
  };

  const getY = (timeMs: number) => {
    const range = maxTime - minTime;
    const heightRange = chartHeight - chartPaddingTop - chartPaddingBottom;
    return chartHeight - chartPaddingBottom - ((timeMs - minTime) / range) * heightRange;
  };

  let linePath = '';
  chartData.forEach((point, idx) => {
    const x = getX(idx);
    const y = getY(point.reactionTimeMs);
    if (idx === 0) {
      linePath += `M ${x} ${y}`;
    } else {
      linePath += ` L ${x} ${y}`;
    }
  });

  // Custom texts based on gameMode outcomes
  const titleText = isSprintMode 
    ? (isCompletedSprint ? '[SPRINT_COMPLETED]' : '[SPRINT_FAILED]') 
    : '[SESSION_COMPLETED]';
  const descriptionText = isSprintMode
    ? (isCompletedSprint 
        ? 'Incredible! You completed all 30 characters of the sprint successfully.' 
        : `Sprint failed. Mistake made at position ${streak + 1} of 30.`
      )
    : 'Reflex speed diagnostics compiled. All latency levels mapped below.';

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-2 text-zinc-100 flex flex-col gap-4 font-mono text-xs">
      {/* Concluding status board */}
      <div className="border border-zinc-800 bg-zinc-900 p-4 rounded text-left flex justify-between items-center z-10">
        <div>
          <span className="text-[10px] text-zinc-500 uppercase block">Terminal Log</span>
          <h1 className="text-sm font-bold tracking-wider text-zinc-300">
            {titleText}
          </h1>
          <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
            {descriptionText}
          </p>
        </div>
        {isNewRecord && (
          <span className="text-[9px] text-amber-500 font-bold bg-amber-955/40 border border-amber-900/55 px-2 py-0.5 rounded animate-pulse">
            {recordLabel}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Core performance metric matrix */}
        <div className="border border-zinc-800 bg-zinc-900/60 p-4 rounded flex flex-col gap-3">
          <span className="text-[10px] uppercase text-zinc-400 font-bold border-b border-zinc-800 pb-1 select-none">
            SESSION RESULTS
          </span>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-center">
            {/* Box 1 */}
            {isSprintMode ? (
              <div className={`p-4 rounded border flex flex-col justify-center items-center ${
                isCompletedSprint ? 'bg-emerald-950/40 border-emerald-800/80' : 'bg-rose-950/30 border-rose-900/50'
              }`}>
                <span className="text-[10px] text-zinc-500 block uppercase tracking-wider font-semibold select-none">SPRINT STATUS</span>
                <span className={`text-sm font-black mt-1 font-sans ${isCompletedSprint ? 'text-green-400' : 'text-red-400'}`}>
                  {isCompletedSprint ? 'COMPLETED' : 'FAILED'}
                </span>
                <span className="text-[8px] text-zinc-400 block mt-1 uppercase font-medium">{streak} / 30 KEYS</span>
              </div>
            ) : (
              <div className={`p-4 rounded border flex flex-col justify-center items-center ${isNewMaxStreak ? 'bg-amber-955 border-amber-600/70' : 'bg-zinc-950/40 border-zinc-850'}`}>
                <span className="text-[10px] text-zinc-500 block uppercase tracking-wider font-semibold select-none">FINAL STREAK</span>
                <span className="text-2xl font-black text-amber-500 font-sans mt-1">{streak}</span>
                {isNewMaxStreak && <span className="text-[8px] text-amber-550 block uppercase font-black mt-1.5 tracking-wider animate-pulse">[NEW ALL-TIME RECORD]</span>}
              </div>
            )}

            {/* Box 2 */}
            {isSprintMode ? (
              <div className={`p-4 rounded border flex flex-col justify-center items-center ${
                isNewSprintRecord ? 'bg-blue-950/40 border-blue-600/70 animate-pulse' : 'bg-zinc-950/40 border-zinc-850'
              }`}>
                <span className="text-[10px] text-zinc-500 block uppercase tracking-wider font-semibold select-none">TOTAL SPRINT TIME</span>
                <span className="text-2xl font-black mt-1 font-sans text-blue-400">
                  {isCompletedSprint && lastSession?.totalTimeMs !== undefined 
                    ? `${(lastSession.totalTimeMs / 1000).toFixed(2)}s` 
                    : 'N/A'
                  }
                </span>
                {isNewSprintRecord && <span className="text-[8px] text-blue-300 block uppercase font-black mt-1 tracking-wider">[NEW BEST TIME]</span>}
                {!isCompletedSprint && <span className="text-[8px] text-red-400 block uppercase font-black mt-1 tracking-wider">[FAILED RUN]</span>}
              </div>
            ) : (
              <div className="p-4 bg-zinc-950/40 rounded border border-zinc-850 flex flex-col justify-center items-center">
                <span className="text-[10px] text-zinc-500 block uppercase tracking-wider font-semibold select-none">ALL-TIME BEST</span>
                <span className="text-2xl font-black text-amber-500 mt-1 font-sans">{history.bestStreak}</span>
                <span className="text-[8px] text-zinc-400 block mt-1.5 uppercase font-medium">STREAK TARGET</span>
              </div>
            )}

            {/* Box 3 */}
            <div className="p-4 bg-zinc-950/40 rounded border border-zinc-850 col-span-2 md:col-span-1 flex flex-col justify-center items-center">
              <span className="text-[10px] text-zinc-500 block uppercase tracking-wider font-semibold select-none">AVG LATENCY</span>
              <span className="text-2xl font-black text-zinc-200 mt-1 font-sans">{avgReactionTime}ms</span>
              <span className="text-[8px] text-zinc-400 block mt-1.5 uppercase font-medium">TACTILE REFLEX</span>
            </div>
          </div>
        </div>

        {/* Chronological reaction graph */}
        <div className="border border-zinc-800 bg-zinc-900/60 p-4 rounded flex flex-col justify-between">
          <span className="text-[10px] uppercase text-zinc-400 font-bold border-b border-zinc-800 pb-2 select-none">
            LATENCY DIAGRAM (CHRONOLOGICAL ORDER)
          </span>

          {chartData.length > 0 ? (
            <div className="mt-2 w-full">
              <div className="w-full h-[150px]">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
                  <line x1={chartPaddingLeft} y1={getY(0)} x2={chartWidth - chartPaddingRight} y2={getY(0)} stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1={chartPaddingLeft} y1={getY(maxTime * 0.5)} x2={chartWidth - chartPaddingRight} y2={getY(maxTime * 0.5)} stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1={chartPaddingLeft} y1={getY(maxTime)} x2={chartWidth - chartPaddingRight} y2={getY(maxTime)} stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />

                  <text x={chartPaddingLeft - 6} y={getY(0) + 3} textAnchor="end" className="fill-zinc-400 text-[10px]">0ms</text>
                  <text x={chartPaddingLeft - 6} y={getY(maxTime * 0.5) + 3} textAnchor="end" className="fill-zinc-400 text-[10px]">{Math.round(maxTime / 2)}ms</text>
                  <text x={chartPaddingLeft - 6} y={getY(maxTime) + 3} textAnchor="end" className="fill-zinc-400 text-[10px]">{Math.round(maxTime)}ms</text>

                  <path d={linePath} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

                  {chartData.map((d, idx) => {
                    const cx = getX(idx);
                    const cy = getY(d.reactionTimeMs);
                    return (
                      <g key={idx}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r="3.5"
                          className={d.correct ? (d.reactionTimeMs < 750 ? "fill-green-400" : "fill-amber-400") : "fill-red-500"}
                        />
                        <text
                          x={cx}
                          y={cy - 6}
                          textAnchor="middle"
                          className="fill-zinc-400 font-semibold text-[8px]"
                        >
                          {d.char}
                        </text>
                      </g>
                    );
                  })}
                  
                  <line 
                    x1={chartPaddingLeft} 
                    y1={chartHeight - chartPaddingBottom} 
                    x2={chartWidth - chartPaddingRight} 
                    y2={chartHeight - chartPaddingBottom} 
                    stroke="#64748b" 
                    strokeWidth="1" 
                  />
                </svg>
              </div>
              <div className="flex justify-between text-[9px] text-zinc-650 px-1 mt-1 font-mono uppercase">
                <span>Start</span>
                <span className="flex gap-3">
                  <span><span className="w-1.5 h-1.5 inline-block bg-green-400 rounded-full" /> FAST (&lt;750ms)</span>
                  <span><span className="w-1.5 h-1.5 inline-block bg-amber-400 rounded-full" /> ACCEP</span>
                  <span><span className="w-1.5 h-1.5 inline-block bg-red-500 rounded-full" /> FAIL/MISS</span>
                </span>
                <span>End</span>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-zinc-600 text-center py-6">
              No keystroke logging generated.
            </div>
          )}
        </div>

        {/* Trouble friction keys list */}
        {troubleKeysList.length > 0 && (
          <div className="border border-zinc-800 bg-zinc-900/60 p-4 rounded flex flex-col gap-2">
            <span className="text-[10px] uppercase text-zinc-400 font-bold border-b border-zinc-800 pb-1.5 select-none font-mono">
              SESSION FRICTION KEY MAP
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {troubleKeysList.map((stat) => (
                <div
                  key={stat.char}
                  className="p-2 border border-zinc-800 bg-zinc-950/40 rounded flex flex-col items-center justify-center text-center text-xs"
                >
                  <span className="text-xs font-bold text-zinc-200 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                    {stat.char}
                  </span>
                  <span className="text-[9px] text-zinc-500 mt-1 block font-mono">
                    Lat: {stat.avgTime}ms
                  </span>
                  {stat.errorCount > 0 && (
                    <span className="text-[8px] text-red-400 block font-mono font-bold mt-0.5 leading-none">
                      {stat.errorCount}x Failed
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Historical Adaptive Weak Spots */}
        {struggleLetters.length > 0 && (
          <div className="border border-zinc-800 bg-zinc-900/60 p-4 rounded flex flex-col gap-2">
            <span className="text-[10px] uppercase text-zinc-400 font-bold border-b border-zinc-800 pb-1.5 select-none font-mono">
              HISTORICAL WEAK SPOTS (LAST {HISTORY_LENGTH} GAMES)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {struggleLetters.map((item) => (
                <div
                  key={item.char}
                  className="p-2 border border-zinc-800 bg-zinc-950/40 rounded flex flex-col items-center justify-center text-center text-xs"
                >
                  <span className="text-xs font-bold text-zinc-200 bg-zinc-850 px-2.5 py-0.5 rounded border border-zinc-800">
                    {item.char}
                  </span>
                  <span className="text-[9px] text-zinc-500 mt-1 block font-mono">
                    Lat: {item.avgTime_ms > 0 ? `${item.avgTime_ms}ms` : 'No data'}
                  </span>
                  {item.missedCt > 0 && (
                    <span className="text-[9px] text-red-400 block font-mono font-bold leading-none mt-1">
                      {item.missedCt}x Failed
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="grid grid-cols-2 gap-3 mt-2">
        <button
          id="btn-retry"
          onClick={onRetry}
          className="w-full text-center py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 border border-zinc-200 text-xs font-bold uppercase tracking-widest rounded cursor-pointer transition-colors"
        >
          RETRY_SESSION [ENTER]
        </button>
        <button
          id="btn-go-home"
          onClick={onGoHome}
          className="w-full text-center py-3 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-850 text-xs font-bold uppercase tracking-widest rounded cursor-pointer transition-colors"
        >
          [RETURN_MENU]
        </button>
      </div>
    </div>
  );
}
