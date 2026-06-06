import React, { useState, useEffect } from "react";
import { DotConfig, DOTS_DATABASE } from "../types";
import { audio } from "../utils/audio";
import { Sparkles, Coins, ShoppingBag, ShieldCheck, HelpCircle } from "lucide-react";

interface ShopMenuProps {
  unlockedDots: string[];
  totalPloints: number;
  onUnlockDot: (dotId: string, cost: number) => void;
  onExit: () => void;
  onOpenLeaderboard: () => void;
  onOpenSettings: () => void;
}

export const ShopMenu: React.FC<ShopMenuProps> = ({
  unlockedDots,
  totalPloints,
  onUnlockDot,
  onExit,
  onOpenLeaderboard,
  onOpenSettings,
}) => {
  const [selectedShopDot, setSelectedShopDot] = useState<DotConfig | null>(null);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        e.preventDefault();
        audio.playClick();
        if (showConfirm) { setShowConfirm(false); return; }
        onExit();
      }

      // Arrow key navigation: shop sits between main menu and leaderboard
      // Left → main menu, Right → leaderboard
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        audio.playClick();
        onExit();
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        audio.playClick();
        onOpenLeaderboard();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onExit, onOpenLeaderboard, showConfirm]);

  const handleDotSelect = (dot: DotConfig) => {
    audio.playClick();
    setSelectedShopDot(dot);
    setShowConfirm(false);
  };

  const handleBuyAttempt = () => {
    if (!selectedShopDot) return;
    audio.playClick();
    setShowConfirm(true);
  };

  const handleConfirmPurchase = () => {
    if (!selectedShopDot) return;
    if (totalPloints >= selectedShopDot.cost) {
      onUnlockDot(selectedShopDot.id, selectedShopDot.cost);
      audio.playShieldOption(true); // beautiful high chime
      setShowConfirm(false);
    } else {
      audio.playShieldOption(false); // bad buzz
    }
  };

  return (
    <div id="shop-menu-root" className="min-h-screen bg-brutal-grid font-mono text-ink flex flex-col justify-between p-6 md:p-8 border-4 border-[#222] select-none">
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-[#333]">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-neon-magenta tracking-widest uppercase" style={{ textShadow: '0 0 10px rgba(255, 0, 255, 0.4)' }}>
            DOT UPGRADES
          </h1>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">
            Exchange Ploints to unlock advanced dots.
          </p>
        </div>
        
        {/* Ploints tally */}
        <div className="flex items-center gap-3 bg-[#0a0a0a] border border-[#333] rounded-none px-5 py-2.5">
          <Coins className="w-5 h-5 text-neon-yellow animate-pulse" />
          <div className="text-right">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider leading-none">PLOINT BALANCE</div>
            <div id="shop-ploints-total" className="text-xl font-black text-white">{totalPloints.toLocaleString()} <span className="text-xs text-zinc-400">P</span></div>
          </div>
        </div>
      </div>

      {/* Sub-Header Navigation Tabs to split the app into 2 clearly defined menus */}
      <div className="flex border border-[#222] bg-[#050505] p-1 gap-1 select-none my-4">
        <button
          onClick={() => {
            audio.playClick();
            onExit();
          }}
          className="px-6 py-2.5 text-xs uppercase font-black tracking-widest border border-transparent text-zinc-500 hover:text-white hover:bg-zinc-900 hover:border-[#333] transition-all cursor-pointer"
        >
          MAIN MENU
        </button>
        <button
          className="px-6 py-2.5 text-xs uppercase font-black tracking-widest border border-neon-magenta/40 bg-zinc-950 text-neon-magenta"
          disabled
        >
          DOT SHOP
        </button>
        <button
          onClick={() => { audio.playClick(); onOpenLeaderboard(); }}
          className="px-6 py-2.5 text-xs uppercase font-black tracking-widest border border-transparent text-zinc-500 hover:text-white hover:bg-zinc-900 hover:border-[#333] transition-all cursor-pointer"
        >
          LEADERBOARD
        </button>
        <button
          onClick={() => { audio.playClick(); onOpenSettings(); }}
          className="px-6 py-2.5 text-xs uppercase font-black tracking-widest border border-transparent text-zinc-500 hover:text-white hover:bg-zinc-900 hover:border-[#333] transition-all cursor-pointer"
        >
          SETTINGS
        </button>
      </div>

      {/* Main Core Body Segment */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-8 flex-grow">
        {/* Left column: List of available upgrade dots */}
        <div className="lg:col-span-7 flex flex-col gap-4 max-h-[55vh] overflow-y-auto pr-2 no-scrollbar">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
            Available Dots Database
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DOTS_DATABASE.map((dot) => {
              const isUnlocked = unlockedDots.includes(dot.id);
              const isSelected = selectedShopDot?.id === dot.id;
              const isAffordable = totalPloints >= dot.cost;

              return (
                <button
                  key={dot.id}
                  id={`shop-item-${dot.id}`}
                  onClick={() => handleDotSelect(dot)}
                  className={`relative p-4 rounded-none border transition-all flex flex-col justify-between gap-3 overflow-hidden ${
                    isSelected
                      ? "border-neon-magenta bg-neon-magenta/10 shadow-[0_0_15px_rgba(255,0,255,0.15)]"
                      : "border-[#222] bg-[#0c0c0c] hover:border-[#444] hover:bg-[#111]"
                  }`}
                >
                  {/* Left indicator accent color */}
                  <div
                    className="absolute left-0 inset-y-0 w-1.5"
                    style={{ backgroundColor: dot.color }}
                  ></div>

                  <div className="flex justify-between items-start pl-2">
                    <div>
                      <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                        {dot.name}
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-none ring-1 ring-[#333]"
                          style={{
                            backgroundColor: dot.color,
                            boxShadow: `0 0 6px ${dot.color}`
                          }}
                        ></span>
                      </h3>
                      <div className="text-[10px] text-zinc-500 font-bold overflow-hidden text-ellipsis whitespace-nowrap max-w-[150px]">
                        {dot.id === "drop" ? "CLASSIC DOT" : `SYSTEM ID: ${dot.id.toUpperCase()}`}
                      </div>
                    </div>

                    {isUnlocked ? (
                      <span className="text-[10px] bg-emerald-950/40 border border-emerald-500 text-emerald-400 px-2 py-0.5 rounded-none tracking-wider uppercase font-bold">
                        Decrypted
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] border px-2 py-0.5 rounded-none tracking-wider uppercase font-black flex items-center gap-1 ${
                          isAffordable
                            ? "bg-yellow-950/40 border-yellow-500 text-yellow-400"
                            : "bg-zinc-900 border-[#222] text-zinc-500"
                        }`}
                      >
                        {dot.cost} P
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-zinc-400 pl-2 leading-relaxed line-clamp-2">
                    {dot.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right column: Target details/panel preview */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-[#0a0a0a] border border-[#222] rounded-none p-6">
          {selectedShopDot ? (
            <div className="flex flex-col h-full justify-between gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-zinc-500 uppercase tracking-widest">Quantum Diagnostics</div>
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping"></span>
                    <span className="w-1.5 h-1.5 bg-zinc-700 rounded-full"></span>
                    <span className="w-1.5 h-1.5 bg-zinc-700 rounded-full"></span>
                  </div>
                </div>

                <div className="flex items-center gap-4 py-2 border-b border-zinc-850">
                  <div
                    className="w-16 h-16 rounded-none border-2 flex items-center justify-center relative group overflow-hidden bg-[#050505]"
                    style={{ borderColor: selectedShopDot.borderColor, boxShadow: `0 0 10px ${selectedShopDot.color}40` }}
                  >
                    <div
                      className="w-5 h-5 rounded-none"
                      style={{
                        backgroundColor: selectedShopDot.color,
                        boxShadow: `0 0 15px ${selectedShopDot.color}`,
                        borderColor: selectedShopDot.borderColor
                      }}
                    ></div>
                  </div>

                  <div>
                    <h2 className="text-2xl font-black text-white tracking-widest">
                      {selectedShopDot.name.toUpperCase()}
                    </h2>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                      Specialized Class Upgrade
                    </p>
                  </div>

                </div>

                {/* Description info */}
                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 font-bold">Functional Outline</div>
                    <p className="text-xs text-zinc-300 leading-relaxed font-mono">
                      {selectedShopDot.description}
                    </p>
                  </div>

                  <div className="bg-[#050505] border border-[#222] p-3.5 rounded-none shadow-[inset_0_0_10px_rgba(255,10,255,0.05)]">
                    <p className="text-xs text-zinc-400 leading-relaxed font-mono">
                      {selectedShopDot.specialAbility}
                    </p>
                  </div>
                </div>
              </div>

              {/* Purchase interface */}
              <div className="border-t border-[#222] pt-5 mt-auto">
                {unlockedDots.includes(selectedShopDot.id) ? (
                  <div className="bg-emerald-950/20 border border-emerald-500/60 p-4 rounded-none text-center">
                    <ShieldCheck className="w-6 h-6 text-neon-green mx-auto mb-1.5" />
                    <p className="text-xs text-neon-green font-black uppercase tracking-widest">
                      DOT UNLOCKED & FULLY OPERATIONAL
                    </p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-1">
                      Equip this dot on the main menu.
                    </p>
                  </div>
                ) : !showConfirm ? (
                  <button
                    onClick={handleBuyAttempt}
                    disabled={totalPloints < selectedShopDot.cost}
                    className={`w-full py-3.5 rounded-none font-black text-sm uppercase tracking-widest transition-all ${
                      totalPloints >= selectedShopDot.cost
                        ? "bg-neon-yellow text-[#000] hover:bg-white hover:text-[#000] cursor-pointer glow-yellow"
                        : "bg-[#111] border border-[#222] text-zinc-600 cursor-not-allowed"
                     }`}
                  >
                    {totalPloints >= selectedShopDot.cost
                      ? `UNLOCK DOT (${selectedShopDot.cost} P)`
                      : `PLOINTS INSUFFICIENT (${selectedShopDot.cost} P REQUIRED)`}
                  </button>
                ) : (
                  <div className="bg-[#050505] border-2 border-neon-magenta/50 p-4 rounded-none space-y-3.5 glow-magenta">
                    <div className="text-xs font-black text-neon-magenta uppercase tracking-widest text-center">
                      Confirm Purchase?
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-tight text-center uppercase tracking-wide">
                      This will deduct <span className="text-neon-yellow font-bold">{selectedShopDot.cost}</span> Ploints from your balance.
                    </p>
                    <div className="flex gap-2.5">
                      <button
                        onClick={() => {
                          audio.playClick();
                          setShowConfirm(false);
                        }}
                        className="flex-1 bg-[#111] border border-[#333] hover:border-white py-2 text-xs font-bold uppercase rounded-none text-zinc-300 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmPurchase}
                        className="flex-1 bg-neon-magenta text-black hover:bg-white hover:text-black py-2 text-xs font-black uppercase rounded-none transition-all cursor-pointer"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col justify-center items-center text-center p-8 text-zinc-500">
              <HelpCircle className="w-12 h-12 text-[#222] mb-3 animate-pulse" />
              <p className="text-xs uppercase tracking-widest font-black text-zinc-400">Diagnostics Standby</p>
              <p className="text-[10px] leading-tight text-zinc-650 max-w-[200px] mt-1.5 font-mono">
                Select an upgrade profile on the left to review telemetry stats, core metrics, and active abilities.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Retro Bottom Navigation Row */}
      <div className="flex justify-end gap-4 border-t border-[#333] pt-6">
        <button
          onClick={() => {
            audio.playClick();
            onExit();
          }}
          className="bg-[#0a0a0a] hover:bg-[#111] hover:border-white border border-[#333] px-8 py-3 text-xs uppercase tracking-widest font-black transition-all cursor-pointer rounded-none"
        >
          [ESC] Return to Main Menu
        </button>
      </div>
    </div>
  );
};
