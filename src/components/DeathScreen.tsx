/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Difficulty } from "../types";
import { audio } from "../utils/audio";
import { Trophy, Swords, RotateCcw, Home, Clock, Coins } from "lucide-react";

interface DeathScreenProps {
  difficulty: Difficulty;
  secondsSurvived: number;
  plointsGained: number;
  highScore: number;
  kills: number;
  onRetry: () => void;
  onExit: () => void;
}

export const DeathScreen: React.FC<DeathScreenProps> = ({
  difficulty,
  secondsSurvived,
  plointsGained,
  highScore,
  kills,
  onRetry,
  onExit
}) => {
  const [escEnabled, setEscEnabled] = useState<boolean>(false);

  // Safety threshold: wait exactly 800ms before allowing ESC to exit to menu.
  // This blocks accidental instant-skips if ESC is held down.
  useEffect(() => {
    const start = Date.now();
    const timer = setTimeout(() => {
      setEscEnabled(true);
    }, 800);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        // Check if enough time has passed to prevent overlapping triggers
        if (Date.now() - start >= 800) {
          audio.playClick();
          onExit();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onExit]);

  const isHighScoreTriggered = secondsSurvived > highScore && secondsSurvived > 0;

  return (
    <div id="death-screen-root" className="min-h-screen bg-brutal-grid font-mono text-ink flex flex-col justify-center items-center p-6 border-4 border-[#222] select-none animate-fadeIn">
      <div className="w-full max-w-lg bg-[#0a0a0a] border-2 border-neon-red p-8 rounded-none flex flex-col gap-6 relative glow-red" style={{ boxShadow: '0 0 20px rgba(255, 49, 49, 0.2)' }}>
        
        {/* Terminal Glitch Line Header */}
        <div className="text-center space-y-2 border-b border-[#222] pb-5">
          <div className="text-[10px] text-neon-red font-extrabold tracking-widest uppercase animate-pulse">
            [ !! PERFORMANCE RECORD !! ]
          </div>
          <h1 id="death-title" className="text-4xl font-black tracking-wider text-neon-red uppercase" style={{ textShadow: '0 0 10px #FF3131' }}>
            DOT DESTROYED
          </h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest leading-none">
            Concluded on {difficulty} difficulty.
          </p>
        </div>

        {/* Stats segment */}
        <div className="grid grid-cols-3 gap-3 py-2">
          {/* Time survived */}
          <div className="bg-[#050505] border border-[#222] p-3 rounded-none flex flex-col items-center justify-center text-center">
            <Clock className="w-4 h-4 text-zinc-500 mb-1.5 animate-pulse" />
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">TIME</span>
            <span id="death-stat-time" className="text-lg font-bold text-white tracking-widest mt-1">
              {secondsSurvived.toFixed(2)}s
            </span>
          </div>

          {/* Kills */}
          <div className="bg-[#050505] border border-[#222] p-3 rounded-none flex flex-col items-center justify-center text-center">
            <Swords className="w-4 h-4 text-neon-red mb-1.5" />
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">KILLS</span>
            <span id="death-stat-kills" className="text-lg font-bold text-neon-red tracking-widest mt-1">
              {kills}
            </span>
          </div>

          {/* Ploints gained */}
          <div className="bg-[#050505] border border-[#222] p-3 rounded-none flex flex-col items-center justify-center text-center">
            <Coins className="w-4 h-4 text-neon-yellow mb-1.5" />
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">PLOINTS</span>
            <span id="death-stat-ploints" className="text-lg font-bold text-neon-yellow tracking-widest mt-1">
              +{plointsGained.toLocaleString()} P
            </span>
          </div>
        </div>

        {/* High scores information */}
        <div className="bg-[#050505] border border-[#222] p-4 rounded-none space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500 uppercase font-black flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-neon-yellow" />
              HIGH SCORE
            </span>
            <span className="text-[#ccc] font-bold tracking-wider">{highScore.toFixed(2)}s</span>
          </div>
          {isHighScoreTriggered ? (
            <div id="new-high-score-announcement" className="text-[10px] text-neon-green bg-emerald-950/20 border border-neon-green px-3 py-1.5 rounded-none uppercase font-black text-center tracking-wider animate-pulse glow-green">
              NEW PERSONAL BEST!
            </div>
          ) : (
            <div className="text-[9px] text-zinc-550 uppercase font-bold text-center">
              {(highScore - secondsSurvived).toFixed(2)}s behind personal best.
            </div>
          )}
        </div>

        {/* Interactive options */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          {/* Retry */}
          <button
            id="retry-button"
            onClick={() => {
              audio.playClick();
              onRetry();
            }}
            className="flex items-center justify-center gap-2 bg-neon-red text-black hover:bg-white hover:text-black border-2 border-neon-red font-black uppercase rounded-none py-3.5 text-xs tracking-widest transition-all cursor-pointer glow-red"
          >
            <RotateCcw className="w-4 h-4" />
            RETRY RUN
          </button>

          {/* Return home */}
          <button
            id="exit-button"
            onClick={() => {
              audio.playClick();
              onExit();
            }}
            className="flex items-center justify-center gap-2 bg-[#111] hover:bg-white hover:text-black hover:border-white border border-[#333] text-zinc-300 font-bold uppercase rounded-none py-3.5 text-xs tracking-widest transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            MAIN MENU
          </button>
        </div>

        {/* Keyboard shortcut safety guidance overlay at footer */}
        <div className="text-center font-mono text-[9px] text-zinc-500 border-t border-[#222] pt-3 select-none">
          {escEnabled ? (
            <span className="text-zinc-500 uppercase tracking-widest animate-pulse">[ PRESS ESC TO RETURN ]</span>
          ) : (
            <span className="text-zinc-500 uppercase tracking-widest">[ LOADING PERFORMANCE REPORT ]</span>
          )}
        </div>

      </div>
    </div>
  );
};
