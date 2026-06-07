import React, { useState, useEffect, useRef, useCallback } from "react";
import { Difficulty, PlayerStats, DOTS_DATABASE } from "../types";
import { audio } from "../utils/audio";
import { getDeviceId, markEntriesDeleted } from "../utils/firebase";

const KONAMI = [
  "ArrowUp","ArrowUp","ArrowDown","ArrowDown",
  "ArrowLeft","ArrowRight","ArrowLeft","ArrowRight",
  "b","a"
];

const DEBUG_KEY = "dot_debug_enabled";
const CUSTOM_DIFF_KEY = "dot_custom_difficulties";
const SPAMTON_RANGE_KEY = "dot_spamton_range";

export interface CustomDifficulty {
  name: string;
  shields: number;
  enemySpeedMult: number;
  spawnRateBase: number;
  spawnRateMin: number;
  maxEnemies: number;
  laserFreq: number;       // higher = more lasers (legacy combined)
  lineLaserEnabled: boolean;
  waveLaserEnabled: boolean;
  lineLaserFreq: number;
  waveLaserFreq: number;
  sloPerKill: number;
  secondsPerPloint: number;
  permanent: boolean;
}

interface SettingsProps {
  bigMode: boolean;
  onToggleBigMode: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  musicVolume: number;
  sfxVolume: number;
  onMusicVolume: (v: number) => void;
  onSfxVolume: (v: number) => void;
  stats: PlayerStats;
  onSetStats: (s: PlayerStats) => void;
  onSaveStats: (s: PlayerStats) => void;
  onUnlockAll: () => void;
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
  onResetNeoDrop: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  totalKills: Record<string, number>;
  onSetTotalKills: (k: Record<string, number>) => void;
}

const defaultCustomDiff: CustomDifficulty = {
  name: "CUSTOM",
  shields: 1,
  enemySpeedMult: 1.0,
  spawnRateBase: 3000,
  spawnRateMin: 800,
  maxEnemies: 20,
  laserFreq: 1.0,
  lineLaserEnabled: true,
  waveLaserEnabled: false,
  lineLaserFreq: 1.0,
  waveLaserFreq: 0.25,
  sloPerKill: 1.0,
  secondsPerPloint: 10,
  permanent: false,
};

