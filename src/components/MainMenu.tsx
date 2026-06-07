import React, { useState, useEffect, useRef, useCallback } from "react";
import { Difficulty, DotConfig, DOTS_DATABASE, NEO_DROP_ID, PlayerStats } from "../types";
import { audio } from "../utils/audio";
import { Volume2, VolumeX, Trophy, Info } from "lucide-react";
import { SettingsPanel, CustomDifficulty } from "./SettingsPanel";
import { Leaderboard } from "./Leaderboard";
import { Contributors } from "./Contributors";

interface MainMenuProps {
  unlockedDots: string[];
  selectedDotId: string;
  onSelectDot: (dotId: string) => void;
  highScores: Record<string, number>;
  totalKills: Record<string, number>;
  totalPloints: number;
  onStartGame: (dif: Difficulty, customDiff?: CustomDifficulty) => void;
  onOpenShop: () => void;
  bigMode: boolean;
  onToggleBigMode: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  musicVolume: number;
  sfxVolume: number;
  onMusicVolume: (v: number) => void;
  onSfxVolume: (v: number) => void;
  invincible: boolean;
  onToggleInvincible: () => void;
  spamtonRange: [number, number];
  onSetSpamtonRange: (r: [number, number]) => void;
  customDifficulties: CustomDifficulty[];
  onSetCustomDifficulties: (d: CustomDifficulty[]) => void;
  leaderboardName: string | null;
  leaderboardColor: string;
  onSetLeaderboardName: (n: string | null) => void;
  onSetLeaderboardColor: (c: string) => void;
  onUnlockAll: () => void;
  stats: PlayerStats;
  onSetStats: (s: PlayerStats) => void;
  onSaveStats: (s: PlayerStats) => void;
  neoDropUnlocked: boolean;
  neoDropAnimating: boolean;
  onNeoDropAnimDone: () => void;
  onNeedName: () => void;
  onResetNeoDrop: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onSetTotalKills: (k: Record<string, number>) => void;
  initialTab?: "menu" | "leaderboard" | "settings";
  onTabConsumed?: () => void;
}

const NEO_DOT: DotConfig = {
  id: NEO_DROP_ID,
  name: "Neo Drop",
  cost: 0,
  color: "#c084fc",
  borderColor: "#e9d5ff",
  description: "An evolved form of Drop. Kills scatter explosive micro-drops.",
  specialAbility: "Enemies killed by the teleport line explode into micro-drops that kill on contact. Space key: freeze all enemies for 2s (costs 100 Slo).",
};

