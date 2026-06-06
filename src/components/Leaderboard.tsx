import React, { useState, useEffect, useCallback } from "react";
import { Difficulty } from "../types";
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

interface LeaderboardProps {
  highScores: Record<string, number>;
  totalKills: Record<string, number>;
  bigMode: boolean;
  leaderboardName: string | null;
  leaderboardColor: string;
  onNeedName: () => void;
}

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
}) => {
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
  const [editingPage, setEditingPage] = useState(false);
  const [pageInput, setPageInput] = useState("");

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
    const score = category === "time"
      ? (highScores[difficulty] || 0)
      : (totalKills[difficulty] || 0);
    if (score <= 0) {
      setError("You have no score to submit for this category and difficulty.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Remove any existing entry for this device/category/difficulty/bigMode before submitting
      await deleteExistingScore(deviceId, category, difficulty, lbBigMode);
      await submitScore({
        name: leaderboardName,
        color: leaderboardColor,
        score,
        category,
        difficulty,
        bigMode: lbBigMode,
        deviceId,
        deleted: false,
      });
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

  const myScore = category === "time"
    ? (highScores[difficulty] || 0)
    : (totalKills[difficulty] || 0);

  return (
    <div className="my-auto py-6 flex flex-col gap-4 w-full max-w-3xl">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Category */}
        <div className="flex border border-[#222] bg-[#050505]">
          {(["time", "kills"] as LeaderboardCategory[]).map((c) => (
            <button
              key={c}
              onClick={() => { audio.playClick(); setCategory(c); }}
              className={`px-4 py-2 text-xs uppercase font-black tracking-widest transition-all cursor-pointer ${
                category === c ? "bg-zinc-900 text-neon-cyan border-b-2 border-neon-cyan" : "text-zinc-500 hover:text-white"
              }`}
            >
              {c === "time" ? "Survival Time" : "Enemies Killed"}
            </button>
          ))}
        </div>

        {/* Difficulty */}
        <select
          value={difficulty}
          onChange={(e) => { audio.playClick(); setDifficulty(e.target.value); }}
          className="bg-[#0a0a0a] border border-[#333] text-white text-xs px-3 py-2 font-mono uppercase cursor-pointer"
        >
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Big Mode toggle */}
        <button
          onClick={() => { audio.playClick(); setLbBigMode((p) => !p); }}
          className={`px-4 py-2 text-xs uppercase font-black tracking-widest border transition-all cursor-pointer ${
            lbBigMode ? "border-neon-cyan text-neon-cyan bg-neon-cyan/10" : "border-[#333] text-zinc-500 hover:text-white"
          }`}
        >
          {lbBigMode ? "Big Mode: ON" : "Big Mode: OFF"}
        </button>
      </div>

      {/* Submit bar */}
      <div className="flex items-center justify-between border border-[#222] bg-[#0a0a0a] px-4 py-3 gap-4">
        <div className="text-xs text-zinc-400">
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
          className={`px-5 py-2 text-xs font-black uppercase tracking-widest border transition-all cursor-pointer ${
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
        <div className="text-xs text-neon-red border border-neon-red/30 bg-rose-950/20 px-3 py-2">{error}</div>
      )}

      {/* Pagination top */}
      <PaginationBar
        page={page}
        totalPages={totalPages}
        onGoTo={goToPage}
        editingPage={editingPage}
        setEditingPage={setEditingPage}
        pageInput={pageInput}
        setPageInput={setPageInput}
      />

      {/* Table */}
      <div className="border border-[#222] overflow-hidden">
        <div className="grid grid-cols-[2.5rem_1fr_auto_auto] text-[9px] text-zinc-500 uppercase tracking-widest font-black bg-[#0a0a0a] border-b border-[#222] px-4 py-2">
          <span>#</span>
          <span>Name</span>
          <span className="pr-8">Score</span>
          <span>Mode</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-600 text-xs font-mono">
            LOADING...
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-zinc-600 text-xs font-mono">
            NO ENTRIES YET — BE THE FIRST
          </div>
        ) : (
          entries.map((entry, i) => {
            const rank = page * PAGE_SIZE + i + 1;
            const isMe = entry.deviceId === deviceId;
            return (
              <div
                key={entry.id || i}
                className={`grid grid-cols-[2.5rem_1fr_auto_auto] items-center px-4 py-2.5 border-b border-[#111] text-xs font-mono transition-colors ${
                  isMe ? "bg-white/5" : "hover:bg-[#0a0a0a]"
                }`}
              >
                <span className="text-zinc-500 font-black text-[10px]">{rank}</span>
                <span
                  className="font-black truncate max-w-[200px]"
                  style={{ color: entry.color || "#ffffff" }}
                >
                  {entry.name}
                  {isMe && <span className="ml-2 text-[8px] text-zinc-500 font-normal">(you)</span>}
                </span>
                <span className="text-white font-black pr-8">{formatScore(entry)}</span>
                <span className={`text-[9px] font-bold uppercase tracking-wider ${entry.bigMode ? "text-neon-cyan" : "text-zinc-600"}`}>
                  {entry.bigMode ? "BIG" : "STD"}
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
        editingPage={editingPage}
        setEditingPage={setEditingPage}
        pageInput={pageInput}
        setPageInput={setPageInput}
      />

      <div className="text-[9px] text-zinc-600 font-mono">
        {total} total entries · Page {page + 1} of {totalPages}
      </div>
    </div>
  );
};

interface PaginationBarProps {
  page: number;
  totalPages: number;
  onGoTo: (p: number) => void;
  editingPage: boolean;
  setEditingPage: (v: boolean) => void;
  pageInput: string;
  setPageInput: (v: string) => void;
}

const PaginationBar: React.FC<PaginationBarProps> = ({
  page, totalPages, onGoTo, editingPage, setEditingPage, pageInput, setPageInput
}) => {
  const btnClass = "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border border-[#333] text-zinc-400 hover:text-white hover:border-zinc-500 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-default";

  return (
    <div className="flex items-center gap-2">
      <button className={btnClass} onClick={() => onGoTo(0)} disabled={page === 0}>FIRST</button>
      <button className={btnClass} onClick={() => onGoTo(page - 1)} disabled={page === 0}>PREV</button>

      {editingPage ? (
        <input
          autoFocus
          type="number"
          value={pageInput}
          onChange={(e) => setPageInput(e.target.value)}
          onBlur={() => {
            const n = parseInt(pageInput, 10);
            if (!isNaN(n)) onGoTo(n - 1);
            setEditingPage(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const n = parseInt(pageInput, 10);
              if (!isNaN(n)) onGoTo(n - 1);
              setEditingPage(false);
            }
            if (e.key === "Escape") setEditingPage(false);
          }}
          className="w-14 text-center bg-[#0a0a0a] border border-neon-cyan text-white text-xs font-mono px-2 py-1"
        />
      ) : (
        <button
          className="px-3 py-1.5 text-[10px] font-black border border-neon-cyan/30 text-neon-cyan bg-neon-cyan/5 cursor-pointer hover:bg-neon-cyan/10 transition-all"
          onClick={() => { setPageInput(String(page + 1)); setEditingPage(true); }}
          title="Click to jump to page"
        >
          {page + 1}
        </button>
      )}

      <button className={btnClass} onClick={() => onGoTo(page + 1)} disabled={page >= totalPages - 1}>NEXT</button>
      <button className={btnClass} onClick={() => onGoTo(totalPages - 1)} disabled={page >= totalPages - 1}>LAST</button>
    </div>
  );
};
