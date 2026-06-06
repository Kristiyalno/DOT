import React, { useEffect, useState } from "react";
import { audio } from "../utils/audio";

interface Contributor {
  name: string;
  role: string;
  link?: string;
  imageFile: string;
}

const CONTRIBUTORS: Contributor[] = [
  {
    name: "Kristiyalno",
    role: "Main game developer and designer.",
    link: "https://github.com/Kristiyalno",
    imageFile: "kristiyalno.gif",
  },
  {
    name: "Dedeniz",
    role: "The person Kristiyalno stole the game idea from.",
    link: "https://github.com/dedenizz",
    imageFile: "spamton_neo.gif",
  },
  {
    name: "Claude (kadn)",
    role: "The useful AI.",
    link: "https://claude.ai",
    imageFile: "claude.gif",
  },
  {
    name: "Gemi",
    role: "The useless AI.",
    link: "https://gemini.google.com",
    imageFile: "gemi.gif",
  },
  {
    name: "Google AI Studio",
    role: "Professional time waster and the retard AI.",
    link: "https://aistudio.google.com",
    imageFile: "aistudio.png",
  },
];

// These files are MP4s renamed to .gif — must use <video> tag


interface ContributorsProps {
  onClose: () => void;
}

export const Contributors: React.FC<ContributorsProps> = ({ onClose }) => {
  const [page, setPage] = useState(0);
  const contributor = CONTRIBUTORS[page];
  const isVideo = false;
  const mediaSrc = `${import.meta.env.BASE_URL}contributors/${contributor.imageFile}`;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { audio.playClick(); onClose(); return; }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setPage((p) => Math.max(0, p - 1));
        audio.playClick();
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setPage((p) => Math.min(CONTRIBUTORS.length - 1, p + 1));
        audio.playClick();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      aria-modal="true"
    >
      <div
        className="flex flex-col bg-[#050505] border border-[#333]"
        style={{ width: "80%", maxWidth: "1100px", height: "85vh", maxHeight: "700px" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#222] shrink-0">
          <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-black">
            CONTRIBUTORS — {page + 1}/{CONTRIBUTORS.length}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[9px] text-zinc-600 uppercase tracking-widest">← → to navigate</span>
            <button
              onClick={() => { audio.playClick(); onClose(); }}
              className="text-zinc-500 hover:text-white text-sm cursor-pointer px-2 py-1 border border-transparent hover:border-[#333] transition-all"
            >
              ✕ [ESC]
            </button>
          </div>
        </div>

        {/* Main content — left media, right info */}
        <div className="flex flex-row flex-1 overflow-hidden min-h-0">
          {/* Media frame */}
          <div
            className="relative bg-[#0a0a0a] flex items-center justify-center overflow-hidden shrink-0"
            style={{ width: "50%" }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "linear-gradient(135deg, rgba(34,211,238,0.04) 0%, rgba(168,85,247,0.04) 100%)",
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none opacity-10"
              style={{
                backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)",
              }}
            />

            {isVideo ? (
              <video
                key={mediaSrc}
                src={mediaSrc}
                autoPlay
                loop
                muted
                playsInline
                className="relative z-10"
                style={{
                  maxWidth: "90%",
                  maxHeight: "90%",
                  objectFit: "contain",
                  
                }}
              />
            ) : (
              <img
                key={mediaSrc}
                src={mediaSrc}
                alt={contributor.name}
                className="relative z-10"
                style={{
                  maxWidth: "90%",
                  maxHeight: "90%",
                  objectFit: "contain",
                  
                  borderRadius: contributor.imageFile === "kristiyalno.gif" ? "10px" : undefined,
                }}
              />
            )}

            <div className="absolute top-0 left-0 w-4 h-4 border-l-2 border-t-2 border-neon-cyan/40 pointer-events-none" />
            <div className="absolute top-0 right-0 w-4 h-4 border-r-2 border-t-2 border-neon-cyan/40 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-l-2 border-b-2 border-neon-cyan/40 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-r-2 border-b-2 border-neon-cyan/40 pointer-events-none" />
          </div>

          {/* Info panel */}
          <div className="flex flex-col justify-center px-10 py-8 gap-4 flex-1 border-l border-[#1a1a1a]">
            <div className="flex flex-col gap-2">
              <div className="text-[9px] text-zinc-600 uppercase tracking-widest font-black">
                {String(page + 1).padStart(2, "0")} / {String(CONTRIBUTORS.length).padStart(2, "0")}
              </div>
              <div className="font-black text-white text-2xl tracking-widest">{contributor.name}</div>
              <div className="text-sm text-zinc-400 leading-relaxed">{contributor.role}</div>
              {contributor.link && (
                <a
                  href={contributor.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-neon-cyan hover:underline font-mono mt-1 break-all"
                >
                  {contributor.link}
                </a>
              )}
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { audio.playClick(); setPage((p) => Math.max(0, p - 1)); }}
                disabled={page === 0}
                className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-zinc-900 border border-[#222] hover:border-[#444] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-default"
              >
                ← PREV
              </button>
              <button
                onClick={() => { audio.playClick(); setPage((p) => Math.min(CONTRIBUTORS.length - 1, p + 1)); }}
                disabled={page === CONTRIBUTORS.length - 1}
                className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white hover:bg-zinc-900 border border-[#222] hover:border-[#444] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-default"
              >
                NEXT →
              </button>
            </div>

            <div className="flex gap-2 justify-center">
              {CONTRIBUTORS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { audio.playClick(); setPage(i); }}
                  className={`w-2 h-2 transition-all cursor-pointer ${i === page ? "bg-neon-cyan" : "bg-zinc-700 hover:bg-zinc-500"}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