export const MainMenu: React.FC<MainMenuProps> = ({
  unlockedDots, selectedDotId, onSelectDot,
  highScores, totalKills, totalPloints,
  onStartGame, onOpenShop,
  bigMode, onToggleBigMode,
  isMuted, onToggleMute,
  musicVolume, sfxVolume, onMusicVolume, onSfxVolume,
  invincible, onToggleInvincible,
  spamtonRange, onSetSpamtonRange,
  customDifficulties, onSetCustomDifficulties,
  leaderboardName, leaderboardColor,
  onSetLeaderboardName, onSetLeaderboardColor,
  onUnlockAll, stats, onSetStats, onSaveStats,
  neoDropUnlocked, neoDropAnimating, onNeoDropAnimDone,
  onNeedName, onResetNeoDrop,
  isFullscreen, onToggleFullscreen,
  onSetTotalKills,
  initialTab, onTabConsumed,
}) => {
  const [activeTab, setActiveTab] = useState<"menu" | "leaderboard" | "settings">("menu");
  const [showContributors, setShowContributors] = useState(false);

  // Consume initialTab prop from parent (e.g. navigating back from shop)
  useEffect(() => {
    if (initialTab && initialTab !== "menu") {
      setActiveTab(initialTab);
      onTabConsumed?.();
    }
  }, [initialTab]);

  // Global arrow key navigation
  useEffect(() => {
    // Navigation order matches the visible tab bar: MAIN MENU, DOT SHOP, LEADERBOARD, SETTINGS
    // DOT SHOP is a separate screen (handled via onOpenShop), the others are tabs in this component.
    const NAV_ORDER = ["menu", "shop", "leaderboard", "settings"] as const;
    type NavItem = typeof NAV_ORDER[number];

    const getCurrentNavItem = (): NavItem => {
      if (activeTab === "menu") return "menu";
      if (activeTab === "leaderboard") return "leaderboard";
      if (activeTab === "settings") return "settings";
      return "menu";
    };

    const handler = (e: KeyboardEvent) => {
      // Don't intercept if contributor overlay is open or if focus is in an input
      if (showContributors) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (activeTab === "settings") return;
        e.preventDefault();
        const current = getCurrentNavItem();
        const idx = NAV_ORDER.indexOf(current);
        const nextIdx = e.key === "ArrowLeft"
          ? Math.max(0, idx - 1)
          : Math.min(NAV_ORDER.length - 1, idx + 1);
        const next = NAV_ORDER[nextIdx];
        if (next === current) return;
        audio.playClick();
        audio.maybePlayYawn(import.meta.env.BASE_URL);
        if (next === "shop") {
        } else {
          setActiveTab(next as "menu" | "leaderboard" | "settings");
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showContributors, activeTab]);

  // Neo Drop animation state
  const [neoGlow, setNeoGlow] = useState(false);
  useEffect(() => {
    if (!neoDropAnimating) return;
    setNeoGlow(true);
    const t = setTimeout(() => { setNeoGlow(false); onNeoDropAnimDone(); }, 3000);
    return () => clearTimeout(t);
  }, [neoDropAnimating]);

  // Effective dot list shown in selection (replace drop with neo drop if unlocked)
  const visibleDots = DOTS_DATABASE.map((d) =>
    d.id === "drop" && neoDropUnlocked ? NEO_DOT : d
  );
  const effectiveSelectedId = selectedDotId === "drop" && neoDropUnlocked ? NEO_DROP_ID : selectedDotId;
  const currentSelectedDot = visibleDots.find((d) => d.id === effectiveSelectedId) || visibleDots[0];

  // Spamton easter egg
  const [spamton, setSpamton] = useState<{ active: boolean; x: number; y: number; bob: number } | null>(null);
  const spamtonAudioRef = useRef<HTMLAudioElement | null>(null);

  const triggerSpamton = useCallback(() => {
    if (spamton) return;
    const randomY = 15 + Math.random() * 25;
    setSpamton({ active: true, x: 115, y: randomY, bob: 0 });
  }, [spamton]);

  useEffect(() => {
    let timeoutId: any;
    const scheduleNext = () => {
      const minMs = spamtonRange[0] * 60000;
      const maxMs = spamtonRange[1] * 60000;
      const delay = minMs + Math.random() * (maxMs - minMs);
      timeoutId = setTimeout(() => { triggerSpamton(); scheduleNext(); }, delay);
    };
    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [spamtonRange]);

  useEffect(() => {
    if (!spamton?.active) return;

    // Music starts 5s before he enters screen (we start it immediately and
    // fade in over 5s so that by the time he's visible it's at max)
    const audioObj = new Audio(`${import.meta.env.BASE_URL}contributors/bigshot.mp3`);
    spamtonAudioRef.current = audioObj;
    const randomStart = Math.random() * 135;
    audioObj.currentTime = randomStart;
    audioObj.muted = isMuted;
    audioObj.loop = false;
    audioObj.volume = 0;

    let audioStarted = false;
    audioObj.play().then(() => { audioStarted = true; }).catch(() => {});

    // Total animation: 5s pre-entry fade-in (music only, dot not visible yet),
    // then 5s on screen sliding left, then 5s post-exit fade-out = 15s total
    // But visually spamton appears at x=115% (off-right) and slides to x=-30%
    // He becomes "visible" when x < 100%, i.e. after some fraction of travel.
    // We delay his visual appearance 0s but start music immediately with 5s fade.
    const MUSIC_FADE_IN = 5000;   // 5s fade in
    const ON_SCREEN = 5000;       // 5s crossing
    const MUSIC_FADE_OUT = 5000;  // 5s fade out after gone
    const TOTAL = ON_SCREEN + MUSIC_FADE_OUT;

    const startX = 115;
    const endX = -30;
    const startTimeStamp = Date.now();
    let animId: number;

    const tick = () => {
      const elapsed = Date.now() - startTimeStamp;
      const gifProgress = Math.min(1, elapsed / ON_SCREEN);
      const currentX = startX + (endX - startX) * gifProgress;
      const currentBob = Math.sin(elapsed / 120) * 12;

      // Music volume: fade in over first 5s (pre-loaded), max when on-screen, fade out over last 5s
      let volume = 1.0;
      if (elapsed < MUSIC_FADE_IN) {
        volume = elapsed / MUSIC_FADE_IN;
      } else if (elapsed > ON_SCREEN) {
        const fadeProgress = (elapsed - ON_SCREEN) / MUSIC_FADE_OUT;
        volume = Math.max(0, 1 - fadeProgress);
      }

      if (audioStarted && !isMuted) {
        audioObj.volume = Math.min(1.0, Math.max(0, volume));
      } else {
        audioObj.volume = 0;
      }

      setSpamton((prev) => prev ? { ...prev, x: currentX, bob: currentBob } : null);

      if (elapsed < TOTAL) {
        animId = requestAnimationFrame(tick);
      } else {
        audioObj.pause();
        spamtonAudioRef.current = null;
        setSpamton(null);
      }
    };

    animId = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(animId); audioObj.pause(); spamtonAudioRef.current = null; };
  }, [spamton?.active]);

  useEffect(() => {
    if (spamtonAudioRef.current) spamtonAudioRef.current.muted = isMuted;
  }, [isMuted]);

  const getDifficultyStyles = (diff: Difficulty) => {
    switch (diff) {
      case Difficulty.Blissful: return { border: "border-[#333] hover:border-neon-green", text: "text-neon-green", color: "#22c55e" };
      case Difficulty.Pissful: return { border: "border-[#333] hover:border-neon-yellow", text: "text-neon-yellow", color: "#eab308" };
      case Difficulty.Ez: return { border: "border-[#333] hover:border-neon-cyan", text: "text-neon-cyan", color: "#22d3ee" };
      case Difficulty.Medium: return { border: "border-[#333] hover:border-ink", text: "text-ink", color: "#e4e4e7" };
      case Difficulty.Hard: return { border: "border-[#333] hover:border-[#f27d26]", text: "text-[#f27d26]", color: "#f97316" };
      case Difficulty.HardR: return { border: "border-[#333] hover:border-neon-red", text: "text-neon-red font-bold", color: "#f43f5e" };
      case Difficulty.Impossible: return { border: "border-[#333] hover:border-neon-magenta", text: "text-neon-magenta font-black", color: "#db2777" };
      case Difficulty.Hell: return { border: "border-neon-red/50 hover:border-neon-red bg-[#300]/40", text: "text-neon-red font-extrabold tracking-widest", color: "#ef4444" };
      case Difficulty.Dot0: return { border: "border-neon-magenta/50 hover:border-[#fff] bg-[#fff]/10", text: "text-ink font-black", color: "#ffffff" };
    }
  };

  const diffDescriptions: Record<string, string> = {
    [Difficulty.Blissful]: "EXTRA SHIELDS • SLOW ENEMY SPEED",
    [Difficulty.Pissful]: "EXTRA SHIELDS • MODERATE ENEMY SPEED",
    [Difficulty.Ez]: "NORMAL SHIELDS • EASY PACE",
    [Difficulty.Medium]: "NORMAL SHIELDS • STANDARD DIFFICULTY",
    [Difficulty.Hard]: "NO SHIELDS • INCREASED HAZARD RATE",
    [Difficulty.HardR]: "NO SHIELDS • FAST SPAWNS & INTENSE SPEEDS",
    [Difficulty.Impossible]: "NO SHIELDS • EXTREME ENEMY DENSITY",
    [Difficulty.Hell]: "NO SHIELDS • CONSTANT PRESSURE",
    [Difficulty.Dot0]: "NO SHIELDS • ABSOLUTE CHAOS",
  };

  return (
    <div className="min-h-screen bg-brutal-grid font-mono text-ink flex flex-col justify-between p-6 md:p-12 border-4 border-[#222] select-none">

      {/* Top Banner */}
      <div className="flex justify-between items-center pb-6 border-b border-[#333]">
        <div className="flex items-center gap-2.5">
          {leaderboardName ? (
            <span
              className="text-lg font-black tracking-widest"
              style={{ color: leaderboardColor, textShadow: `0 0 12px ${leaderboardColor}66` }}
            >
              {leaderboardName}
            </span>
          ) : (
            <span className="text-xs text-zinc-600 uppercase tracking-widest font-bold">
              No name set
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { onToggleMute(); audio.playClick(); audio.maybePlayYawn(import.meta.env.BASE_URL); }}
            className="p-2.5 border border-[#333] hover:border-neon-cyan hover:bg-[#111] bg-[#050505] text-zinc-400 hover:text-white transition-all cursor-pointer"
            title="Toggle Audio"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-neon-red" /> : <Volume2 className="w-4 h-4 text-neon-cyan" />}
          </button>
          <div className="px-4 py-1.5 border border-[#333] bg-[#0a0a0a] text-xs flex items-center gap-2">
            <span className="text-zinc-500 font-bold uppercase">PLOINTS:</span>
            <span className="text-neon-magenta font-black tracking-wider">{totalPloints.toLocaleString()} P</span>
          </div>
        </div>
      </div>

      {/* Nav Tabs */}
      <div className="flex border border-[#222] bg-[#050505] p-1 gap-1 my-4">
        <button
          onClick={() => { audio.playClick(); audio.maybePlayYawn(import.meta.env.BASE_URL); setActiveTab("menu"); }}
          className={`px-6 py-2.5 text-xs uppercase font-black tracking-widest border transition-all cursor-pointer ${activeTab === "menu" ? "border-neon-cyan/40 bg-zinc-950 text-neon-cyan" : "border-transparent text-zinc-500 hover:text-white hover:bg-zinc-900 hover:border-[#333]"}`}
        >
          MAIN MENU
        </button>
        <button
          onClick={() => { audio.playClick(); audio.maybePlayYawn(import.meta.env.BASE_URL); onOpenShop(); }}
          className="px-6 py-2.5 text-xs uppercase font-black tracking-widest border border-transparent text-zinc-500 hover:text-white hover:bg-zinc-900 hover:border-[#333] transition-all cursor-pointer"
        >
          DOT SHOP
        </button>
        <button
          onClick={() => { audio.playClick(); audio.maybePlayYawn(import.meta.env.BASE_URL); setActiveTab("leaderboard"); }}
          className={`px-6 py-2.5 text-xs uppercase font-black tracking-widest border transition-all cursor-pointer ${activeTab === "leaderboard" ? "border-neon-cyan/40 bg-zinc-950 text-neon-cyan" : "border-transparent text-zinc-500 hover:text-white hover:bg-zinc-900 hover:border-[#333]"}`}
        >
          LEADERBOARD
        </button>
        <button
          onClick={() => { audio.playClick(); audio.maybePlayYawn(import.meta.env.BASE_URL); setActiveTab("settings"); }}
          className={`px-6 py-2.5 text-xs uppercase font-black tracking-widest border transition-all cursor-pointer ${activeTab === "settings" ? "border-neon-cyan/40 bg-zinc-950 text-neon-cyan" : "border-transparent text-zinc-500 hover:text-white hover:bg-zinc-900 hover:border-[#333]"}`}
        >
          SETTINGS
        </button>
      </div>

      {/* Settings tab */}
      {activeTab === "settings" && (
        <SettingsPanel
          bigMode={bigMode} onToggleBigMode={onToggleBigMode}
          isMuted={isMuted} onToggleMute={onToggleMute}
          musicVolume={musicVolume} sfxVolume={sfxVolume}
          onMusicVolume={onMusicVolume} onSfxVolume={onSfxVolume}
          stats={stats} onSetStats={onSetStats} onSaveStats={onSaveStats}
          onUnlockAll={onUnlockAll}
          invincible={invincible} onToggleInvincible={onToggleInvincible}
          spamtonRange={spamtonRange} onSetSpamtonRange={onSetSpamtonRange}
          customDifficulties={customDifficulties} onSetCustomDifficulties={onSetCustomDifficulties}
          leaderboardName={leaderboardName} leaderboardColor={leaderboardColor}
          onSetLeaderboardName={onSetLeaderboardName} onSetLeaderboardColor={onSetLeaderboardColor}
          onResetNeoDrop={onResetNeoDrop}
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
          totalKills={totalKills}
          onSetTotalKills={onSetTotalKills}
        />
      )}

      {/* Leaderboard tab */}
      {activeTab === "leaderboard" && (
        <Leaderboard
          highScores={highScores}
          totalKills={totalKills}
          bigMode={bigMode}
          leaderboardName={leaderboardName}
          leaderboardColor={leaderboardColor}
          onNeedName={onNeedName}
        />
      )}

      {/* Main Menu tab */}
      {activeTab === "menu" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-auto py-6">

          {/* Left: Branding + Dot Selection */}
          <div className="lg:col-span-5 flex flex-col justify-center gap-6">
            <div className="space-y-1">
              <h1 style={{ fontFamily: "var(--font-mono)", fontSize: "72px", fontWeight: 900, letterSpacing: "12px", textShadow: "0 0 15px rgba(255,255,255,0.7)" }} className="text-white">
                DOT
              </h1>
              <p className="text-xs text-zinc-400 uppercase tracking-wide leading-relaxed pt-1">
                TELEPORT AROUND TO SURVIVE
              </p>
            </div>

            {/* Dot selection */}
            <div className="border border-[#333] bg-[#0a0a0a] p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-[#222] pb-2.5">
                <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">DOT SELECTION</span>
                <span className="text-[9px] text-[#ccc] font-bold uppercase">
                  {unlockedDots.length} / {DOTS_DATABASE.length} Unlocked
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {visibleDots.map((dot) => {
                  const isUnlocked = unlockedDots.includes(dot.id === NEO_DROP_ID ? "drop" : dot.id) || (dot.id === NEO_DROP_ID && neoDropUnlocked);
                  const isSelected = dot.id === effectiveSelectedId;
                  const isNeo = dot.id === NEO_DROP_ID;
                  const glowAnim = isNeo && neoGlow;

                  return (
                    <button
                      key={dot.id}
                      onClick={() => isUnlocked && onSelectDot(dot.id)}
                      className={`w-10 h-10 border-2 flex items-center justify-center relative transition-all group ${
                        !isUnlocked
                          ? "border-[#222] bg-zinc-950/20 cursor-not-allowed opacity-20"
                          : isSelected
                          ? "border-white bg-[#151515]"
                          : "border-[#333] hover:border-neon-cyan hover:bg-[#111] cursor-pointer"
                      }`}
                      style={isUnlocked && isSelected ? { boxShadow: `0 0 12px ${dot.color}` } : glowAnim ? { animation: "neoGlow 0.4s ease-in-out infinite alternate", boxShadow: `0 0 20px ${dot.color}` } : {}}
                      title={isUnlocked ? dot.name : `${dot.name}: Locked`}
                    >
                      <span
                        className="w-3.5 h-3.5"
                        style={{
                          backgroundColor: dot.color,
                          boxShadow: glowAnim ? `0 0 16px ${dot.color}` : `0 0 8px ${dot.color}`,
                        }}
                      />
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-[#0a0a0a] text-white text-[9px] px-2 py-0.5 border border-[#333] whitespace-nowrap z-20">
                        {dot.name} {isSelected && "(Equipped)"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active dot info */}
              <div className="bg-[#0f0f0f] border border-[#222] p-3">
                <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5" style={{ backgroundColor: currentSelectedDot.color, boxShadow: `0 0 6px ${currentSelectedDot.color}` }} />
                  ACTIVE DOT: {currentSelectedDot.name.toUpperCase()}
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed mt-1.5">{currentSelectedDot.specialAbility}</p>
              </div>

            </div>
          </div>

          {/* Right: Difficulty selector */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-[#333] pb-2">
              <span className="text-[10px] text-zinc-400 uppercase font-black tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-neon-cyan animate-pulse" />
                SELECT DIFFICULTY
              </span>
              <span className="text-[9px] text-[#ccc] font-mono uppercase bg-[#111] px-2 py-0.5 border border-[#222]">
                {Object.values(Difficulty).length + customDifficulties.length} AVAILABLE
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 max-h-[55vh] overflow-y-auto pr-2 no-scrollbar">
              {Object.values(Difficulty).map((diff, index) => {
                const style = getDifficultyStyles(diff);
                const normalScore = highScores[diff] || 0;
                const bigScore = highScores[`${diff}_big`] || 0;
                const score = Math.max(normalScore, bigScore);
                const scoreBig = bigScore > normalScore;
                const sectorNum = String(index + 1).padStart(2, "0");

                return (
                  <button
                    key={diff}
                    onClick={() => { audio.playClick(); audio.maybePlayYawn(import.meta.env.BASE_URL); onStartGame(diff); }}
                    className={`w-full p-3 border text-left flex justify-between items-center transition-all cursor-pointer bg-[#070707] hover:bg-[#111] ${style.border} group relative pl-10`}
                  >
                    <div className="absolute left-0 inset-y-0 w-1.5 transition-all group-hover:w-2" style={{ backgroundColor: style.color }} />
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs font-bold text-zinc-500 bg-[#121212] border border-[#222] px-2 py-1 group-hover:text-white group-hover:border-[#444] transition-colors leading-none">
                        {sectorNum}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black tracking-widest uppercase ${style.text} group-hover:text-white`}>{diff}</span>
                        </div>
                        <span className="text-[9px] text-zinc-400 uppercase font-mono tracking-wider">{diffDescriptions[diff]}</span>
                      </div>
                    </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-3 bg-[#0a0a0a] border border-[#222] px-3.5 py-1.5 group-hover:border-zinc-500 transition-colors">
                      <Trophy className="w-4 h-4 text-zinc-500 group-hover:text-neon-yellow" />
                      <div>
                        <div className="text-[8px] text-zinc-500 uppercase font-black tracking-wider">BEST TIME</div>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-xs font-black text-white">{score.toFixed(1)}s</span>
                          {score > 0 && (
                            <span className={`text-[8px] font-bold uppercase tracking-wider ${scoreBig ? "text-neon-cyan" : "text-zinc-600"}`}>
                              {scoreBig ? "BIG" : "STD"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {(() => {
                      const normalKey = diff;
                      const bigKey = `${diff}_big`;
                      const normalKills = totalKills[normalKey] || 0;
                      const bigKills = totalKills[bigKey] || 0;
                      const bestKills = Math.max(normalKills, bigKills);
                      const killsBig = bigKills > normalKills;
                      return bestKills > 0 ? (
                        <div className="flex items-center gap-3 bg-[#0a0a0a] border border-[#222] px-3.5 py-1.5 group-hover:border-zinc-500 transition-colors">
                          <div>
                            <div className="text-[8px] text-zinc-500 uppercase font-black tracking-wider">BEST KILLS</div>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span className="text-xs font-black text-white">{bestKills}</span>
                              <span className={`text-[8px] font-bold uppercase tracking-wider ${killsBig ? "text-neon-cyan" : "text-zinc-600"}`}>
                                {killsBig ? "BIG" : "STD"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                  </button>
                );
              })}

              {/* Custom difficulties */}
              {customDifficulties.map((cd, i) => (
                <button
                  key={`custom-${i}`}
                  onClick={() => { audio.playClick(); audio.maybePlayYawn(import.meta.env.BASE_URL); onStartGame(Difficulty.Medium, cd); }}
                  className="w-full p-3 border border-neon-cyan/30 hover:border-neon-cyan text-left flex justify-between items-center transition-all cursor-pointer bg-[#070707] hover:bg-[#0a0a0a] group relative pl-10"
                >
                  <div className="absolute left-0 inset-y-0 w-1.5 bg-neon-cyan/50 group-hover:w-2 group-hover:bg-neon-cyan transition-all" />
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs font-bold text-zinc-500 bg-[#121212] border border-[#222] px-2 py-1 leading-none">C{i + 1}</span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-black tracking-widest uppercase text-neon-cyan group-hover:text-white">{cd.name}</span>
                      <span className="text-[9px] text-zinc-400 uppercase font-mono">CUSTOM • {cd.shields} SHIELD{cd.shields !== 1 ? "S" : ""} • {cd.enemySpeedMult}x SPEED</span>
                    </div>
                  </div>
                  <span className="text-[9px] text-neon-cyan border border-neon-cyan/30 px-2 py-1">CUSTOM</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center border-t border-[#333] pt-6">
        <div className="flex items-center gap-3 text-zinc-500 text-xs">
          <Info className="w-4 h-4 text-neon-cyan shrink-0" />
          <p className="leading-snug font-mono text-[11px] text-zinc-400">
            <span className="text-white font-bold">CLICK</span> TO TELEPORT. TRACING THE PATH CLEARS BULLETS. PRESS <span className="text-white font-bold">ESC</span> TO EXIT.
          </p>
        </div>
        <button
          onClick={() => { audio.playClick(); audio.maybePlayYawn(import.meta.env.BASE_URL); setShowContributors((p) => !p); }}
          className="text-[9px] text-zinc-600 hover:text-zinc-400 uppercase tracking-widest font-black transition-all cursor-pointer border border-transparent hover:border-[#222] px-3 py-1.5"
        >
          CONTRIBUTORS
        </button>
      </div>

      {/* Spamton */}
      {spamton?.active && (
        <a
          href="https://github.com/dedenizz"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed z-50 hover:scale-110 cursor-pointer pointer-events-auto transition-transform duration-200"
          style={{
            left: `${spamton.x}%`,
            top: `calc(${spamton.y}% + ${spamton.bob}px)`,
            transform: "translate(-50%, -50%)",
            width: "288px",
            height: "288px",
          }}
        >
          <img src={`${import.meta.env.BASE_URL}contributors/spamton_neo.gif`} alt="Spamton" className="w-full h-full object-contain pointer-events-none" />
        </a>
      )}

      {/* Contributors panel */}
      {showContributors && <Contributors onClose={() => setShowContributors(false)} />}
    </div>
  );
};