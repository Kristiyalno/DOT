import React, { useState, useEffect, useCallback, useRef } from "react";
import { Difficulty, PlayerStats, DOTS_DATABASE, DotConfig, NEO_DROP_ID } from "./types";
import { MainMenu } from "./components/MainMenu";
import { GameCanvas } from "./components/GameCanvas";
import { ShopMenu } from "./components/ShopMenu";
import { DeathScreen } from "./components/DeathScreen";
import { audio } from "./utils/audio";
import { CustomDifficulty, ExperimentalSettings, defaultExperimentalSettings } from "./components/SettingsPanel";
import { getDeviceId } from "./utils/firebase";

const STORAGE_KEY = "dot_game_quantum_vessel_config_v2";
const CUSTOM_DIFF_KEY = "dot_custom_difficulties";

const defaultStats: PlayerStats = {
  unlockedDots: ["drop"],
  selectedDot: "drop",
  totalPloints: 0,
  highScores: {
    [Difficulty.Blissful]: 0,
    [Difficulty.Pissful]: 0,
    [Difficulty.Ez]: 0,
    [Difficulty.Medium]: 0,
    [Difficulty.Hard]: 0,
    [Difficulty.HardR]: 0,
    [Difficulty.Impossible]: 0,
    [Difficulty.Hell]: 0,
    [Difficulty.Dot0]: 0,
  },
};

const ALL_PURCHASABLE_DOTS = DOTS_DATABASE.map((d) => d.id);

