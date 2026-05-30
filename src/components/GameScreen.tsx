import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { KeystrokeLog, GameStats, GameMode } from '../types';
import { 
  getTimerLimitMs, 
  INSTANT_FEEDBACK_DURATION_MS,
  SPRINT_CHAR_COUNT
} from '../params';
import { playCorrectSound, playIncorrectSound, playCountdownTickingSound } from '../utils/audio';
import { getCharacterWeights, pickWeightedCharacter } from '../utils/stats';

interface GameScreenProps {
  charSet: string;
  charSetName: string;
  gameSessions: GameStats[];
  gameMode: GameMode;
  onGameEnd: (
    finalStreak: number,
    logs: KeystrokeLog[],
    mode: GameMode,
    completed?: boolean,
    totalTimeMs?: number
  ) => void;
  onGoBack: () => void;
}

export default function GameScreen({
  charSet,
  charSetName,
  gameSessions,
  gameMode,
  onGameEnd,
  onGoBack,
}: GameScreenProps) {
  const [isWaitingForSpace, setIsWaitingForSpace] = useState<boolean>(true);
  const [streak, setStreak] = useState<number>(0);
  const [currentTarget, setCurrentTarget] = useState<string>('');
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(getTimerLimitMs(0));
  const [feedbackEffect, setFeedbackEffect] = useState<'none' | 'success' | 'error'>('none');
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [letterElapsedTime, setLetterElapsedTime] = useState<number>(0);

  const logsRef = useRef<KeystrokeLog[]>([]);
  const lastKeyTimeRef = useRef<number>(0);
  const activeTimerRef = useRef<any>(null);
  const soundTickCooldownRef = useRef<number>(0);
  const gameStartTimestampRef = useRef<number>(0);

  // Compute adaptive character weights once per game based on historical struggle
  const characterWeights = useMemo(() => {
    return getCharacterWeights(charSet, gameSessions || []);
  }, [charSet, gameSessions]);

  // Pick random char from provided range using adaptive weights
  const getRandomChar = useCallback((current: string): string => {
    return pickWeightedCharacter(characterWeights, current);
  }, [characterWeights]);

  // setupStep calculates current time limit based on the given streak count
  const setupStep = useCallback((currentStreak: number) => {
    const nextChar = getRandomChar(currentTarget);
    setCurrentTarget(nextChar);
    setIsCorrect(null);
    setPressedKey(null);
    lastKeyTimeRef.current = performance.now();
    setLetterElapsedTime(0);
    soundTickCooldownRef.current = 0;

    if (gameMode === 'SURVIVAL') {
      const limitMs = getTimerLimitMs(currentStreak);
      setTimeLeft(limitMs);

      if (activeTimerRef.current) clearInterval(activeTimerRef.current);

      const startTimestamp = performance.now();
      activeTimerRef.current = setInterval(() => {
        const elapsed = performance.now() - startTimestamp;
        const remaining = Math.max(0, limitMs - elapsed);
        setTimeLeft(remaining);

        // Warning alarm tick sound when running low on time
        if (remaining < limitMs * 0.35 && remaining > 0) {
          const now = performance.now();
          if (now - soundTickCooldownRef.current > 180) {
            playCountdownTickingSound(500);
            soundTickCooldownRef.current = now;
          }
        }

        if (remaining <= 0) {
          clearInterval(activeTimerRef.current);
          setFeedbackEffect('error');
          playIncorrectSound();
          
          // Register penalty end keystroke
          logsRef.current.push({
            char: nextChar,
            reactionTimeMs: limitMs,
            correct: false,
          });
          
          setTimeout(() => {
            onGameEnd(currentStreak, logsRef.current, 'SURVIVAL', false);
          }, INSTANT_FEEDBACK_DURATION_MS);
        }
      }, 16);
    }
  }, [currentTarget, getRandomChar, onGameEnd, gameMode]);

  const processKeyHit = useCallback((keyPressed: string) => {
    if (feedbackEffect !== 'none') return;

    const inputTime = performance.now();
    const reactionTime = Math.round(inputTime - lastKeyTimeRef.current);
    const targetNorm = currentTarget.toUpperCase();
    const keyNorm = keyPressed.toUpperCase();

    setPressedKey(keyPressed);

    if (keyNorm === targetNorm) {
      setIsCorrect(true);
      setFeedbackEffect('success');
      playCorrectSound();

      logsRef.current.push({
        char: currentTarget,
        reactionTimeMs: reactionTime,
        correct: true,
      });

      const nextStreak = streak + 1;
      setStreak(nextStreak);

      if (gameMode === 'SPRINT' && nextStreak === SPRINT_CHAR_COUNT) {
        const totalDuration = Math.round(performance.now() - gameStartTimestampRef.current);
        if (activeTimerRef.current) clearInterval(activeTimerRef.current);
        
        setTimeout(() => {
          onGameEnd(nextStreak, logsRef.current, 'SPRINT', true, totalDuration);
        }, INSTANT_FEEDBACK_DURATION_MS);
      } else {
        setTimeout(() => {
          setFeedbackEffect('none');
          setupStep(nextStreak);
        }, INSTANT_FEEDBACK_DURATION_MS);
      }
    } else {
      setIsCorrect(false);
      setFeedbackEffect('error');
      playIncorrectSound();

      logsRef.current.push({
        char: currentTarget,
        reactionTimeMs: reactionTime,
        correct: false,
      });

      if (activeTimerRef.current) clearInterval(activeTimerRef.current);
      
      setTimeout(() => {
        if (gameMode === 'SPRINT') {
          onGameEnd(streak, logsRef.current, 'SPRINT', false, undefined);
        } else {
          onGameEnd(streak, logsRef.current, 'SURVIVAL', false);
        }
      }, INSTANT_FEEDBACK_DURATION_MS + 100);
    }
  }, [currentTarget, feedbackEffect, setupStep, onGameEnd, streak, gameMode]);

  // Physical key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isWaitingForSpace) {
        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          setIsWaitingForSpace(false);
        }
        return;
      }

      if (e.key.length !== 1) return;
      if (e.key === ' ') {
        e.preventDefault();
      }

      const charCode = e.key.toUpperCase().charCodeAt(0);
      const isAlphaNum = (charCode >= 48 && charCode <= 57) || (charCode >= 65 && charCode <= 90);
      
      if (isAlphaNum) {
        processKeyHit(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isWaitingForSpace, processKeyHit]);

  // Initial step start
  useEffect(() => {
    if (!isWaitingForSpace) {
      if (gameMode === 'SPRINT') {
        gameStartTimestampRef.current = performance.now();
      }
      setupStep(0);
    }
  }, [isWaitingForSpace]);

  // Sprint stopwatch update effect
  useEffect(() => {
    if (!isWaitingForSpace && gameMode === 'SPRINT') {
      const interval = setInterval(() => {
        const now = performance.now();
        const elapsed = now - gameStartTimestampRef.current;
        setElapsedTime(elapsed);
        setLetterElapsedTime(now - lastKeyTimeRef.current);
      }, 33);
      return () => clearInterval(interval);
    }
  }, [isWaitingForSpace, gameMode]);

  // Cleanup reference
  useEffect(() => {
    return () => {
      if (activeTimerRef.current) clearInterval(activeTimerRef.current);
    };
  }, []);

  if (isWaitingForSpace) {
    return (
      <div className="max-w-2xl mx-auto w-full px-4 py-8 text-zinc-100 flex flex-col gap-4 items-center font-mono">
        <div className="border border-zinc-800 bg-zinc-900/60 p-6 rounded w-full text-center flex flex-col gap-4">
          <div className="text-2xl font-black text-zinc-200 animate-pulse my-2">
            PRESS [SPACEBAR] TO BEGIN
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed max-w-sm mx-auto">
            {gameMode === 'SPRINT' 
              ? 'Complete exactly 30 keys as quick as possible with no single mistake. Ticking timer limit is disabled!'
              : 'Decaying dynamic target timer will tighten up as streak is increased. Maintain the streak!'
            }
          </p>
        </div>
        <button
          id="btn-quit-waiting"
          onClick={onGoBack}
          className="text-zinc-500 hover:text-zinc-300 text-[10px] uppercase tracking-wider cursor-pointer"
        >
          [RETURN_CONFIG]
        </button>
      </div>
    );
  }

  // Define border styles based on correctness
  let cardBorder = 'border-zinc-800 bg-zinc-900/40';
  let targetColor = 'text-zinc-100';

  if (feedbackEffect === 'success') {
    cardBorder = 'border-green-800 bg-green-950/25';
    targetColor = 'text-green-400';
  } else if (feedbackEffect === 'error') {
    cardBorder = 'border-red-800 bg-red-950/25';
    targetColor = 'text-red-400';
  }

  // SURVIVAL modes properties
  const currentLimitMs = getTimerLimitMs(streak);
  const progressRatio = timeLeft / currentLimitMs;
  const isTimeCritical = gameMode === 'SURVIVAL' && progressRatio < 0.35;

  if (isTimeCritical) {
    cardBorder = 'border-amber-700 bg-zinc-900/50';
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-2 text-zinc-100 flex flex-col gap-4 font-mono text-xs">
      {/* HUD status */}
      <div className="w-full flex justify-between items-center border border-zinc-850 bg-zinc-900 p-2.5 rounded">
        <button
          id="btn-quit-game"
          onClick={onGoBack}
          className="px-2 py-1 bg-zinc-950 border border-zinc-850 hover:border-zinc-700 text-zinc-500 hover:text-zinc-300 rounded cursor-pointer text-[10px]"
        >
          [QUIT]
        </button>

        <div className="flex gap-4">
          <div>
            <span className="text-zinc-500">MODE:</span>{' '}
            <span className="text-zinc-300 font-bold uppercase">{gameMode}</span>
          </div>
          <div>
            <span className="text-zinc-500">RANGE:</span>{' '}
            <span className="text-zinc-300 font-bold">{charSetName}</span>
          </div>
        </div>
      </div>

      {/* Target core frame */}
      <div className={`w-full flex flex-col items-center gap-4 border p-6 rounded ${cardBorder}`}>
        
        {gameMode === 'SURVIVAL' ? (
          /* Survival Mode Stats */
          <div className="w-full flex justify-center text-center text-[11px] border-b border-zinc-850 pb-3">
            <div>
              <span className="text-zinc-500 block uppercase tracking-wider">CURRENT STREAK</span>
              <span className="text-2xl font-black text-amber-500 font-mono">
                {streak}
              </span>
            </div>
          </div>
        ) : (
          /* Sprint Mode Stats */
          <div className="w-full grid grid-cols-2 text-center text-[11px] border-b border-zinc-850 pb-3">
            <div className="border-r border-zinc-850">
              <span className="text-zinc-500 block uppercase tracking-wider">KEYS COMPLETED</span>
              <span className="text-2xl font-black text-amber-500 font-mono">
                {streak} <span className="text-xs text-zinc-500 font-normal">/ {SPRINT_CHAR_COUNT}</span>
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block uppercase tracking-wider">ELAPSED TIME</span>
              <span className="text-2xl font-black text-blue-400 font-mono">
                {(elapsedTime / 1000).toFixed(2)}s
              </span>
              <div className="text-[9px] text-zinc-400 mt-1 uppercase tracking-wider font-semibold border-t border-zinc-850/60 pt-1">
                KEY LATENCY: <span className="text-amber-500">{(letterElapsedTime / 1000).toFixed(2)}s</span>
              </div>
            </div>
          </div>
        )}

        {/* Big Letter Spot */}
        <div className="w-32 h-32 flex flex-col items-center justify-center rounded border border-zinc-800 bg-zinc-950 select-none relative">
          <span className={`text-6xl font-bold font-sans ${targetColor}`}>
            {currentTarget}
          </span>
          {pressedKey && (
            <span className="absolute bottom-2 text-[10px] text-zinc-500">
              PRESSED: {pressedKey.toUpperCase()}
            </span>
          )}
        </div>

        {/* Dynamic Display Indicators */}
        {gameMode === 'SURVIVAL' ? (
          <div className="w-full flex flex-col gap-1 mt-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-zinc-500">DYNAMIC TIME LIMIT</span>
              <span className={isTimeCritical ? 'text-red-400 animate-pulse font-bold' : 'text-zinc-400'}>
                {(timeLeft / 1000).toFixed(2)}s / {(currentLimitMs / 1000).toFixed(2)}s
              </span>
            </div>
            <div className="w-full h-1.5 bg-zinc-950 rounded overflow-hidden">
              <div 
                className={`h-full transition-all duration-75 ${isTimeCritical ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${progressRatio * 100}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-1 mt-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-zinc-500 animate-pulse text-blue-400">SPRINT PROGRESS MAP</span>
              <span className="text-zinc-400 font-mono">
                {Math.round((streak / SPRINT_CHAR_COUNT) * 105)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-zinc-950 rounded overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-150"
                style={{ width: `${(streak / SPRINT_CHAR_COUNT) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="text-[10px] text-zinc-650 text-center uppercase tracking-wider">
        {gameMode === 'SURVIVAL' 
          ? 'Timer gets shorter with each correct letter! Maintain your streak!'
          : `Rush exactly ${SPRINT_CHAR_COUNT} letters quickly. Any single key error instantly restarts/fails.`
        }
      </div>
    </div>
  );
}
