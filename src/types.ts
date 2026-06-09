/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum Difficulty {
  Blissful = "Blissful",
  Pissful = "Pissful",
  Ez = "Ez",
  Medium = "Medium",
  Hard = "Hard",
  HardR = "Hard R",
  Impossible = "Impossible",
  Hell = "Hell",
  Dot0 = "Dot-0"
}

export interface DotConfig {
  id: string;
  name: string;
  cost: number;
  color: string; // hex or tailwind class style
  borderColor: string;
  description: string;
  specialAbility: string;
}

export const DOTS_DATABASE: DotConfig[] = [
  {
    id: "drop",
    name: "Drop",
    cost: 0,
    color: "#22d3ee", // Cyan-400
    borderColor: "#e2e8f0",
    description: "The classic dot. Simple, clean, agile, and has zero supplementary overhead.",
    specialAbility: "No special effects. Basic line-clearing teleportation."
  },
  {
    id: "null",
    name: "Null",
    cost: 25,
    color: "#18181b", // Matte Black (Zinc-900)
    borderColor: "#f43f5e", // Rose neon border for visibility
    description: "Sacrifices linear projection for a singular concentrated blast.",
    specialAbility: "Line-clearing damage is replaced by a massive medium-range circular explosion at the destination point."
  },
  {
    id: "echo",
    name: "Echo",
    cost: 30,
    color: "#14b8a6", // Teal-500 (Faded Teal)
    borderColor: "#99f6e4",
    description: "Leaves a residual holographic copy that attracts nearby enemies.",
    specialAbility: "Leaves a copy at your previous position that draws nearby enemy attention for 2 real seconds before dissolving."
  },
  {
    id: "jolt",
    name: "Jolt",
    cost: 40,
    color: "#facc15", // Yellow-400 (Electric Yellow)
    borderColor: "#fef08a",
    description: "Emits a localized kinetic blast that repels anything nearby.",
    specialAbility: "Upon arrival, pushes nearby enemies away. Still keeps normal line-kill capabilities on the path."
  },
  {
    id: "wraith",
    name: "Wraith",
    cost: 60,
    color: "#a855f7", // Purple-500 (Dark Purple)
    borderColor: "#f3e8ff",
    description: "Moves with complete visual stealth, discharging an instantaneous spatial fracture.",
    specialAbility: "The teleportation preview line is invisible (must blind-aim). Teleport triggers an immediate, larger, instantaneous explosion that kills nearby enemies."
  },
  {
    id: "prism",
    name: "Prism",
    cost: 75,
    color: "#38bdf8", // Sky-400 / Rainbow Shift effect
    borderColor: "#cbd5e1",
    description: "Refracts energy into small defensive kinetic waves.",
    specialAbility: "Fires a wave from your destination that destroys incoming projectiles (does not kill enemies)."
  },
  {
    id: "katsune",
    name: "Kätsune",
    cost: 100,
    color: "#f43f5e", // Rose-500 (Light Magenta)
    borderColor: "#ffe4e6",
    description: "Unleashes elegant twin kinetic slash waves upon teleportation.",
    specialAbility: "On teleport, shoots 2 directed waves from your departure point that travel outward, killing enemies in their path."
  },
  {
    id: "ploum",
    name: "Ploum",
    cost: 120,
    color: "#fb7185", // Rose-400 (Coral pink)
    borderColor: "#fff1f2",
    description: "Generates heavy backdraft combustion behind its teleportation path.",
    specialAbility: "Leaves a thermal explosion at your departure location that kills any enemies caught in its fire."
  },
  {
    id: "vex",
    name: "Vex",
    cost: 150,
    color: "#dc2626", // Red-600 (Deep Red)
    borderColor: "#fee2e2",
    description: "Sears the floor at its destination, punishing oncoming pursuers.",
    specialAbility: "Leaves a lingering, highly volatile damage zone at the destination point for a short duration."
  },
  {
    id: "glint",
    name: "Glint",
    cost: 300,
    color: "#f8fafc", // Slate-50 (Pale Silver/White)
    borderColor: "#94a3b8",
    description: "A high-critical capability dot.",
    specialAbility: "On teleport, holds a 5% critical chance to trigger a massive screen-clearing explosion, slow all enemies down for 3 seconds, and grant a 0.5-second invincible shield."
  }
];

export interface PlayerStats {
  unlockedDots: string[]; // List of dot IDs
  selectedDot: string;
  totalPloints: number;
  highScores: Record<Difficulty, number>; // Difficulty -> survived time (seconds)
}

export interface Enemy {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: "basic" | "shooter" | "fast" | "tank" | "swarmer" | "bullet_hell" | "target_shooter";
  color: string;
  shootCooldown: number;
  maxShootCooldown: number;
  hp: number;
  scoreValue: number;
  speedMultiplier: number;
  knockbackTimer?: number;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  damage: number;
}

export type LaserType = "line" | "wave";

export interface Laser {
  id: string;
  type: LaserType;
  color: string;
  // For Line lasers
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  // For Wave lasers
  x?: number;
  y?: number;
  radius?: number;
  maxRadius?: number;
  // Common
  warningTime: number; // in milliseconds/frames
  maxWarningTime: number;
  activeTime: number; // count down when firing
  maxActiveTime: number;
  isActive: boolean;
  angleSpeed?: number;
  lastDamageTime?: number; // ms timestamp of last player hit, for cooldown
}

export interface ShieldPowerUp {
  x: number;
  y: number;
  radius: number;
  pulsePhase: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  decay: number;
  radius: number;
  shape?: "circle" | "square" | "ring" | "line";
  length?: number;
  angle?: number;
}

export interface DamageZone {
  id: string;
  x: number;
  y: number;
  radius: number;
  duration: number; // in frames or ms
  maxDuration: number;
  color: string;
}

export interface EchoGhost {
  x: number;
  y: number;
  radius: number;
  duration: number;
  maxDuration: number;
  color: string;
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  color: string;
  killsEnemies: boolean;
  killsProjectiles: boolean;
  vx?: number;
  vy?: number;
}

export const NEO_DROP_ID = "neo_drop";

// Extend PlayerStats to include kills tracking
export interface ExtendedPlayerStats extends PlayerStats {
  totalKills: Partial<Record<string, number>>;
  leaderboardName: string | null;
  leaderboardColor: string;
  neoDropUnlocked: boolean;
}