export default function App() {
  const [screen, setScreen] = useState<"menu" | "playing" | "summary" | "shop">("menu");
  const [menuTab, setMenuTab] = useState<"menu" | "leaderboard" | "settings">("menu");
  const [stats, setStats] = useState<PlayerStats>(defaultStats);
  const [totalKills, setTotalKills] = useState<Record<string, number>>({});
  const [neoDropUnlocked, setNeoDropUnlocked] = useState<boolean>(false);
  const [neoDropAnimating, setNeoDropAnimating] = useState<boolean>(false);

  const [currentDifficulty, setCurrentDifficulty] = useState<Difficulty>(Difficulty.Medium);
  const [currentCustomDiff, setCurrentCustomDiff] = useState<CustomDifficulty | null>(null);
  const [secondsSurvived, setSecondsSurvived] = useState<number>(0);
  const [plointsGained, setPlointsGained] = useState<number>(0);
  const [sessionKills, setSessionKills] = useState<number>(0);
  const [prevHighScore, setPrevHighScore] = useState<number>(0);
  const [prevBestKills, setPrevBestKills] = useState<number>(0);

  const [bigMode, setBigMode] = useState<boolean>(() => {
    try { return localStorage.getItem("dot_bigmode") === "1"; } catch { return false; }
  });

  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    // Default to off — user must explicitly enable in settings
    try {
      const stored = localStorage.getItem("dot_fullscreen");
      if (stored === null) return false; // no preference stored yet → default off
      return stored === "1";
    } catch { return false; }
  });

  const handleToggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const next = !prev;
      try { localStorage.setItem("dot_fullscreen", next ? "1" : "0"); } catch {}
      if (next) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else {
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      }
      return next;
    });
  };

  // Sync isFullscreen state when user exits fullscreen via browser (e.g. pressing F11 or Esc)
  React.useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        try { localStorage.setItem("dot_fullscreen", "0"); } catch {}
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);
  // Persisted across sessions
  const [invincible, setInvincible] = useState<boolean>(() => {
    try { return localStorage.getItem("dot_invincible") === "1"; } catch { return false; }
  });
  const [musicVolume, setMusicVolumeState] = useState<number>(() => {
    try { return parseFloat(localStorage.getItem("dot_music_vol") || "1"); } catch { return 1; }
  });
  const [sfxVolume, setSfxVolumeState] = useState<number>(() => {
    try { return parseFloat(localStorage.getItem("dot_sfx_vol") || "1"); } catch { return 1; }
  });
  const [isMuted, setIsMuted] = useState<boolean>(audio.isMuted);

  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [spamtonRange, setSpamtonRange] = useState<[number, number]>(() => {
    try {
      const stored = localStorage.getItem("dot_spamton_range");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length === 2 && parsed.every((v) => typeof v === "number" && v >= 0)) {
          return parsed as [number, number];
        }
      }
    } catch {}
    return [2, 3];
  });
  const [experimentalSettings, setExperimentalSettings] = useState<ExperimentalSettings>(defaultExperimentalSettings);
  const [customDifficulties, setCustomDifficulties] = useState<CustomDifficulty[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_DIFF_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [leaderboardName, setLeaderboardName] = useState<string | null>(() => {
    try { return localStorage.getItem("dot_lb_name") || null; } catch { return null; }
  });
  const [leaderboardColor, setLeaderboardColor] = useState<string>(() => {
    try { return localStorage.getItem("dot_lb_color") || "#ffffff"; } catch { return "#ffffff"; }
  });

  useEffect(() => {
    audio.setMusicVolume(musicVolume);
    audio.setSfxVolume(sfxVolume);
  }, []);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const mergedHighScores = { ...defaultStats.highScores, ...parsed.highScores };
        const mergedUnlocked = Array.isArray(parsed.unlockedDots) ? parsed.unlockedDots : ["drop"];
        if (!mergedUnlocked.includes("drop")) mergedUnlocked.push("drop");
        setStats({
          unlockedDots: mergedUnlocked,
          selectedDot: typeof parsed.selectedDot === "string" ? parsed.selectedDot : "drop",
          totalPloints: typeof parsed.totalPloints === "number" ? parsed.totalPloints : 0,
          highScores: mergedHighScores,
        });
        if (parsed.totalKills) setTotalKills(parsed.totalKills);
        if (typeof parsed.neoDropUnlocked === "boolean") setNeoDropUnlocked(parsed.neoDropUnlocked);
      }
    } catch (e) {
      console.warn("Could not load saved data", e);
    }
  }, []);

  const totalKillsRef = useRef(totalKills);
  useEffect(() => { totalKillsRef.current = totalKills; }, [totalKills]);

  useEffect(() => {
    if (neoDropUnlocked) return;
    const allBought = ALL_PURCHASABLE_DOTS.every((id) => stats.unlockedDots.includes(id));
    if (allBought) {
      setNeoDropAnimating(true);
      const updated = { ...stats, unlockedDots: [...stats.unlockedDots] };
      setNeoDropUnlocked(true);
      saveStats(updated, totalKillsRef.current, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.unlockedDots, neoDropUnlocked]);

  const saveStats = (newStats: PlayerStats, kills = totalKills, neo = neoDropUnlocked) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...newStats, totalKills: kills, neoDropUnlocked: neo }));
    } catch (e) {
      console.error("Could not save", e);
    }
  };

  const handleSelectDot = (dotId: string) => {
    if (stats.unlockedDots.includes(dotId) || (dotId === NEO_DROP_ID && neoDropUnlocked)) {
      const updated = { ...stats, selectedDot: dotId };
      setStats(updated);
      saveStats(updated);
    }
  };

  const handleUnlockDot = (dotId: string, cost: number) => {
    if (stats.totalPloints >= cost && !stats.unlockedDots.includes(dotId)) {
      const updatedUnlocked = [...stats.unlockedDots, dotId];
      const updated = { ...stats, unlockedDots: updatedUnlocked, totalPloints: stats.totalPloints - cost };
      setStats(updated);
      saveStats(updated);
    }
  };

  const handleUnlockAll = () => {
    const allIds = DOTS_DATABASE.map((d) => d.id);
    const updated = { ...stats, unlockedDots: allIds };
    setStats(updated);
    saveStats(updated);
  };

  const handleResetNeoDrop = () => {
    setNeoDropUnlocked(false);
    setNeoDropAnimating(false);
    saveStats(stats, totalKills, false);
  };

  const handleAddLivePloints = (amount: number) => {
    setStats((prev) => {
      const updated = { ...prev, totalPloints: prev.totalPloints + amount };
      saveStats(updated);
      return updated;
    });
  };

  const handleToggleBigMode = () => {
    setBigMode((prev) => {
      const next = !prev;
      try { localStorage.setItem("dot_bigmode", next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const handleToggleMute = () => {
    const nextMuted = audio.toggleMute();
    setIsMuted(nextMuted);
  };

  const handleMusicVolume = (v: number) => {
    setMusicVolumeState(v);
    audio.setMusicVolume(v);
    try { localStorage.setItem("dot_music_vol", String(v)); } catch {}
  };

  const handleSfxVolume = (v: number) => {
    setSfxVolumeState(v);
    audio.setSfxVolume(v);
    try { localStorage.setItem("dot_sfx_vol", String(v)); } catch {}
  };

  const handleSetLeaderboardName = (n: string | null) => {
    setLeaderboardName(n);
    try {
      if (n) localStorage.setItem("dot_lb_name", n);
      else localStorage.removeItem("dot_lb_name");
    } catch {}
  };

  const handleSetLeaderboardColor = (c: string) => {
    setLeaderboardColor(c);
    try { localStorage.setItem("dot_lb_color", c); } catch {}
  };

  const handleStartGame = (dif: Difficulty, customDiff?: CustomDifficulty) => {
    setCurrentDifficulty(dif);
    setCurrentCustomDiff(customDiff || null);
    setScreen("playing");
  };

  const handleGameOver = (finalSeconds: number, gains: number, kills: number) => {
    const finalGains = finalSeconds >= 5.0 ? gains : 0;
    setSecondsSurvived(finalSeconds);
    setPlointsGained(finalGains);
    setSessionKills(kills);

    // Scores are tracked per difficulty + bigMode separately
    const baseDiffKey = currentCustomDiff ? currentCustomDiff.name : currentDifficulty;
    const diffKey = bigMode ? `${baseDiffKey}_big` : baseDiffKey;

    const oldBestKills = totalKills[diffKey] || 0;
    setPrevBestKills(oldBestKills);

    const updatedKills = { ...totalKills, [diffKey]: Math.max(oldBestKills, kills) };
    setTotalKills(updatedKills);

    // Capture the old high score BEFORE updating stats, so DeathScreen can
    // correctly detect a new personal best (after setStats it would always match).
    const oldHighScore = stats.highScores[diffKey] || 0;
    setPrevHighScore(oldHighScore);

    setStats((prev) => {
      const prevMax = prev.highScores[diffKey] || 0;
      const isNewHigh = finalSeconds > prevMax;
      const updatedHighScores = { ...prev.highScores, [diffKey]: isNewHigh ? finalSeconds : prevMax };
      const updated = { ...prev, totalPloints: prev.totalPloints + finalGains, highScores: updatedHighScores };
      saveStats(updated, updatedKills);
      return updated;
    });

    setScreen("summary");
  };

  const handleRetryGame = () => setScreen("playing");
  const handleExitToMenu = () => setScreen("menu");

  const handleNeedName = () => {
    setNameInput("");
    setShowNamePrompt(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const handleNameSubmit = () => {
    const trimmed = nameInput.trim().slice(0, 20);
    if (trimmed) handleSetLeaderboardName(trimmed);
    setShowNamePrompt(false);
    setNameInput("");
  };

  const selectedDotConfig: DotConfig =
    DOTS_DATABASE.find((d) => d.id === stats.selectedDot) || DOTS_DATABASE[0];

  const effectiveSelectedDot =
    stats.selectedDot === NEO_DROP_ID
      ? { ...DOTS_DATABASE[0], id: NEO_DROP_ID, name: "Neo Drop", color: "#c084fc", borderColor: "#e9d5ff" }
      : selectedDotConfig;

  return (
    <div className="w-full h-full bg-black text-white" style={{ minHeight: "100vh", WebkitUserSelect: "none", userSelect: "none" }}>
      {showNamePrompt && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85"
          onKeyDown={(e) => { if (e.key === "Escape") { setShowNamePrompt(false); setNameInput(""); } }}
        >
          <div className="bg-[#080808] border border-[#333] w-full max-w-sm mx-4 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#222] pb-2">
              <span className="text-xs font-black uppercase tracking-widest text-white">ENTER LEADERBOARD NAME</span>
              <button onClick={() => { setShowNamePrompt(false); setNameInput(""); }} className="text-zinc-500 hover:text-white cursor-pointer text-sm">✕</button>
            </div>
            <input
              ref={nameInputRef}
              type="text"
              value={nameInput}
              maxLength={20}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleNameSubmit(); if (e.key === "Escape") { setShowNamePrompt(false); setNameInput(""); } }}
              placeholder="YOUR NAME"
              className="bg-[#0a0a0a] border border-[#333] text-white text-sm px-3 py-2.5 font-mono focus:border-neon-cyan outline-none tracking-widest"
            />
            <div className="flex gap-2">
              <button
                onClick={handleNameSubmit}
                className="flex-1 py-2 text-xs font-black uppercase border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10 cursor-pointer transition-all"
              >
                CONFIRM
              </button>
              <button
                onClick={() => { setShowNamePrompt(false); setNameInput(""); }}
                className="px-4 py-2 text-xs font-black uppercase border border-zinc-600 text-zinc-400 hover:text-white cursor-pointer transition-all"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === "menu" && (
        <MainMenu
          unlockedDots={stats.unlockedDots}
          selectedDotId={stats.selectedDot}
          onSelectDot={handleSelectDot}
          highScores={stats.highScores}
          totalKills={totalKills}
          totalPloints={stats.totalPloints}
          onStartGame={handleStartGame}
          onOpenShop={() => setScreen("shop")}
          bigMode={bigMode}
          onToggleBigMode={handleToggleBigMode}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          musicVolume={musicVolume}
          sfxVolume={sfxVolume}
          onMusicVolume={handleMusicVolume}
          onSfxVolume={handleSfxVolume}
          invincible={invincible}
          onToggleInvincible={() => setInvincible((p) => {
            const next = !p;
            try { localStorage.setItem("dot_invincible", next ? "1" : "0"); } catch {}
            return next;
          })}
          spamtonRange={spamtonRange}
          onSetSpamtonRange={(r) => { setSpamtonRange(r); try { localStorage.setItem("dot_spamton_range", JSON.stringify(r)); } catch {} }}
          customDifficulties={customDifficulties}
          onSetCustomDifficulties={setCustomDifficulties}
          leaderboardName={leaderboardName}
          leaderboardColor={leaderboardColor}
          onSetLeaderboardName={handleSetLeaderboardName}
          onSetLeaderboardColor={handleSetLeaderboardColor}
          onUnlockAll={handleUnlockAll}
          stats={stats}
          onSetStats={setStats}
          onSaveStats={saveStats}
          neoDropUnlocked={neoDropUnlocked}
          neoDropAnimating={neoDropAnimating}
          onNeoDropAnimDone={() => setNeoDropAnimating(false)}
          onNeedName={handleNeedName}
          onResetNeoDrop={handleResetNeoDrop}
          onSetTotalKills={(k) => { setTotalKills(k); saveStats(stats, k); }}
          initialTab={menuTab}
          onTabConsumed={() => setMenuTab("menu")}
          experimentalSettings={experimentalSettings}
          onSetExperimentalSettings={setExperimentalSettings}
        />
      )}

      {screen === "playing" && (
        <GameCanvas
          difficulty={currentDifficulty}
          customDifficulty={currentCustomDiff}
          selectedDot={effectiveSelectedDot}
          onGameOver={handleGameOver}
          onExit={handleExitToMenu}
          bigMode={bigMode}
          invincible={invincible}
          addPloints={handleAddLivePloints}
          isFullscreen={isFullscreen}
          killFlashEnabled={experimentalSettings.killFlashEnabled}
          killFlashIntensity={experimentalSettings.killFlashIntensity}
          screenShakeEnabled={experimentalSettings.screenShakeEnabled}
          screenShakeIntensity={experimentalSettings.screenShakeIntensity}
          comboPitchEnabled={experimentalSettings.comboPitchEnabled}
        />
      )}

      {screen === "shop" && (
        <ShopMenu
          unlockedDots={stats.unlockedDots}
          totalPloints={stats.totalPloints}
          onUnlockDot={handleUnlockDot}
          onExit={handleExitToMenu}
          onOpenLeaderboard={() => { setMenuTab("leaderboard"); setScreen("menu"); }}
          onOpenSettings={() => { setMenuTab("settings"); setScreen("menu"); }}
        />
      )}

      {screen === "summary" && (
        <DeathScreen
          difficulty={currentDifficulty}
          customDiffName={currentCustomDiff ? currentCustomDiff.name : null}
          secondsSurvived={secondsSurvived}
          plointsGained={plointsGained}
          highScore={prevHighScore}
          kills={sessionKills}
          prevBestKills={prevBestKills}
          onRetry={handleRetryGame}
          onExit={handleExitToMenu}
        />
      )}
    </div>
  );
}