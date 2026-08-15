import React, { useState, useEffect, useCallback } from "react";
import { Difficulty, DOTS_DATABASE, NEO_DROP_ID } from "../types";
import {
  db,
  getLeaderboardPage,
  submitScore,
  deleteExistingScore,
  getDeviceId,
  LeaderboardEntry,
  LeaderboardCategory,
  PAGE_SIZE,
} from "../utils/firebase";
import { audio } from "../utils/audio";
import { DeviceType, PlatformSpoof } from "../utils/deviceType";

const NEO_DOT_COLOR = "#c084fc";

function getDotColor(dotId: string | undefined): string | undefined {
  if (!dotId) return undefined;
  if (dotId === NEO_DROP_ID) return NEO_DOT_COLOR;
  return DOTS_DATABASE.find((d) => d.id === dotId)?.color;
}

function getDotName(dotId: string | undefined): string | undefined {
  if (!dotId) return undefined;
  if (dotId === NEO_DROP_ID) return "Neo Drop";
  return DOTS_DATABASE.find((d) => d.id === dotId)?.name;
}

// Small pixel-grid icons for the device-type column. Each is an 8x8 (or similar) block grid
// drawn with <rect> on a shared viewBox, crispEdges so it reads as blocky/pixelated rather
// than anti-aliased, matching the game's general aesthetic rather than a smooth icon-font glyph.
const DEVICE_ICON_PATHS: Record<DeviceType, string> = {
  // Phone: narrow, tall, portrait — a slim vertical bar with a small home-button notch
  phone: "M3.5,1 H6.5 V13 H3.5 Z M4.5,11.5 H5.5 V12.5 H4.5 Z",
  // Tablet: wide, short, landscape — deliberately a very different silhouette from phone
  // so the two remain distinguishable even at the ~11x14px size they render at in the row.
  tablet: "M0.5,3 H9.5 V11 H0.5 Z M4.5,9.5 H5.5 V10 H4.5 Z",
  // Computer: monitor + small stand
  computer: "M1,2 H9 V8 H1 Z M4,9 H6 V10 H4 Z M2,10.5 H8 V11.5 H2 Z",
  // Unknown: pixelated question mark
  unknown: "M3,2 H7 V3 H8 V5 H7 V6 H6 V7 H5 V6 H6 V5 H7 V4 H6 V3 H4 V4 H3 Z M5,8 H6 V9 H5 Z",
};

const DEVICE_LABELS: Record<DeviceType, string> = {
  phone: "Phone",
  tablet: "Tablet",
  computer: "Computer",
  unknown: "Unknown device",
};

const DeviceIcon: React.FC<{ type: DeviceType | undefined }> = ({ type }) => {
  const resolved: DeviceType = type ?? "unknown";
  return (
    <span className="relative flex items-center group/device shrink-0">
      <svg
        viewBox="0 0 10 14"
        width="11"
        height="14"
        style={{ shapeRendering: "crispEdges" }}
        className="text-zinc-500 group-hover/device:text-zinc-300 transition-colors"
      >
        <path d={DEVICE_ICON_PATHS[resolved]} fill="currentColor" />
      </svg>
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 flex justify-center mb-1.5 z-20 pointer-events-none">
        <span className="hidden group-hover/device:block bg-[#0a0a0a] text-white text-[9px] px-2 py-0.5 border border-[#333] whitespace-nowrap">
          {DEVICE_LABELS[resolved]}
        </span>
      </span>
    </span>
  );
};

interface LeaderboardProps {
  highScores: Record<string, number>;
  totalKills: Record<string, number>;
  bigMode: boolean;
  leaderboardName: string | null;
  leaderboardColor: string;
  onNeedName: () => void;
  highScoreDots?: Record<string, string>;
  highScoreKillsDots?: Record<string, string>;
  platformSpoof?: PlatformSpoof;
}

const DIFFICULTY_NAMES: Record<string, string> = {
  [Difficulty.Blissful]: "Blissful",
  [Difficulty.Pissful]: "Pissful",
  [Difficulty.Ez]: "Ez",
  [Difficulty.Medium]: "Medium",
  [Difficulty.Hard]: "Hard",
  [Difficulty.HardR]: "Hard+",
  [Difficulty.Impossible]: "Impossible",
  [Difficulty.Hell]: "Hell",
  [Difficulty.Dot0]: "DOT-0",
};