export const SettingsPanel: React.FC<SettingsProps> = ({
  bigMode, onToggleBigMode,
  isMuted, onToggleMute,
  musicVolume, sfxVolume,
  onMusicVolume, onSfxVolume,
  stats, onSetStats, onSaveStats,
  onUnlockAll,
  invincible, onToggleInvincible,
  spamtonRange, onSetSpamtonRange,
  customDifficulties, onSetCustomDifficulties,
  leaderboardName, leaderboardColor,
  onSetLeaderboardName, onSetLeaderboardColor,
  onResetNeoDrop,
  isFullscreen, onToggleFullscreen,
  totalKills, onSetTotalKills,
}) => {
  const [debugEnabled, setDebugEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem(DEBUG_KEY) === "1"; } catch { return false; }
  });
  const [konamiSeq, setKonamiSeq] = useState<string[]>([]);
  const [konamiFlash, setKonamiFlash] = useState(false);

  // Debug sub-states
  const [setPlointsVal, setSetPlointsVal] = useState<string>("");
  const [showBestTimePopup, setShowBestTimePopup] = useState(false);
  const [showKillsPopup, setShowKillsPopup] = useState(false);
  const [killEdits, setKillEdits] = useState<Record<string, string>>({});
  const [showCustomDiffEditor, setShowCustomDiffEditor] = useState(false);
  const [showCustomDiffSavePrompt, setShowCustomDiffSavePrompt] = useState(false);
  const [customDiffNameError, setCustomDiffNameError] = useState(false);
  const [editingCustomDiff, setEditingCustomDiff] = useState<CustomDifficulty>({ ...defaultCustomDiff });
  const [editingCustomIndex, setEditingCustomIndex] = useState<number | null>(null);
  const [showResetPopup, setShowResetPopup] = useState(false);
  const [wipeStage, setWipeStage] = useState<0 | 1 | 2>(0);

  // High score editing
  const [bestTimeEdits, setBestTimeEdits] = useState<Record<string, string>>({});

  // Konami detection — only active when this component is mounted (settings tab active)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    setKonamiSeq((prev) => {
      const next = [...prev, e.key].slice(-KONAMI.length);
      if (next.join(",") === KONAMI.join(",")) {
        // Activate debug
        const newVal = !debugEnabled;
        setDebugEnabled(newVal);
        try { localStorage.setItem(DEBUG_KEY, newVal ? "1" : "0"); } catch {}
        setKonamiFlash(true);
        // Play high-pitch beep
        try {
          const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioCtxClass();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(3200, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.4);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.45);
          setTimeout(() => ctx.close(), 600);
        } catch {}
        setTimeout(() => setKonamiFlash(false), 800);
        return [];
      }
      return next;
    });
  }, [debugEnabled]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSetPloints = () => {
    const val = parseInt(setPlointsVal, 10);
    if (isNaN(val) || val < 0) return;
    const updated = { ...stats, totalPloints: val };
    onSetStats(updated);
    onSaveStats(updated);
    setSetPlointsVal("");
    audio.playClick();
  };

  const handleUnlockAll = () => {
    audio.playClick();
    onUnlockAll();
  };

  const handleSaveBestTimes = () => {
    const newHighScores = { ...stats.highScores };
    Object.entries(bestTimeEdits).forEach(([diff, val]) => {
      const n = parseFloat(val as string);
      if (!isNaN(n) && n >= 0) {
        newHighScores[diff as Difficulty] = n;
      }
    });
    const updated = { ...stats, highScores: newHighScores };
    onSetStats(updated);
    onSaveStats(updated);
    setBestTimeEdits({});
    setShowBestTimePopup(false);
    audio.playClick();
  };

  const handleSaveKills = () => {
    const next = { ...totalKills };
    Object.entries(killEdits).forEach(([diff, val]) => {
      const n = parseInt(val as string, 10);
      if (!isNaN(n) && n >= 0) next[diff] = n;
    });
    onSetTotalKills(next);
    setKillEdits({});
    setShowKillsPopup(false);
    audio.playClick();
  };

  const handleSaveCustomDiff = () => {
    if (!editingCustomDiff.name.trim()) {
      setCustomDiffNameError(true);
      return;
    }
    setCustomDiffNameError(false);
    const next = [...customDifficulties];
    if (editingCustomIndex !== null) {
      next[editingCustomIndex] = editingCustomDiff;
    } else {
      next.push(editingCustomDiff);
    }
    onSetCustomDifficulties(next);
    if (editingCustomDiff.permanent) {
      try { localStorage.setItem(CUSTOM_DIFF_KEY, JSON.stringify(next.filter((d) => d.permanent))); } catch {}
    }
    setShowCustomDiffSavePrompt(false);
    setShowCustomDiffEditor(false);
    setEditingCustomIndex(null);
    setEditingCustomDiff({ ...defaultCustomDiff });
    audio.playClick();
  };

  const handleDeleteCustomDiff = (i: number) => {
    const next = customDifficulties.filter((_, idx) => idx !== i);
    onSetCustomDifficulties(next);
    try {
      localStorage.setItem(CUSTOM_DIFF_KEY, JSON.stringify(next.filter((d) => d.permanent)));
    } catch {}
    audio.playClick();
  };

  const handleResetAll = async () => {
    const deviceId = getDeviceId();
    try { await markEntriesDeleted(deviceId); } catch {}
    try { localStorage.removeItem("dot_invincible"); } catch {}
    localStorage.clear();
    window.location.reload();
  };

  const toggleSlider = (label: string, value: boolean, onToggle: () => void) => (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-zinc-300 uppercase tracking-widest font-black">{label}</span>
      <button
        onClick={() => { audio.playClick(); onToggle(); }}
        className={`shrink-0 w-14 h-7 border-2 relative transition-all cursor-pointer ${value ? "border-neon-cyan bg-neon-cyan/20" : "border-[#333] bg-[#050505]"}`}
      >
        <div className={`absolute top-0.5 w-5 h-5 transition-all ${value ? "left-[30px] bg-neon-cyan" : "left-0.5 bg-zinc-600"}`} />
      </button>
    </div>
  );

  const volumeSlider = (label: string, value: number, onChange: (v: number) => void) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[10px] text-zinc-400 uppercase tracking-widest font-black">
        <span>{label}</span>
        <span className="text-white">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 accent-neon-cyan cursor-pointer"
      />
    </div>
  );

  return (
    <div
      className={`my-auto py-6 flex flex-col gap-6 max-w-2xl transition-all ${konamiFlash ? "opacity-0" : "opacity-100"}`}
      style={{ transition: "opacity 0.15s" }}
    >
      {/* Visual */}
      <Section title="Visual">
        {toggleSlider("Big Mode", bigMode, onToggleBigMode)}
        <p className="text-[10px] text-zinc-500 leading-relaxed -mt-1">
          Makes enemies and your dot larger. Does not affect lasers. Scores are tracked separately per mode in the leaderboard.
        </p>
        {toggleSlider("Fullscreen", isFullscreen, onToggleFullscreen)}
        <p className="text-[10px] text-zinc-500 leading-relaxed -mt-1">
          Enables browser fullscreen mode. Can only be toggled from settings, not mid-game.
        </p>
      </Section>

      {/* Audio */}
      <Section title="Audio">
        {toggleSlider("All Audio", !isMuted, onToggleMute)}
        {volumeSlider("Music Volume", musicVolume, onMusicVolume)}
        {volumeSlider("SFX Volume", sfxVolume, onSfxVolume)}
      </Section>

      {/* Debug */}
      {debugEnabled && (
        <Section title="Debug" accent="neon-red">
          <div className="flex flex-col gap-4">
            {/* Invincibility */}
            {toggleSlider("Invincibility", invincible, onToggleInvincible)}

            {/* Set Ploints */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">Set Ploints</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={setPlointsVal}
                  onChange={(e) => setSetPlointsVal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSetPloints(); }}
                  placeholder={String(stats.totalPloints)}
                  className="flex-1 bg-[#0a0a0a] border border-[#333] text-white text-xs px-3 py-2 font-mono focus:border-neon-cyan outline-none"
                />
                <button
                  onClick={handleSetPloints}
                  className="px-4 py-2 text-xs font-black uppercase border border-neon-magenta text-neon-magenta hover:bg-neon-magenta/10 cursor-pointer transition-all"
                >
                  SET
                </button>
              </div>
            </div>

            {/* Unlock all dots */}
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">Unlock All Dots</span>
              <button
                onClick={handleUnlockAll}
                className="px-4 py-1.5 text-xs font-black uppercase border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10 cursor-pointer transition-all"
              >
                UNLOCK
              </button>
            </div>

            {/* Set best times */}
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">Set Best Times</span>
              <button
                onClick={() => { audio.playClick(); setShowBestTimePopup(true); }}
                className="px-4 py-1.5 text-xs font-black uppercase border border-neon-yellow text-neon-yellow hover:bg-neon-yellow/10 cursor-pointer transition-all"
              >
                OPEN
              </button>
            </div>

            {/* Set kills */}
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">Set Best Kills</span>
              <button
                onClick={() => { audio.playClick(); setShowKillsPopup(true); }}
                className="px-4 py-1.5 text-xs font-black uppercase border border-neon-yellow text-neon-yellow hover:bg-neon-yellow/10 cursor-pointer transition-all"
              >
                OPEN
              </button>
            </div>

            {/* Spamton range */}
            <SpamtonRangeField range={spamtonRange} onChange={onSetSpamtonRange} />

            {/* Leaderboard identity */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">Leaderboard Color</span>
              <ColorPickerField color={leaderboardColor} onChange={onSetLeaderboardColor} />
            </div>

            {/* Custom difficulties */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">Custom Difficulties</span>
                <button
                  onClick={() => { audio.playClick(); setEditingCustomIndex(null); setEditingCustomDiff({ ...defaultCustomDiff }); setShowCustomDiffEditor(true); }}
                  className="px-3 py-1 text-[10px] font-black uppercase border border-neon-green text-neon-green hover:bg-neon-green/10 cursor-pointer transition-all"
                >
                  + NEW
                </button>
              </div>
              {customDifficulties.length === 0 ? (
                <p className="text-[10px] text-zinc-600">No custom difficulties created yet.</p>
              ) : (
                customDifficulties.map((cd, i) => (
                  <div key={i} className="flex items-center justify-between border border-[#222] bg-[#0a0a0a] px-3 py-2">
                    <span className="text-xs text-white font-black uppercase">{cd.name}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { audio.playClick(); setEditingCustomIndex(i); setEditingCustomDiff({ ...cd }); setShowCustomDiffEditor(true); }}
                        className="text-[10px] text-neon-cyan cursor-pointer hover:underline"
                      >EDIT</button>
                      <button
                        onClick={() => handleDeleteCustomDiff(i)}
                        className="text-[10px] text-neon-red cursor-pointer hover:underline"
                      >DEL</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Reset specific */}
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">Reset Specific Data</span>
              <button
                onClick={() => { audio.playClick(); setShowResetPopup(true); }}
                className="px-4 py-1.5 text-xs font-black uppercase border border-zinc-500 text-zinc-300 hover:border-white hover:text-white cursor-pointer transition-all"
              >
                OPEN
              </button>
            </div>

            {/* Reset everything — 3-click confirmation */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-neon-red uppercase tracking-widest font-black">Reset Everything</span>
                <p className="text-[9px] text-zinc-600">Wipes all data including leaderboard entries. Cannot be undone.</p>
              </div>
              <button
                onClick={() => {
                  audio.playClick();
                  if (wipeStage === 0) { setWipeStage(1); }
                  else if (wipeStage === 1) { setWipeStage(2); }
                  else { handleResetAll(); }
                }}
                onBlur={() => setWipeStage(0)}
                className={`px-4 py-1.5 text-xs font-black uppercase border cursor-pointer transition-all shrink-0 ${
                  wipeStage === 0 ? "border-neon-red text-neon-red hover:bg-neon-red/10"
                  : wipeStage === 1 ? "border-orange-400 text-orange-400 hover:bg-orange-400/10"
                  : "border-white text-white hover:bg-white/10 animate-pulse"
                }`}
              >
                {wipeStage === 0 ? "WIPE" : wipeStage === 1 ? "WIPE?" : "CONFIRM"}
              </button>
            </div>

            {/* Disable debug */}
            <div className="border-t border-[#222] pt-3 flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Disable Debug Options</span>
                <p className="text-[9px] text-zinc-600">You can always turn it back on the original way you did.</p>
              </div>
              <button
                onClick={() => {
                  audio.playClick();
                  setDebugEnabled(false);
                  try { localStorage.setItem(DEBUG_KEY, "0"); } catch {}
                }}
                className="px-4 py-1.5 text-xs font-black uppercase border border-zinc-600 text-zinc-400 hover:text-white cursor-pointer transition-all shrink-0"
              >
                DISABLE
              </button>
            </div>
          </div>
        </Section>
      )}

      {/* Best time popup */}
      {showBestTimePopup && (
        <Popup title="Set Best Times" onClose={() => setShowBestTimePopup(false)}>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            {Object.values(Difficulty).flatMap((diff) => [diff, `${diff}_big`]).map((key) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest w-36 shrink-0">
                  {key.endsWith("_big") ? `${key.replace("_big", "")} [BIG]` : key}
                </span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  defaultValue={stats.highScores[key] || 0}
                  onChange={(e) => setBestTimeEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="flex-1 bg-[#0a0a0a] border border-[#333] text-white text-xs px-2 py-1.5 font-mono focus:border-neon-cyan outline-none"
                />
                <span className="text-zinc-600 text-[10px]">s</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleSaveBestTimes}
            className="mt-3 w-full py-2 text-xs font-black uppercase border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10 cursor-pointer transition-all"
          >
            SAVE
          </button>
        </Popup>
      )}

      {/* Set kills popup */}
      {showKillsPopup && (
        <Popup title="Set Best Kills" onClose={() => setShowKillsPopup(false)}>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            {Object.values(Difficulty).flatMap((diff) => [diff, `${diff}_big`]).map((key) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest w-36 shrink-0">
                  {key.endsWith("_big") ? `${key.replace("_big", "")} [BIG]` : key}
                </span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  defaultValue={totalKills[key] || 0}
                  onChange={(e) => setKillEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="flex-1 bg-[#0a0a0a] border border-[#333] text-white text-xs px-2 py-1.5 font-mono focus:border-neon-cyan outline-none"
                />
                <span className="text-zinc-600 text-[10px]">kills</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleSaveKills}
            className="mt-3 w-full py-2 text-xs font-black uppercase border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10 cursor-pointer transition-all"
          >
            SAVE
          </button>
        </Popup>
      )}

      {/* Custom difficulty editor popup */}
      {showCustomDiffEditor && (
        <CustomDiffPopup
          title={editingCustomIndex !== null ? "Edit Custom Difficulty" : "New Custom Difficulty"}
          onClose={() => { setShowCustomDiffSavePrompt(false); setShowCustomDiffEditor(false); setEditingCustomIndex(null); setEditingCustomDiff({ ...defaultCustomDiff }); setCustomDiffNameError(false); }}
          onSave={handleSaveCustomDiff}
          showSavePrompt={showCustomDiffSavePrompt}
          setShowSavePrompt={setShowCustomDiffSavePrompt}
        >
          <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto pr-1">
            <DiffField label="Name" value={editingCustomDiff.name} onChange={(v) => { setEditingCustomDiff((p) => ({ ...p, name: v.toUpperCase().slice(0, 20) })); setCustomDiffNameError(false); }} type="text" />
            {customDiffNameError && (
              <p className="text-[10px] text-neon-red font-bold uppercase tracking-widest -mt-1">
                Name cannot be blank.
              </p>
            )}
            <DiffField label="Shields" value={editingCustomDiff.shields} onChange={(v) => setEditingCustomDiff((p) => ({ ...p, shields: +v }))} step={1} />
            <DiffField label="Enemy Speed Multiplier" value={editingCustomDiff.enemySpeedMult} onChange={(v) => setEditingCustomDiff((p) => ({ ...p, enemySpeedMult: +v }))} step={0.1} />
            <DiffField label="Initial Spawn Interval (ms)" value={editingCustomDiff.spawnRateBase} onChange={(v) => setEditingCustomDiff((p) => ({ ...p, spawnRateBase: +v }))} step={100} />
            <DiffField label="Minimum Spawn Interval (ms)" value={editingCustomDiff.spawnRateMin} onChange={(v) => setEditingCustomDiff((p) => ({ ...p, spawnRateMin: +v }))} step={100} />
            <DiffField label="Max Enemies On Screen" value={editingCustomDiff.maxEnemies} onChange={(v) => setEditingCustomDiff((p) => ({ ...p, maxEnemies: +v }))} step={1} />
            {/* Laser toggles */}
            <div className="border-t border-[#1a1a1a] pt-2 mt-1">
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">Laser Types</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingCustomDiff.lineLaserEnabled}
                  onChange={(e) => setEditingCustomDiff((p) => ({ ...p, lineLaserEnabled: e.target.checked }))}
                  className="accent-neon-red cursor-pointer"
                />
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest">Line Lasers</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingCustomDiff.waveLaserEnabled}
                  onChange={(e) => setEditingCustomDiff((p) => ({ ...p, waveLaserEnabled: e.target.checked }))}
                  className="accent-neon-green cursor-pointer"
                />
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest">Wave Lasers</span>
              </label>
            </div>
            {editingCustomDiff.lineLaserEnabled && (
              <div className="flex flex-col gap-0.5">
                <DiffField label="Line Laser Frequency (multiplier)" value={editingCustomDiff.lineLaserFreq} onChange={(v) => setEditingCustomDiff((p) => ({ ...p, lineLaserFreq: +v }))} step={0.1} />
                <p className="text-[9px] text-zinc-600 ml-0 pl-0">1 = ~1 laser per 5.5s. 10 = ~1 per 0.5s. Higher = more frequent.</p>
              </div>
            )}
            {editingCustomDiff.waveLaserEnabled && (
              <div className="flex flex-col gap-0.5">
                <DiffField label="Wave Laser Frequency (multiplier)" value={editingCustomDiff.waveLaserFreq} onChange={(v) => setEditingCustomDiff((p) => ({ ...p, waveLaserFreq: +v }))} step={0.05} />
                <p className="text-[9px] text-zinc-600">Controls how often wave lasers are chosen over line lasers. 0.05 = rare, 5 = wave-dominant.</p>
              </div>
            )}
            <DiffField label="SLO Per Kill Multiplier" value={editingCustomDiff.sloPerKill} onChange={(v) => setEditingCustomDiff((p) => ({ ...p, sloPerKill: +v }))} step={0.1} />
            <DiffField label="Seconds Per Ploint" value={editingCustomDiff.secondsPerPloint} onChange={(v) => setEditingCustomDiff((p) => ({ ...p, secondsPerPloint: +v }))} step={1} />
            <div className="flex items-center gap-2 mt-1">
              <input
                type="checkbox"
                id="perm-check"
                checked={editingCustomDiff.permanent}
                onChange={(e) => setEditingCustomDiff((p) => ({ ...p, permanent: e.target.checked }))}
                className="accent-neon-cyan cursor-pointer"
              />
              <label htmlFor="perm-check" className="text-[10px] text-zinc-400 uppercase tracking-widest cursor-pointer">
                Permanent (persists across reloads)
              </label>
            </div>
          </div>
          <button
            onClick={handleSaveCustomDiff}
            className="mt-3 w-full py-2 text-xs font-black uppercase border border-neon-green text-neon-green hover:bg-neon-green/10 cursor-pointer transition-all"
          >
            SAVE DIFFICULTY
          </button>
        </CustomDiffPopup>
      )}

      {/* Reset specific popup */}
      {showResetPopup && (
        <Popup title="Reset Specific Data" onClose={() => setShowResetPopup(false)}>
          <div className="flex flex-col gap-2">
            <ResetItem label="All High Scores" onReset={() => {
              const fresh = { ...stats, highScores: { ...stats.highScores } };
              Object.values(Difficulty).forEach((d) => { fresh.highScores[d] = 0; });
              onSetStats(fresh); onSaveStats(fresh);
            }} />
            <ResetItem label="Total Ploints" onReset={() => {
              const fresh = { ...stats, totalPloints: 0 };
              onSetStats(fresh); onSaveStats(fresh);
            }} />
            <ResetItem label="Unlocked Dots" onReset={() => {
              const fresh = { ...stats, unlockedDots: ["drop"], selectedDot: "drop" };
              onSetStats(fresh); onSaveStats(fresh);
              onResetNeoDrop();
            }} />
            <ResetItem label="Custom Difficulties" onReset={() => {
              onSetCustomDifficulties([]);
              try { localStorage.removeItem(CUSTOM_DIFF_KEY); } catch {}
            }} />
            <ResetItem label="Leaderboard Name" onReset={() => {
              onSetLeaderboardName(null);
              try { localStorage.removeItem("dot_lb_name"); } catch {}
            }} />
            <ResetItem label="Leaderboard Color" onReset={() => {
              onSetLeaderboardColor("#ffffff");
              try { localStorage.setItem("dot_lb_color", "#ffffff"); } catch {}
            }} />
            <ResetItem label="Big Mode Setting" onReset={() => {
              try { localStorage.removeItem("dot_bigmode"); } catch {}
              window.location.reload();
            }} />
            <ResetItem label="Debug Mode" onReset={() => {
              setDebugEnabled(false);
              try { localStorage.removeItem(DEBUG_KEY); } catch {}
              setShowResetPopup(false);
            }} />
          </div>
        </Popup>
      )}
    </div>
  );
};

const Section: React.FC<{ title: string; accent?: string; children: React.ReactNode }> = ({ title, accent, children }) => (
  <div className="flex flex-col gap-3 border border-[#222] bg-[#0a0a0a] p-5">
    <div className={`text-[9px] uppercase tracking-widest font-black border-b border-[#1a1a1a] pb-2 ${accent ? `text-${accent}` : "text-zinc-500"}`}>
      {title}
    </div>
    {children}
  </div>
);

const Popup: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        audio.playClick();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true); // capture so popup always wins
    return () => window.removeEventListener("keydown", handler, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-[#080808] border border-[#333] w-full max-w-md mx-4 p-6 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-[#222] pb-2">
          <span className="text-xs font-black uppercase tracking-widest text-white">{title}</span>
          <button onClick={() => { audio.playClick(); onClose(); }} className="text-zinc-500 hover:text-white cursor-pointer text-sm">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};

// Custom diff popup — ESC shows a save-or-discard prompt instead of immediately closing
const CustomDiffPopup: React.FC<{
  title: string;
  onClose: () => void;
  onSave: () => void;
  showSavePrompt: boolean;
  setShowSavePrompt: (v: boolean) => void;
  children: React.ReactNode;
}> = ({ title, onClose, onSave, showSavePrompt, setShowSavePrompt, children }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        audio.playClick();
        if (showSavePrompt) { setShowSavePrompt(false); }
        else { setShowSavePrompt(true); }
      }
    };
    window.addEventListener("keydown", handler, true); // capture phase to beat other ESC handlers
    return () => window.removeEventListener("keydown", handler, true);
  }, [onClose, showSavePrompt, setShowSavePrompt]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-[#080808] border border-[#333] w-full max-w-md mx-4 p-6 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-[#222] pb-2">
          <span className="text-xs font-black uppercase tracking-widest text-white">{title}</span>
          <button onClick={() => { audio.playClick(); setShowSavePrompt(true); }} className="text-zinc-500 hover:text-white cursor-pointer text-sm">✕</button>
        </div>
        {showSavePrompt ? (
          <div className="flex flex-col gap-3 py-2">
            <p className="text-xs text-zinc-300 uppercase tracking-widest">Save before closing?</p>
            <div className="flex gap-2">
              <button
                onClick={() => { onSave(); }}
                className="flex-1 py-2 text-xs font-black uppercase border border-neon-green text-neon-green hover:bg-neon-green/10 cursor-pointer transition-all"
              >
                SAVE
              </button>
              <button
                onClick={() => { audio.playClick(); onClose(); }}
                className="flex-1 py-2 text-xs font-black uppercase border border-zinc-600 text-zinc-400 hover:text-white cursor-pointer transition-all"
              >
                DISCARD
              </button>
              <button
                onClick={() => { audio.playClick(); setShowSavePrompt(false); }}
                className="px-4 py-2 text-xs font-black uppercase border border-zinc-700 text-zinc-500 hover:text-white cursor-pointer transition-all"
              >
                CANCEL
              </button>
            </div>
          </div>
        ) : children}
      </div>
    </div>
  );
};

const ResetItem: React.FC<{ label: string; onReset: () => void }> = ({ label, onReset }) => (
  <div className="flex items-center justify-between border border-[#1a1a1a] px-3 py-2">
    <span className="text-[11px] text-zinc-300 uppercase tracking-widest">{label}</span>
    <button
      onClick={() => { audio.playClick(); onReset(); }}
      className="text-[10px] font-black uppercase text-neon-red hover:underline cursor-pointer"
    >
      RESET
    </button>
  </div>
);

const DiffField: React.FC<{
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  step?: number;
}> = ({ label, value, onChange, type = "number", step }) => {
  const [draft, setDraft] = React.useState(String(value));
  const [focused, setFocused] = React.useState(false);

  // Only sync from parent when the field is not focused (i.e. external reset)
  React.useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  if (type === "text") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-zinc-400 uppercase tracking-widest shrink-0 w-44">{label}</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-[#050505] border border-[#333] text-white text-xs px-2 py-1.5 font-mono focus:border-neon-cyan outline-none"
        />
      </div>
    );
  }

  const commit = () => {
    setFocused(false);
    const parsed = step != null && step < 1 ? parseFloat(draft) : parseInt(draft, 10);
    const resolved = isNaN(parsed) ? 0 : parsed;
    const rounded = step != null && step < 1 ? String(parseFloat((Math.round(resolved / step) * step).toFixed(10))) : String(Math.round(resolved));
    setDraft(rounded);
    onChange(rounded);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-400 uppercase tracking-widest shrink-0 w-44">{label}</span>
      <input
        type="number"
        value={draft}
        step={step}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { audio.playClick(); (e.target as HTMLInputElement).blur(); } }}
        className="flex-1 bg-[#050505] border border-[#333] text-white text-xs px-2 py-1.5 font-mono focus:border-neon-cyan outline-none"
      />
    </div>
  );
};

// Converts hex to HSV. Returns [h 0-360, s 0-1, v 0-1].
function hexToHsv(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

// Converts HSV to hex.
function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    const val = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(val * 255).toString(16).padStart(2, "0");
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}

// Inline HSV color picker — no native input, no double-click nonsense
const ColorPickerField: React.FC<{ color: string; onChange: (c: string) => void }> = ({ color, onChange }) => {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(color);
  const pickerRef = React.useRef<HTMLDivElement>(null);
  const svCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const hueCanvasRef = React.useRef<HTMLCanvasElement>(null);

  const safeColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#ffffff";
  const [h, s, v] = hexToHsv(safeColor);
  const [hue, setHue] = useState(h);
  const [sat, setSat] = useState(s);
  const [val, setVal] = useState(v);

  // Sync local HSV when color prop changes externally
  useEffect(() => {
    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
      const [nh, ns, nv] = hexToHsv(color);
      setHue(nh); setSat(ns); setVal(nv);
      setHexInput(color);
    }
  }, [color]);

  // Draw SV gradient on canvas
  useEffect(() => {
    const canvas = svCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    // White to hue gradient (horizontal)
    const hGrad = ctx.createLinearGradient(0, 0, W, 0);
    hGrad.addColorStop(0, "#ffffff");
    hGrad.addColorStop(1, `hsl(${hue},100%,50%)`);
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 0, W, H);
    // Transparent to black gradient (vertical)
    const vGrad = ctx.createLinearGradient(0, 0, 0, H);
    vGrad.addColorStop(0, "rgba(0,0,0,0)");
    vGrad.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, W, H);
  }, [hue, open]);

  // Draw hue strip on canvas
  useEffect(() => {
    const canvas = hueCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    for (let i = 0; i <= 6; i++) grad.addColorStop(i / 6, `hsl(${i * 60},100%,50%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }, [open]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onOutside);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onOutside); };
  }, [open]);

  const commit = (nh: number, ns: number, nv: number) => {
    const hex = hsvToHex(nh, ns, nv);
    onChange(hex);
    setHexInput(hex);
  };

  const handleSvDrag = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = svCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ns = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const nv = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    setSat(ns); setVal(nv);
    commit(hue, ns, nv);
  };

  const handleHueDrag = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = hueCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nh = Math.max(0, Math.min(360, ((e.clientX - rect.left) / rect.width) * 360));
    setHue(nh);
    commit(nh, sat, val);
  };

  const handleSvMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleSvDrag(e);
    const onMove = (ev: MouseEvent) => handleSvDrag(ev as any);
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleHueMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    handleHueDrag(e);
    const onMove = (ev: MouseEvent) => handleHueDrag(ev as any);
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleHexChange = (val: string) => {
    setHexInput(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      onChange(val);
      const [nh, ns, nv] = hexToHsv(val);
      setHue(nh); setSat(ns); setVal(nv);
    }
  };

  // Cursor position on SV canvas
  const svX = sat * 160;
  const svY = (1 - val) * 140;
  // Cursor position on hue strip
  const hueX = (hue / 360) * 160;

  return (
    <div className="relative" ref={pickerRef}>
      <div className="flex gap-2 items-center">
        {/* Color swatch */}
        <button
          onClick={() => { audio.playClick(); setOpen((p) => !p); }}
          className="w-9 h-9 border border-[#333] hover:border-neon-cyan shrink-0 transition-colors cursor-pointer"
          style={{ background: safeColor }}
          title="Pick color"
        />
        {/* Hex field */}
        <div className="flex flex-1 bg-[#0a0a0a] border border-[#333] focus-within:border-neon-cyan transition-colors">
          <span className="text-zinc-500 text-xs font-mono px-2 py-2 select-none pointer-events-none">#</span>
          <input
            type="text"
            value={hexInput.replace(/^#/, "")}
            maxLength={6}
            onChange={(e) => handleHexChange("#" + e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6))}
            placeholder="ffffff"
            className="flex-1 bg-transparent text-white text-xs px-0 py-2 pr-2 font-mono outline-none"
          />
        </div>
      </div>

      {/* Picker popup */}
      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 border border-[#444] bg-[#0a0a0a] p-3 shadow-2xl select-none" style={{ width: "184px" }}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">Color Picker</span>
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-white text-xs cursor-pointer">✕</button>
            </div>

            {/* SV canvas */}
            <div className="relative" style={{ width: 160, height: 140 }}>
              <canvas
                ref={svCanvasRef}
                width={160}
                height={140}
                onMouseDown={handleSvMouseDown}
                className="cursor-crosshair block"
                style={{ width: 160, height: 140 }}
              />
              {/* Cursor dot */}
              <div
                className="absolute pointer-events-none border-2 border-white rounded-full"
                style={{ width: 10, height: 10, left: svX - 5, top: svY - 5, boxShadow: "0 0 0 1px rgba(0,0,0,0.5)" }}
              />
            </div>

            {/* Hue strip */}
            <div className="relative" style={{ width: 160, height: 14 }}>
              <canvas
                ref={hueCanvasRef}
                width={160}
                height={14}
                onMouseDown={handleHueMouseDown}
                className="cursor-ew-resize block"
                style={{ width: 160, height: 14 }}
              />
              {/* Cursor */}
              <div
                className="absolute pointer-events-none border-2 border-white"
                style={{ width: 6, height: 14, left: hueX - 3, top: 0, boxShadow: "0 0 0 1px rgba(0,0,0,0.5)" }}
              />
            </div>

            {/* Preset swatches */}
            <div className="grid grid-cols-8 gap-1 pt-1 border-t border-[#222]">
              {[
                "#ffffff","#00FFFF","#FF00FF","#00FF00","#FF3131","#FFFF00",
                "#c084fc","#f97316","#22d3ee","#10b981","#a855f7","#f43f5e",
                "#facc15","#38bdf8","#fb923c","#4ade80",
              ].map((swatch) => (
                <button
                  key={swatch}
                  onClick={() => { onChange(swatch); setHexInput(swatch); const [nh,ns,nv]=hexToHsv(swatch); setHue(nh); setSat(ns); setVal(nv); }}
                  className="w-5 h-5 border border-transparent hover:border-white transition-colors cursor-pointer shrink-0"
                  style={{ background: swatch }}
                  title={swatch}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Spamton range field — uses local draft state, commits to parent on blur
const SpamtonRangeField: React.FC<{
  range: [number, number];
  onChange: (r: [number, number]) => void;
}> = ({ range, onChange }) => {
  const [draftMin, setDraftMin] = React.useState(String(range[0]));
  const [draftMax, setDraftMax] = React.useState(String(range[1]));

  // Keep drafts in sync if parent changes externally (e.g. reset)
  React.useEffect(() => { setDraftMin(String(range[0])); }, [range[0]]);
  React.useEffect(() => { setDraftMax(String(range[1])); }, [range[1]]);

  const commitMin = () => {
    const val = draftMin === "" ? 0 : Math.max(0, parseFloat(draftMin) || 0);
    setDraftMin(String(val));
    onChange([val, range[1]]);
  };
  const commitMax = () => {
    const val = draftMax === "" ? 0 : Math.max(0, parseFloat(draftMax) || 0);
    setDraftMax(String(val));
    onChange([range[0], val]);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">
        Spamton Appearance Range (minutes)
      </span>
      <div className="flex gap-2 items-center">
        <input
          type="number"
          value={draftMin}
          min={0}
          placeholder="0"
          onChange={(e) => setDraftMin(e.target.value)}
          onBlur={commitMin}
          className="w-20 bg-[#0a0a0a] border border-[#333] text-white text-xs px-2 py-1.5 font-mono focus:border-neon-cyan outline-none"
        />
        <span className="text-zinc-500 text-xs">to</span>
        <input
          type="number"
          value={draftMax}
          min={0}
          placeholder="0"
          onChange={(e) => setDraftMax(e.target.value)}
          onBlur={commitMax}
          className="w-20 bg-[#0a0a0a] border border-[#333] text-white text-xs px-2 py-1.5 font-mono focus:border-neon-cyan outline-none"
        />
      </div>
      <p className="text-[9px] text-zinc-600">Resets on page reload. Default: 2 to 3 minutes.</p>
    </div>
  );
};