const DIFFICULTIES = [
  Difficulty.Blissful,
  Difficulty.Pissful,
  Difficulty.Ez,
  Difficulty.Medium,
  Difficulty.Hard,
  Difficulty.HardR,
  Difficulty.Impossible,
  Difficulty.Hell,
  Difficulty.Dot0,
];

export const Leaderboard: React.FC<LeaderboardProps> = ({
  highScores,
  totalKills,
  bigMode,
  leaderboardName,
  leaderboardColor,
  onNeedName,
  highScoreDots = {},
  highScoreKillsDots = {},
  platformSpoof: platformSpoofProp = "default",
}) => {
  const platformSpoof: PlatformSpoof = platformSpoofProp as PlatformSpoof;
  const [category, setCategory] = useState<LeaderboardCategory>("time");
  const [difficulty, setDifficulty] = useState<string>(Difficulty.Medium);
  const [lbBigMode, setLbBigMode] = useState<boolean>(false);
  const [page, setPage] = useState(0);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const deviceId = getDeviceId();

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getLeaderboardPage(category, difficulty, lbBigMode, p);
      setEntries(result.entries);
      setTotal(result.total);
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("index") || msg.includes("Index")) {
        setError("Firestore index missing. Create an index for: category ASC, difficulty ASC, bigMode ASC, score DESC.");
      } else {
        setError("Failed to load leaderboard. Check your connection and Firestore rules.");
      }
    } finally {
      setLoading(false);
    }
  }, [category, difficulty, lbBigMode]);

  useEffect(() => {
    setPage(0);
    setSubmitted(false);
  }, [category, difficulty, lbBigMode]);

  useEffect(() => {
    fetchPage(page);
  }, [fetchPage, page]);

  const handleSubmit = async () => {
    if (!leaderboardName) { onNeedName(); return; }
    const scoreKey = lbBigMode ? `${difficulty}_big` : difficulty;
    const score = category === "time"
      ? (highScores[scoreKey] || 0)
      : (totalKills[scoreKey] || 0);
    if (score <= 0) {
      setError("You have no score to submit for this category and difficulty.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Remove any existing entry for this device/category/difficulty/bigMode before submitting
      await deleteExistingScore(deviceId, category, difficulty, lbBigMode);
      
      // FIX: Parameters are passed individually, matching firebase.ts perfectly!
      const submitDotId = category === "time" ? highScoreDots[scoreKey] : highScoreKillsDots[scoreKey];
      const submitDotColor = getDotColor(submitDotId);
      await submitScore(
        leaderboardName,
        leaderboardColor,
        score,
        category,
        difficulty,
        lbBigMode,
        submitDotId,
        submitDotColor,
        platformSpoof
      );
      
      setSubmitted(true);
      fetchPage(page);
    } catch (e: any) {
      setError("Failed to submit score.");
    } finally {
      setSubmitting(false);
    }
  };

  const goToPage = (p: number) => {
    const clamped = Math.max(0, Math.min(p, totalPages - 1));
    setPage(clamped);
  };

  const formatScore = (entry: LeaderboardEntry) => {
    if (entry.category === "time") return `${entry.score.toFixed(1)}s`;
    return `${entry.score} kills`;
  };

  const scoreKey = lbBigMode ? `${difficulty}_big` : difficulty;
  const myScore = category === "time"
    ? (highScores[scoreKey] || 0)
    : (totalKills[scoreKey] || 0);

  return (
    <div className="my-auto py-6 flex gap-6 w-full">
      {/* LEFT: filters column */}
      <div className="flex flex-col gap-3 w-44 shrink-0 pt-1">
        <div className="text-[9px] text-zinc-600 uppercase tracking-widest font-black border-b border-[#1a1a1a] pb-2">FILTERS</div>

        {/* Category */}
        <div className="flex flex-col gap-1">
          <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-black mb-0.5">Category</div>
          <div className="flex flex-col border border-[#222] bg-[#050505]">
            {(["time", "kills"] as LeaderboardCategory[]).map((c) => (
              <button
                key={c}
                onClick={() => { audio.playClick(); setCategory(c); }}
                className={`px-4 py-2.5 text-xs uppercase font-black tracking-widest transition-all cursor-pointer text-left ${
                  category === c ? "bg-zinc-900 text-neon-cyan border-l-2 border-neon-cyan" : "text-zinc-500 hover:text-white"
                }`}
              >
                {c === "time" ? "Survival Time" : "Enemies Killed"}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="flex flex-col gap-1">
          <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-black mb-0.5">Difficulty</div>
          <div className="flex flex-col border border-[#222] bg-[#050505]">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                onClick={() => { audio.playClick(); setDifficulty(d); }}
                className={`px-4 py-2.5 text-xs uppercase font-black tracking-widest transition-all cursor-pointer text-left ${
                  difficulty === d ? "bg-zinc-900 text-neon-cyan border-l-2 border-neon-cyan" : "text-zinc-500 hover:text-white"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Big Mode toggle */}
        <button
          onClick={() => { audio.playClick(); setLbBigMode((p) => !p); }}
          className={`px-4 py-3 text-xs uppercase font-black tracking-widest border transition-all cursor-pointer ${
            lbBigMode ? "border-neon-cyan text-neon-cyan bg-neon-cyan/10" : "border-[#333] text-zinc-500 hover:text-white"
          }`}
        >
          {lbBigMode ? "BIG MODE: ON" : "BIG MODE: OFF"}
        </button>
      </div>

      {/* RIGHT: leaderboard content */}
      <div className="flex flex-col gap-4 flex-1 min-w-0">
        {/* Submit bar */}
        <div className="flex items-center justify-between border border-[#222] bg-[#0a0a0a] px-5 py-3.5 gap-4">
          <div className="text-sm text-zinc-400">
            {leaderboardName ? (
              <span>
                Submitting as{" "}
                <span className="font-black" style={{ color: leaderboardColor }}>{leaderboardName}</span>
                {" · "}Your best: <span className="text-white font-black">{category === "time" ? `${myScore.toFixed(1)}s` : `${myScore} kills`}</span>
              </span>
            ) : (
              <span className="text-zinc-500 italic">No name set — click Share PB to enter one</span>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || submitted}
            className={`px-6 py-2.5 text-sm font-black uppercase tracking-widest border transition-all cursor-pointer shrink-0 ${
              submitted
                ? "border-neon-green text-neon-green bg-neon-green/10 cursor-default"
                : submitting
                ? "border-zinc-600 text-zinc-500 cursor-wait"
                : "border-neon-magenta text-neon-magenta hover:bg-neon-magenta/10"
            }`}
          >
            {submitted ? "SUBMITTED" : submitting ? "SUBMITTING..." : "SHARE PB"}
          </button>
        </div>

        {error && (
          <div className="text-sm text-neon-red border border-neon-red/30 bg-rose-950/20 px-4 py-2.5">{error}</div>
        )}

        {/* Pagination top */}
        <PaginationBar
          page={page}
          totalPages={totalPages}
          onGoTo={goToPage}
        />

        {/* Table */}
        <div className="border border-[#222] overflow-hidden">
          <div className="grid grid-cols-[3rem_2rem_1.5rem_18rem_1fr_18rem_10rem_9rem_9rem] text-[10px] text-zinc-500 uppercase tracking-widest font-black bg-[#0a0a0a] border-b border-[#222] px-5 py-3">
            <span>#</span>
            <span></span>
            <span></span>
            <span>Name</span>
            <span></span>
            <span className="text-right">Score</span>
            <span className="pl-8">Mode</span>
            <span>Difficulty</span>
            <span>Category</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-zinc-600 text-sm font-mono">
              LOADING...
            </div>
          ) : entries.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-zinc-600 text-sm font-mono">
              NO ENTRIES YET — BE THE FIRST
            </div>
          ) : (
            entries.map((entry, i) => {
              const rank = page * PAGE_SIZE + i + 1;
              const isMe = entry.deviceId === deviceId;
              const dotColor = entry.dotColor || (entry.dotId ? "#ffffff" : undefined);
              return (
                <div
                  key={entry.id || i}
                  className={`grid grid-cols-[3rem_2rem_1.5rem_18rem_1fr_18rem_10rem_9rem_9rem] items-center px-5 py-3.5 border-b border-[#111] text-sm font-mono transition-colors ${
                    isMe ? "bg-white/5" : "hover:bg-[#0a0a0a]"
                  }`}
                >
                  <span className="text-zinc-500 font-black text-xs">{rank}</span>
                  <span className="relative flex items-center group">
                    {dotColor ? (
                      <>
                        <span
                          style={{
                            display: "inline-block",
                            width: "10px",
                            height: "10px",
                            backgroundColor: dotColor,
                            boxShadow: `0 0 6px ${dotColor}`,
                            flexShrink: 0,
                          }}
                        />
                        <span className="absolute left-[5px] bottom-full w-0 flex justify-center mb-1.5 z-20 pointer-events-none">
                          <span className="hidden group-hover:block bg-[#0a0a0a] text-white text-[9px] px-2 py-0.5 border border-[#333] whitespace-nowrap">
                            {getDotName(entry.dotId) || entry.dotId}
                          </span>
                        </span>
                      </>
                    ) : (
                      <span style={{ display: "inline-block", width: "10px", height: "10px" }} />
                    )}
                  </span>
                  <DeviceIcon type={entry.deviceType} />
                  <span
                    className="font-black truncate min-w-0 overflow-hidden block whitespace-nowrap"
                    style={{ color: entry.color || "#ffffff" }}
                  >
                    {entry.name}
                    {isMe && <span className="ml-2 text-[10px] text-zinc-500 font-normal">(you)</span>}
                  </span>
                  <span></span>
                  <span className="text-white font-black text-base text-right whitespace-nowrap">{formatScore(entry)}</span>
                  <span className={`text-xs font-bold uppercase tracking-wider pl-8 ${entry.bigMode ? "text-neon-cyan" : "text-zinc-600"}`}>
                    {entry.bigMode ? "BIG" : "STANDARD"}
                  </span>
                  <span className="text-xs text-zinc-400 uppercase tracking-wider font-bold">
                    {DIFFICULTY_NAMES[entry.difficulty] || entry.difficulty}
                  </span>
                  <span className="text-xs text-zinc-400 uppercase tracking-wider font-bold">
                    {entry.category === "time" ? "Survival" : "Kills"}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination bottom */}
        <PaginationBar
          page={page}
          totalPages={totalPages}
          onGoTo={goToPage}
        />

        <div className="text-[10px] text-zinc-600 font-mono">
          {total} total entries · Page {page + 1} of {totalPages}
        </div>
      </div>
    </div>
  );
};

interface PaginationBarProps {
  page: number;
  totalPages: number;
  onGoTo: (p: number) => void;
}

const PaginationBar: React.FC<PaginationBarProps> = ({ page, totalPages, onGoTo }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const committingRef = React.useRef(false);

  // Close edit mode if page changes externally (e.g. another bar navigated)
  useEffect(() => { setEditing(false); }, [page]);

  // Focus the input whenever editing becomes true
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const btnClass = "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border border-[#333] text-zinc-400 hover:text-white hover:border-zinc-500 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-default";

  const commit = (raw: string) => {
    if (committingRef.current) return;
    committingRef.current = true;
    const trimmed = raw.trim();
    const n = trimmed === "" ? 1 : parseInt(trimmed, 10);
    const target = isNaN(n) ? 1 : n;
    setEditing(false);
    audio.playClick();
    onGoTo(target - 1);
    setTimeout(() => { committingRef.current = false; }, 50);
  };

  const openEdit = () => {
    setDraft(String(page + 1));
    setEditing(true);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        className={btnClass}
        onClick={() => { audio.playClick(); onGoTo(0); }}
        disabled={page === 0}
      >FIRST</button>
      <button
        className={btnClass}
        onClick={() => { audio.playClick(); onGoTo(page - 1); }}
        disabled={page === 0}
      >PREV</button>

      {editing ? (
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { commit(draft); }
            if (e.key === "Escape") { audio.playClick(); setEditing(false); }
          }}
          className="w-14 text-center bg-[#0a0a0a] border border-neon-cyan text-white text-xs font-mono px-2 py-1 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      ) : (
        <button
          className="px-3 py-1.5 text-[10px] font-black border border-neon-cyan/30 text-neon-cyan bg-neon-cyan/5 cursor-pointer hover:bg-neon-cyan/10 transition-all"
          onClick={openEdit}
          
        >
          {page + 1}
        </button>
      )}

      <button
        className={btnClass}
        onClick={() => { audio.playClick(); onGoTo(page + 1); }}
        disabled={page >= totalPages - 1}
      >NEXT</button>
      <button
        className={btnClass}
        onClick={() => { audio.playClick(); onGoTo(totalPages - 1); }}
        disabled={page >= totalPages - 1}
      >LAST</button>
    </div>
  );
};