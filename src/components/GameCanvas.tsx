/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Difficulty,
  DotConfig,
  Enemy,
  Projectile,
  Laser,
  ShieldPowerUp,
  Particle,
  DamageZone,
  EchoGhost,
  Shockwave,
  DOTS_DATABASE,
  NEO_DROP_ID
} from "../types";
import { audio } from "../utils/audio";

interface GameCanvasProps {
  difficulty: Difficulty;
  selectedDot: DotConfig;
  onGameOver: (seconds: number, ploints: number, kills: number) => void;
  onExit: () => void;
  addPloints?: (amount: number) => void;
  bigMode?: boolean;
  invincible?: boolean;
  customDifficulty?: any;
  isFullscreen?: boolean;
  killFlashEnabled?: boolean;
  killFlashIntensity?: number;
  screenShakeEnabled?: boolean;
  screenShakeIntensity?: number;
  comboPitchEnabled?: boolean;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  difficulty,
  selectedDot,
  onGameOver,
  onExit,
  addPloints,
  bigMode = false,
  invincible = false,
  customDifficulty = null,
  isFullscreen: isFullscreenProp = false,
  killFlashEnabled = false,
  killFlashIntensity = 1.0,
  screenShakeEnabled = false,
  screenShakeIntensity = 1.0,
  comboPitchEnabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animRef = useRef<number | null>(null);

  // States for player feedback
  const [hudSlo, setHudSlo] = useState<number>(0);
  const [hudShields, setHudShields] = useState<number>(0);
  const [hudPlointsGained, setHudPlointsGained] = useState<number>(0);
  const [hudTime, setHudTime] = useState<number>(0);

  // Fullscreen mode — controlled by App via prop (toggle is in Settings, not mid-game)
  const isFullscreen = isFullscreenProp;
  const [isHyperSlo, setIsHyperSlo] = useState<boolean>(false);
  const [hudFreezeReady, setHudFreezeReady] = useState<boolean>(false);

  // Gameplay state references for the requestAnimationFrame loop to prevent stale React closures
  // Big mode scale factor — applied to all radii and sizes
  const BIG = bigMode ? 2.2 : 1.0;

  const killCountRef = useRef(0);
  const comboPitchEnabledRef = useRef(comboPitchEnabled);
  const killFlashEnabledRef = useRef(killFlashEnabled);
  const killFlashIntensityRef = useRef(killFlashIntensity);
  const screenShakeEnabledRef = useRef(screenShakeEnabled);
  const screenShakeIntensityRef = useRef(screenShakeIntensity);
  useEffect(() => { comboPitchEnabledRef.current = comboPitchEnabled; }, [comboPitchEnabled]);
  useEffect(() => { killFlashEnabledRef.current = killFlashEnabled; }, [killFlashEnabled]);
  useEffect(() => { killFlashIntensityRef.current = killFlashIntensity; }, [killFlashIntensity]);
  useEffect(() => { screenShakeEnabledRef.current = screenShakeEnabled; }, [screenShakeEnabled]);
  useEffect(() => { screenShakeIntensityRef.current = screenShakeIntensity; }, [screenShakeIntensity]);

  const stateRef = useRef({
    player: {
      x: 300,
      y: 300,
      radius: Math.round(8 * BIG),
      shields: customDifficulty != null ? (customDifficulty.shields ?? 0) : (difficulty === Difficulty.Blissful ? 3 : difficulty === Difficulty.Pissful ? 2 : difficulty === Difficulty.Ez ? 1 : difficulty === Difficulty.Medium ? 1 : 0),
      slo: 0,
      isInvincible: false,
      invincibilityTimer: 0, // frames
    },
    mouse: { x: 300, y: 300 },
    enemies: [] as Enemy[],
    projectiles: [] as Projectile[],
    lasers: [] as Laser[],
    shieldPowerUps: [] as ShieldPowerUp[],
    particles: [] as Particle[],
    damageZones: [] as DamageZone[],
    echoGhosts: [] as EchoGhost[],
    shockwaves: [] as Shockwave[],
    
    // Timers
    timeElapsedReal: 0, // real unscaled milliseconds
    timeElapsedGame: 0, // game scaled milliseconds
    glintFlashAlpha: 0,
    glintSlowTimer: 0,
    lastTime: 0,
    startTimeReal: 0,
    lastPlointAwardTime: 0, // game-scaled milliseconds timestamp
    plointsGained: 0,
    
    // Sizing
    width: 600,
    height: 600,
    
    // Spawners and pacing
    enemySpawnProgress: 0,
    laserSpawnProgress: 0,
    shieldSpawnProgress: 0,
    timeScale: 1.0, // target slow-mo scale
    currentTimeScale: 1.0, // lerping current scale
    gameSpeedFactor: 1.0, // speeds up over time
    
    gameOverTriggered: false,
    hasMoved: false,
    teleportLine: null as null | { x1: number; y1: number; x2: number; y2: number; alpha: number; color: string },
    microDrops: [] as Array<{ id: string; x: number; y: number; vx: number; vy: number; radius: number; alpha: number; life: number }>,
    neoFreezeFlashAlpha: 0,
    neoFreezeUntil: 0,
    killFlashAlpha: 0,
    shakeTimer: 0,
    shakeIsTank: false,
    comboCount: 0,
    comboResetTimer: 0,
    glintCritCooldown: 0,
    prismCritCooldown: 0,
    ploumResidues: [] as Array<{ x: number; y: number; duration: number; maxDuration: number; radius: number }>,
    ploumPulls: [] as Array<{ x: number; y: number; endTime: number; radius: number }>,
  });

  // Calculate Ploint yield interval
  // "in hard it would give you a Ploint every 20 seconds and in Hell it would give you one every 3 secs"
  const getPlointIntervalSeconds = (d: Difficulty): number => {
    switch (d) {
      case Difficulty.Blissful: return 5.0;
      case Difficulty.Pissful: return 4.0;
      case Difficulty.Ez: return 3.0;
      case Difficulty.Medium: return 2.5;
      case Difficulty.Hard: return 1.8;
      case Difficulty.HardR: return 1.2;
      case Difficulty.Impossible: return 0.8;
      case Difficulty.Hell: return 0.5;
      case Difficulty.Dot0: return 0.25;
      default: return 3.0;
    }
  };

  const plointInterval = (customDifficulty != null
    ? (customDifficulty.secondsPerPloint ?? getPlointIntervalSeconds(difficulty))
    : getPlointIntervalSeconds(difficulty)) * 1000; // in ms

  useEffect(() => {
    // Laser and audio initialization
    audio.startMusic();
    stateRef.current.startTimeReal = Date.now();
    stateRef.current.lastPlointAwardTime = 0;
    stateRef.current.lastTime = performance.now();

    // Resize handler
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const w = Math.max(400, rect.width);
        const h = Math.max(400, rect.height);
        canvasRef.current.width = w;
        canvasRef.current.height = h;
        stateRef.current.width = w;
        stateRef.current.height = h;

        // Position player in center if newly initialized
        if (stateRef.current.timeElapsedReal === 0) {
          stateRef.current.player.x = w / 2;
          stateRef.current.player.y = h / 2;
        }
      }
    };

    handleResize();
    const observer = new ResizeObserver(() => handleResize());
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Key event listeners
    // ESC = quit game only (does NOT exit fullscreen)
    // Hold ESC for 2s = exit fullscreen
    let escHoldTimer: ReturnType<typeof setTimeout> | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        // Quit immediately
        triggerGameOver();
        // Start hold timer — exit fullscreen after 2s of holding
        if (escHoldTimer === null) {
          escHoldTimer = setTimeout(() => {
            if (document.fullscreenElement) {
              document.exitFullscreen?.().catch(() => {});
            }
            escHoldTimer = null;
          }, 2000);
        }
      }
      if (e.key === " ") {
        e.preventDefault();
        const s = stateRef.current;
        if (!s.hasMoved || s.gameOverTriggered) return;
        const isNeoDot = selectedDot.id === "neo_drop" || selectedDot.id === NEO_DROP_ID;
        if (!isNeoDot) return;
        if (s.player.slo < 100) return;
        s.player.slo = Math.max(0, s.player.slo - 100);
        s.neoFreezeFlashAlpha = 0.7;
        const freezeUntil = Date.now() + 2000;
        s.neoFreezeUntil = freezeUntil;
        s.enemies.forEach((enemy: any) => {
          enemy.frozenUntil = freezeUntil;
          enemy.vx = 0;
          enemy.vy = 0;
        });
        // Freeze projectiles in place
        s.projectiles.forEach((proj: any) => {
          proj._frozenVx = proj.vx;
          proj._frozenVy = proj.vy;
          proj.vx = 0;
          proj.vy = 0;
          proj._frozenUntil = freezeUntil;
        });
        // Pause laser timers
        s.lasers.forEach((laser: any) => {
          laser._frozenUntil = freezeUntil;
        });
        audio.playClick();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Escape" && escHoldTimer !== null) {
        clearTimeout(escHoldTimer);
        escHoldTimer = null;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // Initial game speed configuration based on difficulty
    let baseSpeed = 1.0;
    if (customDifficulty != null) {
      baseSpeed = customDifficulty.enemySpeedMult ?? 1.0;
    } else {
      switch (difficulty) {
        case Difficulty.Blissful: baseSpeed = 0.9; break;
        case Difficulty.Pissful: baseSpeed = 1.1; break;
        case Difficulty.Ez: baseSpeed = 1.3; break;
        case Difficulty.Medium: baseSpeed = 1.5; break;
        case Difficulty.Hard: baseSpeed = 1.8; break;
        case Difficulty.HardR: baseSpeed = 2.1; break;
        case Difficulty.Impossible: baseSpeed = 2.5; break;
        case Difficulty.Hell: baseSpeed = 3.0; break;
        case Difficulty.Dot0: baseSpeed = 4.0; break;
      }
    }
    stateRef.current.gameSpeedFactor = baseSpeed;

    // Start request animation frame
    animRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animRef.current !== null) {
        cancelAnimationFrame(animRef.current);
      }
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (escHoldTimer !== null) clearTimeout(escHoldTimer);
      observer.disconnect();
      audio.stopMusic();
    };
  }, [difficulty, selectedDot]);

  // When fullscreen mode toggles, the containerRef moves to a different DOM node.
  // Re-measure and reconnect the ResizeObserver to the new element.
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const w = Math.max(400, rect.width);
    const h = Math.max(400, rect.height);
    canvasRef.current.width = w;
    canvasRef.current.height = h;
    stateRef.current.width = w;
    stateRef.current.height = h;
  }, [isFullscreen]);

  // Main game logic loop
  const gameLoop = (timestamp: number) => {
    const s = stateRef.current;
    if (s.gameOverTriggered) return;

    let deltaReal = timestamp - s.lastTime;
    if (deltaReal > 100) deltaReal = 16.67; // prevent huge leaps when backgrounded
    s.lastTime = timestamp;

    const nowReal = Date.now();
    if (!s.hasMoved) {
      s.startTimeReal = nowReal;
      s.lastPlointAwardTime = 0;
      s.timeElapsedReal = 0;
      s.timeElapsedGame = 0;
    } else {
      s.timeElapsedReal = nowReal - s.startTimeReal;
    }

    // Real-time HUD updates
    setHudTime(s.timeElapsedGame / 1000);

    // Speed scaling over time (they get faster in all difficulties)
    // Roughly 5% speed increase every 10 seconds of survival
    const minutesSurvived = s.timeElapsedReal / 60000;
    const timeSpeedScale = 1.0 + minutesSurvived * 0.35;
    const activeSpeedFactor = s.gameSpeedFactor * timeSpeedScale;

    // Slo-mo decay logic
    // We recover speed to standard rate (1.0) gradually
    if (s.glintSlowTimer && s.glintSlowTimer > 0) {
      s.glintSlowTimer = Math.max(0, s.glintSlowTimer - deltaReal);
      s.timeScale = 0.08; // extremely dramatic matrix slow-mo!
    } else if (s.timeScale < 1.0) {
      s.timeScale = Math.min(1.0, s.timeScale + 0.015 * (deltaReal / 16.67));
    }

    // Glint screen flash decay logic
    if (s.glintFlashAlpha > 0) {
      s.glintFlashAlpha = Math.max(0, s.glintFlashAlpha - 0.02 * (deltaReal / 16.67));
    }
    if (s.killFlashAlpha > 0) {
      s.killFlashAlpha = Math.max(0, s.killFlashAlpha - 0.055 * (deltaReal / 16.67));
    }
    if (s.shakeTimer > 0) {
      s.shakeTimer = Math.max(0, s.shakeTimer - deltaReal);
    }
    if (s.comboResetTimer > 0) {
      s.comboResetTimer -= deltaReal;
      if (s.comboResetTimer <= 0) {
        s.comboCount = 0;
        s.comboResetTimer = 0;
      }
    }
    if (s.glintCritCooldown > 0) {
      s.glintCritCooldown = Math.max(0, s.glintCritCooldown - deltaReal);
    }
    if (s.prismCritCooldown > 0) {
      s.prismCritCooldown = Math.max(0, s.prismCritCooldown - deltaReal);
    }
    // Update ploum residues — decay in real time, kill enemies inside them each frame
    s.ploumResidues = s.ploumResidues.filter((r) => {
      r.duration -= deltaReal;
      if (r.duration > 0) {
        s.enemies.forEach((enemy: any) => {
          const dx = enemy.x - r.x;
          const dy = enemy.y - r.y;
          if (Math.sqrt(dx * dx + dy * dy) <= r.radius + enemy.radius && !enemy._markedForKill) {
            enemy._markedForKill = true;
          }
        });
        return true;
      }
      return false;
    });

    // Update ploum pulls — attract enemies toward departure point for pull duration


    // Neo Drop freeze flash decay
    if (s.neoFreezeFlashAlpha > 0) {
      s.neoFreezeFlashAlpha = Math.max(0, s.neoFreezeFlashAlpha - 0.015 * (deltaReal / 16.67));
    }
    setHudFreezeReady(s.player.slo >= 100);

    // Proximity Slo-mo calculation
    // Two tiers: dot-near (full hyper slo) and cursor-near (soft slo)
    let isDotNearDanger = false;
    let isCursorNearDanger = false;

    const nowMs = Date.now();
    s.enemies.forEach((enemy: any) => {
      if (enemy.frozenUntil && nowMs < enemy.frozenUntil) return;

      // Dot proximity — triggers full hyper slo
      const ddx = enemy.x - s.player.x;
      const ddy = enemy.y - s.player.y;
      if (Math.sqrt(ddx * ddx + ddy * ddy) < (enemy.radius + s.player.radius) / BIG + 40) {
        isDotNearDanger = true;
      }
      // Cursor proximity — triggers soft slo (wider radius)
      const cdx = enemy.x - s.mouse.x;
      const cdy = enemy.y - s.mouse.y;
      if (Math.sqrt(cdx * cdx + cdy * cdy) < (enemy.radius + s.player.radius) / BIG + 55) {
        isCursorNearDanger = true;
      }
    });

    s.projectiles.forEach((proj) => {
      const ddx = proj.x - s.player.x;
      const ddy = proj.y - s.player.y;
      if (Math.sqrt(ddx * ddx + ddy * ddy) < (proj.radius + s.player.radius) / BIG + 35) {
        isDotNearDanger = true;
      }
      const cdx = proj.x - s.mouse.x;
      const cdy = proj.y - s.mouse.y;
      if (Math.sqrt(cdx * cdx + cdy * cdy) < (proj.radius + s.player.radius) / BIG + 50) {
        isCursorNearDanger = true;
      }
    });

    // Check active line lasers against dot position
    s.lasers.forEach((laser) => {
      if (laser.isActive && laser.type === "line" && laser.activeTime > 0) {
        const distToLaser = distToSegment(
          s.player.x, s.player.y,
          laser.x1 || 0, laser.y1 || 0,
          laser.x2 || 0, laser.y2 || 0
        );
        if (distToLaser < s.player.radius + 20) isDotNearDanger = true;
      }
    });

    // Handle SLO resource consumption and application
    let nearSloScale = 1.0;
    if (isDotNearDanger && s.player.slo > 0) {
      // Full hyper slo — dot is in danger, 40 slo/sec scaled by current time scale
      // (spending slo while already slowed costs proportionally less)
      const sloSpent = 90 * (deltaReal / 1000) * s.currentTimeScale;
      s.player.slo = Math.max(0, s.player.slo - sloSpent);
      nearSloScale = 0.12;
      setIsHyperSlo(true);
    } else if (isCursorNearDanger && s.player.slo > 0) {
      // Soft slo — cursor near danger but dot is safe, 15 slo/sec scaled by current time scale
      const sloSpent = 15 * (deltaReal / 1000) * s.currentTimeScale;
      s.player.slo = Math.max(0, s.player.slo - sloSpent);
      nearSloScale = 0.45;
      setIsHyperSlo(false);
    } else {
      setIsHyperSlo(false);
    }

    // Combine manual slowing scale + proximity slowing scale
    const targetScale = Math.min(s.timeScale, nearSloScale);
    // Smoothly lerp towards target timeframe
    s.currentTimeScale += (targetScale - s.currentTimeScale) * 0.2;

    const dt = (deltaReal / 1000) * s.currentTimeScale * activeSpeedFactor;
    s.timeElapsedGame += (deltaReal * s.currentTimeScale);

    // Sync HUD status
    setHudSlo(Math.round(s.player.slo));
    setHudShields(s.player.shields);

    // Award Ploints based on game-scaled elapsed time (slowed seconds count less) after a 5s game-time cooldown
    if (s.timeElapsedGame >= 5000) {
      if (s.lastPlointAwardTime === 0) {
        s.lastPlointAwardTime = s.timeElapsedGame;
      }
      if (s.timeElapsedGame - s.lastPlointAwardTime >= plointInterval) {
        s.plointsGained += 1;
        s.lastPlointAwardTime += plointInterval;
        setHudPlointsGained(s.plointsGained);
        audio.playShieldOption(true); // lovely alert ping
      }
    }

    // Update invincibility timer
    if (s.player.isInvincible) {
      s.player.invincibilityTimer -= deltaReal;
      if (s.player.invincibilityTimer <= 0) {
        s.player.isInvincible = false;
      }
    }

    // 0b. UPDATE MICRO DROPS (Neo Drop ability)
    if (s.microDrops && s.microDrops.length > 0) {
      s.microDrops = s.microDrops.filter((drop) => {
        drop.x += drop.vx * (dt * 60);
        drop.y += drop.vy * (dt * 60);
        drop.vx *= 0.995; // very slow drag so they travel far
        drop.vy *= 0.995;
        drop.life -= deltaReal;
        drop.alpha = Math.max(0, drop.life / 2000);
        // Check collision with enemies
        s.enemies.forEach((enemy: any) => {
          const dx = enemy.x - drop.x;
          const dy = enemy.y - drop.y;
          if (Math.sqrt(dx*dx+dy*dy) < drop.radius + enemy.radius && !enemy._markedByDrop) {
            enemy._markedByDrop = true;
          }
        });
        return drop.life > 0;
      });

      // Execute queued micro drop kills (separate flag from shockwave kills)
      const dropKillIds = s.enemies.filter((e: any) => e._markedByDrop).map((e) => e.id);
      dropKillIds.forEach((id) => {
        const enemy = s.enemies.find((e) => e.id === id);
        if (enemy) {
          enemy._markedByDrop = false;
          triggerEnemyKillForce(enemy, "Neo Micro Drop");
        }
      });
    }

    // 0. DECAY TELEPORT LINE
    if (s.teleportLine) {
      s.teleportLine.alpha -= 0.08 * (deltaReal / 16.67);
      if (s.teleportLine.alpha <= 0) s.teleportLine = null;
    }

    // 1. UPDATE PARTICLES
    s.particles = s.particles.filter((p) => {
      p.x += p.vx * (deltaReal / 16.67) * s.currentTimeScale; // scale with game time
      p.y += p.vy * (deltaReal / 16.67) * s.currentTimeScale;
      p.alpha -= p.decay * (deltaReal / 16.67);
      return p.alpha > 0;
    });

    // 2. UPDATE DAMAGE ZONES (Vex ability)
    s.damageZones = s.damageZones.filter((dz) => {
      dz.duration -= deltaReal;
      const toKillInZone: string[] = [];
    s.enemies.forEach((enemy: any) => {
        const dx = enemy.x - dz.x;
        const dy = enemy.y - dz.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < dz.radius + enemy.radius) {
          toKillInZone.push(enemy.id);
        }
      });
      toKillInZone.forEach((id) => {
        const enemy = s.enemies.find((e) => e.id === id);
        if (enemy) triggerEnemyKillForce(enemy, "Vex Damage Zone");
      });
      return dz.duration > 0;
    });

    // 3. UPDATE ECHO GHOSTS (Echo ability)
    s.echoGhosts = s.echoGhosts.filter((eg: any) => {
      eg.duration -= deltaReal; // Decay in real-time non-slowed milliseconds
      if (eg.duration <= 0) return false;

      // Taunt: pull targeting enemies (shooter, target_shooter, bullet_hell) toward ghost
      s.enemies.forEach((enemy: any) => {
        const isTargeting = enemy.type === "shooter" || enemy.type === "target_shooter" || enemy.type === "bullet_hell";
        if (!isTargeting) return;
        const dx = eg.x - enemy.x;
        const dy = eg.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) return;
        const pull = Math.min(1.2, 300 / dist); // stronger when closer
        enemy.vx += (dx / dist) * pull;
        enemy.vy += (dy / dist) * pull;
      });

      // Explode if any enemy touches the ghost
      const touchingEnemy = s.enemies.find((enemy: any) => {
        const dx = eg.x - enemy.x;
        const dy = eg.y - enemy.y;
        return Math.sqrt(dx * dx + dy * dy) <= eg.radius + enemy.radius;
      });
      if (touchingEnemy) {
        createExplosionParticles(eg.x, eg.y, eg.color, 20);
        s.shockwaves.push({
          x: eg.x,
          y: eg.y,
          radius: Math.round(5 * BIG),
          maxRadius: Math.round(60 * BIG),
          speed: 10,
          color: eg.color,
          killsEnemies: true,
          killsProjectiles: false
        });
        return false;
      }

      return true;
    });

    // 4. UPDATE SHOCKWAVES (Visual physical expansion)
    s.shockwaves = s.shockwaves.filter((sw) => {
      // If the wave has travel velocity, move it (unscaled real-time)
      if (sw.vx !== undefined && sw.vy !== undefined) {
        sw.x += sw.vx * (deltaReal / 16.67);
        sw.y += sw.vy * (deltaReal / 16.67);
      }
      
      // Expand radius in unscaled real-time for immediate snappy sweeps
      sw.radius += sw.speed * (deltaReal / 16.67) * 2.0;

      // Jolt push: apply outward force as ring sweeps past each enemy
      if ((sw as any).pushType === "jolt") {
        const hitSet = (sw as any)._hitEnemies as Set<string>;
        s.enemies.forEach((enemy: any) => {
          if (hitSet.has(enemy.id)) return;
          const dx = enemy.x - sw.x;
          const dy = enemy.y - sw.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Ring band: enemy within 30px behind the current ring edge
          if (dist <= sw.radius && dist > sw.radius - 30 * BIG) {
            hitSet.add(enemy.id);
            const distFactor = 0.35 + (1 - dist / sw.maxRadius) * 0.65; // 0.35 floor at edge, 1.0 at center
            const impulse = distFactor * 1500;
            if (dist > 0) {
              enemy.vx = (dx / dist) * impulse;
              enemy.vy = (dy / dist) * impulse;
              enemy.knockbackTimer = 600;
              createExplosionParticles(enemy.x, enemy.y, "#facc15", 3);
            }
          }
        });
      }

      // Ploum pull-wave: ring contracts inward, pulls enemies as it sweeps past them
      if ((sw as any).pushType === "ploum_pull") {
        const hitSet = (sw as any)._hitEnemies as Set<string>;
        s.enemies.forEach((enemy: any) => {
          if (hitSet.has(enemy.id)) return;
          const dx = enemy.x - sw.x;
          const dy = enemy.y - sw.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Hit when enemy is just outside the contracting ring edge (ring sweeps inward past them)
          if (dist >= sw.radius && dist < sw.radius + 30 * BIG) {
            hitSet.add(enemy.id);
            const distFactor = dist / sw.maxRadius; // stronger at edges (further from center)
            const impulse = (0.4 + distFactor * 0.6) * 1250;
            if (dist > 0) {
              enemy.vx = -(dx / dist) * impulse;
              enemy.vy = -(dy / dist) * impulse;
              enemy.knockbackTimer = 400;
            }
          }
        });
      }
      
      // Perform hits - mark enemies for kill, apply after all shockwaves processed
      if (sw.killsEnemies) {
    s.enemies.forEach((enemy: any) => {
          const dx = enemy.x - sw.x;
          const dy = enemy.y - sw.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance <= sw.radius + enemy.radius + 12 && !enemy._markedForKill) {
            enemy._markedForKill = true;
          }
        });
      }

      if (sw.killsProjectiles) {
        s.projectiles = s.projectiles.filter((proj) => {
          const dx = proj.x - sw.x;
          const dy = proj.y - sw.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const hit = distance <= sw.radius + proj.radius + 12;
          if (hit) {
            createExplosionParticles(proj.x, proj.y, "#38bdf8", 6);
          }
          return !hit;
        });
      }

      if ((sw as any).speed < 0) return sw.radius > 0; // contracting
      return sw.radius < sw.maxRadius; // expanding
    });

    // 5a. Deferred shockwave kills (applied after all shockwaves processed to avoid stale reference)
    const swKillIds = s.enemies.filter((e: any) => e._markedForKill).map((e) => e.id);
    // Clear all marks first so surviving enemies don't carry stale flags into next frame
    s.enemies.forEach((e: any) => { e._markedForKill = false; });
    swKillIds.forEach((id) => {
      const enemy = s.enemies.find((e) => e.id === id);
      if (enemy) triggerEnemyKillForce(enemy, "Shockwave");
    });

    // 5. UPDATE ENEMIES
    updateEnemies(dt, activeSpeedFactor, deltaReal);

    // 6. UPDATE PROJECTILES
    s.projectiles = s.projectiles.filter((proj: any) => {
      const nowMsProj = Date.now();
      // Restore frozen projectile velocity once freeze expires
      if (proj._frozenUntil && nowMsProj >= proj._frozenUntil) {
        proj.vx = proj._frozenVx ?? proj.vx;
        proj.vy = proj._frozenVy ?? proj.vy;
        proj._frozenUntil = undefined;
        proj._frozenVx = undefined;
        proj._frozenVy = undefined;
      }
      // Don't move frozen projectiles
      if (proj._frozenUntil && nowMsProj < proj._frozenUntil) return true;
      proj.x += proj.vx * dt * 60;
      proj.y += proj.vy * dt * 60;

      // Projectile hit player?
      const dx = proj.x - s.player.x;
      const dy = proj.y - s.player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < proj.radius + s.player.radius) {
        handlePlayerHit();
        return false; // destroy bullet
      }

      // Keep inside bounds (optional cleanup)
      return proj.x > -200 && proj.x < s.width + 200 && proj.y > -200 && proj.y < s.height + 200;
    });

    // 7. UPDATE LASERS
    updateLasers(deltaReal);

    // 8. UPDATE SHIELD POWER UPS
    s.shieldPowerUps = s.shieldPowerUps.filter((sp) => {
      sp.pulsePhase += 0.05 * (deltaReal / 16.67);
      
      // Collision check with player
      const dx = sp.x - s.player.x;
      const dy = sp.y - s.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < sp.radius + s.player.radius) {
        s.player.shields += 1;
        audio.playShieldOption(true);
        createExplosionParticles(sp.x, sp.y, "#22d3ee", 20);
        return false;
      }
      return true;
    });

    // 9. SPAWN SYSTEMS
    if (s.hasMoved) {
      handleSpawning(deltaReal, activeSpeedFactor);
    }

    // DRAW TO CANVAS
    draw();

    animRef.current = requestAnimationFrame(gameLoop);
  };

  // Distance from point to line segment
  const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const sx = x1 + t * (x2 - x1);
    const sy = y1 + t * (y2 - y1);
    return Math.sqrt((px - sx) * (px - sx) + (py - sy) * (py - sy));
  };

  const updateEnemies = (dt: number, activeSpeedFactor: number, deltaReal: number) => {
    const s = stateRef.current;
    
    // Check if we have an active Echo ghost that acts as an aggro attractor
    const activeGhost = s.echoGhosts.length > 0 ? s.echoGhosts[0] : null;
    const targetX = activeGhost ? activeGhost.x : s.player.x;
    const targetY = activeGhost ? activeGhost.y : s.player.y;

    // Use a percentage of the smaller canvas dimension for distance thresholds
    const screenRef = Math.min(s.width, s.height);

    const nowMs = Date.now();
    s.enemies.forEach((enemy: any) => {
      if (enemy.frozenUntil && nowMs < enemy.frozenUntil) return; // frozen by Neo Drop

      // Manage knockback timer if pushed by Jolt
      if (enemy.knockbackTimer !== undefined && enemy.knockbackTimer > 0) {
        enemy.knockbackTimer -= deltaReal;
      } else {
        // Standard AI Steering behaviors
        if (enemy.type === "fast" || enemy.type === "swarmer") {
          // Fast swarmers head strictly towards key destination
          const dx = targetX - enemy.x;
          const dy = targetY - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 5) {
            enemy.vx += (dx / dist) * 0.35;
            enemy.vy += (dy / dist) * 0.35;
          }
        } else if (enemy.type === "basic") {
          // Basic enemies tracking the player to maintain active engagement
          const dx = targetX - enemy.x;
          const dy = targetY - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 5) {
            enemy.vx += (dx / dist) * 0.22;
            enemy.vy += (dy / dist) * 0.22;
          }
        } else if (enemy.type === "bullet_hell") {
          // Directly steer toward player — bypass accel+drag terminal velocity trap
          const dx = targetX - enemy.x;
          const dy = targetY - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 5) {
            const targetVx = (dx / dist) * 55;
            const targetVy = (dy / dist) * 55;
            enemy.vx += (targetVx - enemy.vx) * 0.04;
            enemy.vy += (targetVy - enemy.vy) * 0.04;
          }
        } else if (enemy.type === "target_shooter") {
          // Approach until in shooting range (180px), then hold
          const dx = targetX - enemy.x;
          const dy = targetY - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const holdDist = 160;
          const backOffDist = 100;
          if (dist > holdDist) {
            // Steer toward player at full speed
            const targetVx = (dx / dist) * 70;
            const targetVy = (dy / dist) * 70;
            enemy.vx += (targetVx - enemy.vx) * 0.06;
            enemy.vy += (targetVy - enemy.vy) * 0.06;
          } else if (dist < backOffDist) {
            // Too close — back off
            const targetVx = -(dx / dist) * 50;
            const targetVy = -(dy / dist) * 50;
            enemy.vx += (targetVx - enemy.vx) * 0.05;
            enemy.vy += (targetVy - enemy.vy) * 0.05;
          } else {
            // In hold zone — brake
            enemy.vx *= 0.88;
            enemy.vy *= 0.88;
          }
        } else if (enemy.type === "shooter") {
          // Approach until in shooting range (200px), then hold
          const dx = targetX - enemy.x;
          const dy = targetY - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const holdDist = 180;
          const backOffDist = 110;
          if (dist > holdDist) {
            const targetVx = (dx / dist) * 60;
            const targetVy = (dy / dist) * 60;
            enemy.vx += (targetVx - enemy.vx) * 0.05;
            enemy.vy += (targetVy - enemy.vy) * 0.05;
          } else if (dist < backOffDist) {
            const targetVx = -(dx / dist) * 45;
            const targetVy = -(dy / dist) * 45;
            enemy.vx += (targetVx - enemy.vx) * 0.04;
            enemy.vy += (targetVy - enemy.vy) * 0.04;
          } else {
            enemy.vx *= 0.88;
            enemy.vy *= 0.88;
          }
        } else if (enemy.type === "tank") {
          // Tanks slow steer
          const dx = targetX - enemy.x;
          const dy = targetY - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 5) {
            enemy.vx += (dx / dist) * 0.18;
            enemy.vy += (dy / dist) * 0.18;
          }
        }
      }

      // Apply drag to keep velocities stabilized (smoother sliding during Jolt knockbacks)
      enemy.vx *= 0.98;
      enemy.vy *= 0.98;

      // Update position with cap speed limits
      let capSpeed = enemy.type === "swarmer" ? 320 : enemy.type === "fast" ? 240 : 160;
      if (enemy.type === "bullet_hell") {
        capSpeed = 400;
      } else if (enemy.type === "target_shooter") {
        capSpeed = 400;
      } else if (enemy.type === "shooter") {
        capSpeed = 400;
      } else if (enemy.type === "tank") {
        capSpeed = 100;
      }
      
      if (enemy.knockbackTimer !== undefined && enemy.knockbackTimer > 0) {
        capSpeed = 2000; // Allow full knockback speed
      }

      const speed = Math.sqrt(enemy.vx * enemy.vx + enemy.vy * enemy.vy);
      if (speed * activeSpeedFactor > capSpeed) {
        enemy.vx = (enemy.vx / speed) * capSpeed;
        enemy.vy = (enemy.vy / speed) * capSpeed;
      }

      // Dynamic time step calculation: use unscaled real-time delta for knocked-back elements so they fly back instantly
      let currentDt = dt;
      if (enemy.knockbackTimer !== undefined && enemy.knockbackTimer > 0) {
        currentDt = (deltaReal / 1000) * activeSpeedFactor;
      }

      enemy.x += enemy.vx * currentDt;
      enemy.y += enemy.vy * currentDt;

      // Shoot capabilities
      if (enemy.type === "shooter") {
        enemy.shootCooldown -= dt * 1000;
        const dxS = targetX - enemy.x;
        const dyS = targetY - enemy.y;
        const distS = Math.sqrt(dxS * dxS + dyS * dyS);
        if (enemy.shootCooldown <= 0 && distS < 200 && s.projectiles.length < 40) {
          shootProjectileAtTarget(enemy, targetX, targetY, 2.4, "#f97316");
          enemy.shootCooldown = enemy.maxShootCooldown * (0.8 + Math.random() * 0.4);
        } else if (enemy.shootCooldown <= 0) {
          enemy.shootCooldown = 500; // retry soon
        }
      } else if (enemy.type === "target_shooter") {
        enemy.shootCooldown -= dt * 1000;
        const dxT = targetX - enemy.x;
        const dyT = targetY - enemy.y;
        const distT = Math.sqrt(dxT * dxT + dyT * dyT);
        if (enemy.shootCooldown <= 0 && distT < 180 && s.projectiles.length < 40) {
          shootProjectileAtTarget(enemy, targetX, targetY, 3.2, "#a855f7");
          enemy.shootCooldown = (enemy.maxShootCooldown * 0.6) * (0.8 + Math.random() * 0.4);
        } else if (enemy.shootCooldown <= 0) {
          enemy.shootCooldown = 500;
        }
      } else if (enemy.type === "bullet_hell") {
        enemy.shootCooldown -= dt * 1000;
        if (enemy.shootCooldown <= 0 && s.projectiles.length < 40) {
          // Swift projectile in a completely random direction without targeting!
          const angle = Math.random() * Math.PI * 2;
          const pSpeed = 3.6; // swift speeds
          s.projectiles.push({
            id: Math.random().toString(),
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(angle) * pSpeed,
            vy: Math.sin(angle) * pSpeed,
            radius: Math.round(5 * BIG),
            color: "#10b981", // vibrant emerald
            damage: 1
          });
          enemy.shootCooldown = 1200 + Math.random() * 800; // highly active bullet spawn rate
        }
      }

      // Check collision with player
      const dx = enemy.x - s.player.x;
      const dy = enemy.y - s.player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < enemy.radius + s.player.radius) {
        handlePlayerHit();
      }
    });

    // Prune gone off-screen stray enemies to keep the spawner active and the game intense!
    s.enemies = s.enemies.filter(
      (e) => e.x >= -80 && e.x <= s.width + 80 && e.y >= -80 && e.y <= s.height + 80
    );
  };

  const shootProjectileAtTarget = (enemy: Enemy, tX: number, tY: number, speed: number = 2.4, color: string = "#f97316") => {
    const s = stateRef.current;
    if (s.projectiles.length >= 40) return;
    const dx = tX - enemy.x;
    const dy = tY - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 10) return;

    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;

    s.projectiles.push({
      id: Math.random().toString(),
      x: enemy.x,
      y: enemy.y,
      vx,
      vy,
      radius: Math.round(5 * BIG),
      color,
      damage: 1
    });
  };

  const updateLasers = (deltaReal: number) => {
    const s = stateRef.current;

    s.lasers = s.lasers.filter((laser: any) => {
      // Pause laser timers during Neo Drop freeze
      const nowMsLaser = Date.now();
      if (laser._frozenUntil && nowMsLaser < laser._frozenUntil) return true;
      laser._frozenUntil = undefined;

      const dtScaled = deltaReal * s.currentTimeScale;

      if (!laser.isActive) {
        // Warning stage
        laser.warningTime -= dtScaled;
        if (laser.warningTime <= 0) {
          laser.isActive = true;
          audio.playLaserFire(laser.type === "wave");
        }
      } else {
        // Firing phase
        laser.activeTime -= dtScaled;

        // Perform collisions while active
        if (laser.type === "line") {
          // Line laser damages dot and enemies alike
          const distPlayer = distToSegment(
            s.player.x,
            s.player.y,
            laser.x1 || 0,
            laser.y1 || 0,
            laser.x2 || 0,
            laser.y2 || 0
          );
          if (distPlayer < s.player.radius + 15) {
            const nowMs = Date.now();
            if (!laser.lastDamageTime || nowMs - laser.lastDamageTime >= 800) {
              laser.lastDamageTime = nowMs;
              handlePlayerHit();
            }
          }

          // Kills enemies in contact as well!
    s.enemies.forEach((enemy: any) => {
            const distEnemy = distToSegment(
              enemy.x,
              enemy.y,
              laser.x1 || 0,
              laser.y1 || 0,
              laser.x2 || 0,
              laser.y2 || 0
            );
            if (distEnemy < enemy.radius + 15) {
              triggerEnemyKillForce(enemy, "Vertical Disruption Beam");
            }
          });
        } else if (laser.type === "wave") {
          // Expanding Green wave laser starting from center
          if (laser.radius !== undefined && laser.maxRadius !== undefined) {
            // Expands outwards circles
            const expansionSpeed = 200 * (deltaReal / 1000) * s.currentTimeScale;
            laser.radius += expansionSpeed;

            // Player contact check: only hit if at outline radius ring (+-15px padding)
            const dx = s.player.x - (laser.x || 0);
            const dy = s.player.y - (laser.y || 0);
            const playerDist = Math.sqrt(dx * dx + dy * dy);

            if (Math.abs(playerDist - laser.radius) < 18) {
              const nowMs = Date.now();
              if (!laser.lastDamageTime || nowMs - laser.lastDamageTime >= 800) {
                laser.lastDamageTime = nowMs;
                handlePlayerHit();
              }
            }

            // Note: Waves DO NOT kill enemies (specified in prompt: "NOT KILL ENEMIES").
            if (laser.radius > laser.maxRadius) {
              return false; // done
            }
          }
        }
      }

      return laser.activeTime > 0 || (laser.type === "wave" && (laser.radius || 0) < (laser.maxRadius || 0));
    });
  };

  const triggerEnemyKillForce = (enemy: Enemy, source: string, killedByLine: boolean = false) => {
    const s = stateRef.current;
    // Explode into tiny retro square particles
    createExplosionParticles(enemy.x, enemy.y, enemy.color, 15);
    // Only real kills (via teleport line or dot abilities) count toward killCount and slo.
    // Laser kills are environmental and do not award slo or count in kill total.
    const isRealKill = source !== "Vertical Disruption Beam";
    if (isRealKill) {
      killCountRef.current += 1;
      // Smaller enemies reward more slo — slo scales inversely with enemy radius
      const baseSloPerKill = Math.max(0.4, (20 - enemy.radius / BIG) * 0.18);
      s.player.slo = Math.max(0, s.player.slo + baseSloPerKill * (customDifficulty != null ? (customDifficulty.sloPerKill ?? 1.0) : 1.0));

      // Combo tracking — increment before computing pitch so first kill of a combo already raises it
      s.comboCount += 1;
      s.comboResetTimer = 1500;

      const pitchMult = comboPitchEnabledRef.current ? 1.0 + Math.min(s.comboCount - 1, 8) * 0.12 : 1.0;
      audio.playEnemyKill(enemy.type === "tank", pitchMult);

      if (killFlashEnabledRef.current) {
        s.killFlashAlpha = 0.55 * killFlashIntensityRef.current;
      }
      if (screenShakeEnabledRef.current) {
        s.shakeTimer = enemy.type === "tank" ? 220 : 130;
        s.shakeIsTank = enemy.type === "tank";
      }
    } else {
      // Laser kill — plain sound, no effects
      audio.playEnemyKill(enemy.type === "tank", 1.0);
    }

    // Apply kill-based matrix slow motion only for real kills
    if (isRealKill) s.timeScale = 0.15;

    // Neo Drop: spawn explosive micro drops only when killed by the teleport line
    if ((selectedDot.id === "neo_drop" || selectedDot.id === NEO_DROP_ID) && killedByLine) {
      const dropCount = 6 + Math.floor(Math.random() * 5);
      for (let i = 0; i < dropCount; i++) {
        const angle = (i / dropCount) * Math.PI * 2 + Math.random() * 0.4;
        const speed = 4.5 + Math.random() * 5.5; // fast enough to travel far
        s.microDrops.push({
          id: Math.random().toString(),
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: Math.round(4 * BIG),
          alpha: 1.0,
          life: 2000 + Math.random() * 1000, // 2-3 seconds of travel time
        });
      }
    }

    // Slice off enemy from active list
    s.enemies = s.enemies.filter((e) => e.id !== enemy.id);
  };

  // Create neon styled particle sparks
  const createExplosionParticles = (x: number, y: number, color: string, count: number) => {
    const s = stateRef.current;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.5;
      s.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        alpha: 1.0,
        decay: 0.02 + Math.random() * 0.04,
        radius: (1.5 + Math.random() * 3) * BIG,
        shape: Math.random() > 0.4 ? "square" : "circle"
      });
    }
  };

  const handlePlayerHit = () => {
    const s = stateRef.current;
    if (s.gameOverTriggered) return;
    // Debug invincibility or post-shield-break grace period
    if (invincible || s.player.isInvincible) return;

    if (s.player.shields > 0) {
      s.player.shields -= 1;
      audio.playShieldOption(false);
      s.player.isInvincible = true;
      s.player.invincibilityTimer = 1000;
      createExplosionParticles(s.player.x, s.player.y, "#ef4444", 25);
    } else {
      triggerGameOver();
    }
  };

  const triggerGameOver = () => {
    const s = stateRef.current;
    if (s.gameOverTriggered) return;
    s.gameOverTriggered = true;
    audio.playGameOver();

    // Create massive game over firework particles
    createExplosionParticles(s.player.x, s.player.y, selectedDot.color, 90);

    const secondsSurvived = s.timeElapsedGame / 1000;
    onGameOver(secondsSurvived, s.plointsGained, killCountRef.current);
  };

  // Mouse teleport calculation & damage line segments
  const handleStageClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    if (s.gameOverTriggered) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Check if player clicked/teleported directly onto an enemy, projectile, or active laser hazard
    let teleportOverlap = false;

    s.enemies.forEach((enemy: any) => {
      const dx = clickX - enemy.x;
      const dy = clickY - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= enemy.radius + s.player.radius + 15) {
        teleportOverlap = true;
      }
    });

    s.projectiles.forEach((proj) => {
      const dx = clickX - proj.x;
      const dy = clickY - proj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= proj.radius + s.player.radius + 15) {
        teleportOverlap = true;
      }
    });

    s.lasers.forEach((laser) => {
      if (!laser.isActive) return;
      if (laser.type === "line") {
        const distLaser = distToSegment(
          clickX,
          clickY,
          laser.x1 || 0,
          laser.y1 || 0,
          laser.x2 || 0,
          laser.y2 || 0
        );
        if (distLaser < s.player.radius + 15) {
          teleportOverlap = true;
        }
      } else if (laser.type === "wave") {
        const dx = clickX - (laser.x || 0);
        const dy = clickY - (laser.y || 0);
        const playerDist = Math.sqrt(dx * dx + dy * dy);
        if (laser.radius !== undefined && Math.abs(playerDist - laser.radius) < 18) {
          teleportOverlap = true;
        }
      }
    });

    // Activate/Start the mission upon making the first teleportation
    if (!s.hasMoved) {
      s.hasMoved = true;
      s.startTimeReal = Date.now();
      s.lastPlointAwardTime = 0;
    }

    const startX = s.player.x;
    const startY = s.player.y;

    // 1. Trigger Teleportation SFX
    audio.playTeleport();

    // 2. Perform Echo Ghost spawn (if selected Echo config)
    if (selectedDot.id === "echo") {
      s.echoGhosts = [
        {
          x: startX,
          y: startY,
          radius: s.player.radius + 2,
          duration: 6000, // 6 real-time seconds (unscaled)
          maxDuration: 6000,
          color: selectedDot.color
        }
      ];
    }

    // 3. Perform Ploum explosion at Departure/Origin
    if (selectedDot.id === "ploum") {
      // Backdraft pull: drag nearby enemies toward departure point before explosion
      const ploumPullRadius = Math.round(173 * BIG); // ~0.6x previous 289
      // Pull-wave: ring contracts inward from maxRadius to center, pulling enemies as it passes
      s.shockwaves.push({
        x: startX,
        y: startY,
        radius: ploumPullRadius, // start at full radius
        maxRadius: ploumPullRadius,
        speed: -7.0, // negative = contracting
        color: selectedDot.color,
        killsEnemies: false,
        killsProjectiles: false,
        pushType: "ploum_pull",
        _hitEnemies: new Set(),
      } as any);

      createExplosionParticles(startX, startY, selectedDot.color, 30);
      s.shockwaves.push({
        x: startX,
        y: startY,
        radius: Math.round(5 * BIG),
        maxRadius: Math.round(115 * BIG),
        speed: 2.1,
        color: selectedDot.color,
        killsEnemies: true,
        killsProjectiles: false
      });
      // Leave a flaming ground residue at departure for 0.3 real seconds
      s.ploumResidues.push({
        x: startX,
        y: startY,
        duration: 300,
        maxDuration: 300,
        radius: Math.round(40 * BIG),
      });
    }

    // 4. Teleport Dot Immediately
    s.player.x = clickX;
    s.player.y = clickY;

    // 5. Line Laser / Kill mechanism calculations
    const isNullAbility = selectedDot.id === "null";
    const isWraithAbility = selectedDot.id === "wraith";

    if (!isNullAbility) {
      // Normal Line Kill: Check intersection with all enemies along the trace segment
      const enemiesToKill: any[] = [];
      s.enemies.forEach((enemy: any) => {
        // Calculate distance from enemy center to teleport line track
        const dist = distToSegment(enemy.x, enemy.y, startX, startY, clickX, clickY);
        // Tanks get a larger hitbox to compensate for their size
        const hitRadius = enemy.type === "tank" ? enemy.radius + 30 : enemy.radius + 18;
        if (dist <= hitRadius) {
          enemiesToKill.push(enemy);
        }
      });
      enemiesToKill.forEach((enemy: any) => triggerEnemyKillForce(enemy, "Neon Teleport Line", true));

      // Clear incoming neon bullet projectiles along the teleport trace
      s.projectiles = s.projectiles.filter((proj) => {
        const dist = distToSegment(proj.x, proj.y, startX, startY, clickX, clickY);
        if (dist <= proj.radius + 18) {
          createExplosionParticles(proj.x, proj.y, proj.color, 4);
          return false;
        }
        return true;
      });
    }

    // If the destination overlaps an enemy or bullet, apply damage and stop here.
    // Line kills above have already run, so everything on the path is dead.
    if (teleportOverlap) {
      createExplosionParticles(clickX, clickY, "#ef4444", 45);
      if (!invincible && !s.player.isInvincible) {
        if (s.player.shields > 0) {
          s.player.shields -= 1;
          audio.playShieldOption(false);
          s.player.isInvincible = true;
          s.player.invincibilityTimer = 1000;
        } else {
          triggerGameOver();
        }
      }
      // Draw the line so the player sees it fired
      s.teleportLine = { x1: startX, y1: startY, x2: clickX, y2: clickY, alpha: 1.0, color: selectedDot.color };
      return;
    }

    // 6. Dot abilities triggered at DESTINATION
    if (isNullAbility) {
      // Null AOE Blast instead of line damage
      s.shockwaves.push({
        x: clickX,
        y: clickY,
        radius: Math.round(10 * BIG),
        maxRadius: Math.round(90 * BIG), // reduced blast radius
        speed: 6,
        color: "#f43f5e",
        killsEnemies: true,
        killsProjectiles: false
      });
      createExplosionParticles(clickX, clickY, "#18181b", 20);
    } else if (isWraithAbility) {
      // Wraith Instant large blast
      s.shockwaves.push({
        x: clickX,
        y: clickY,
        radius: Math.round(5 * BIG),
        maxRadius: Math.round(130 * BIG),
        speed: 8, // fast instant visual shockwave
        color: selectedDot.color,
        killsEnemies: true,
        killsProjectiles: false
      });
    } else if (selectedDot.id === "katsune") {
      // Katsune shoots 2 directed waves from DEPARTURE point toward teleport direction
      const angle = Math.atan2(clickY - startY, clickX - startX);
      const leftAngle = angle - Math.PI / 10;
      const rightAngle = angle + Math.PI / 10;
      
      const waveTravelSpeed = 7.0;

      // Store travel angle in the shockwave for arc drawing
      // Using arcAngle field (added to Shockwave type) to identify katsune waves
      s.shockwaves.push({
        x: startX,
        y: startY,
        radius: Math.round(2 * BIG),
        maxRadius: Math.round(118 * BIG), // 1.75x original 90, reduced 25%
        speed: 3.5,
        color: selectedDot.color,
        killsEnemies: true,
        killsProjectiles: false,
        vx: Math.cos(leftAngle) * waveTravelSpeed,
        vy: Math.sin(leftAngle) * waveTravelSpeed,
        arcAngle: leftAngle
      } as any);

      s.shockwaves.push({
        x: startX,
        y: startY,
        radius: Math.round(2 * BIG),
        maxRadius: Math.round(118 * BIG), // 1.75x original 90, reduced 25%
        speed: 3.5,
        color: selectedDot.color,
        killsEnemies: true,
        killsProjectiles: false,
        vx: Math.cos(rightAngle) * waveTravelSpeed,
        vy: Math.sin(rightAngle) * waveTravelSpeed,
        arcAngle: rightAngle
      } as any);
    } else if (selectedDot.id === "vex") {
      // Vex leaves a hot lingering damage zone at destination
      s.damageZones.push({
        id: Math.random().toString(),
        x: clickX,
        y: clickY,
        radius: Math.round(65 * BIG),
        duration: 3200,
        maxDuration: 3200,
        color: selectedDot.color
      });
      while (s.damageZones.length > 4) {
        s.damageZones.shift(); // Evict the oldest if there are more than 4, strictly capped
      }
    } else if (selectedDot.id === "prism") {
      // Prism: fires a wave from destination that destroys projectiles
      // 10% crit chance with 5s real cooldown — crit wave also kills enemies
      const prismCrit = Math.random() < 0.10 && s.prismCritCooldown <= 0;
      if (prismCrit) {
        s.prismCritCooldown = 5000;
        createExplosionParticles(clickX, clickY, "#38bdf8", 40);
      }
      s.shockwaves.push({
        x: clickX,
        y: clickY,
        radius: Math.round(5 * BIG),
        maxRadius: Math.round(180 * BIG), // Generous defensive sweep
        speed: 7,
        color: prismCrit ? "#ffffff" : "#38bdf8",
        killsEnemies: prismCrit,
        killsProjectiles: true
      });
    } else if (selectedDot.id === "jolt") {
      // Jolt: ring expands and pushes enemies as it reaches them
      const knockRadius = Math.round(150 * BIG);
      s.shockwaves.push({
        x: clickX,
        y: clickY,
        radius: Math.round(5 * BIG),
        maxRadius: knockRadius,
        speed: 5.5,
        color: "#facc15",
        killsEnemies: false,
        killsProjectiles: false,
        pushType: "jolt",
        _hitEnemies: new Set(),
      } as any);
    } else if (selectedDot.id === "glint") {
      // 5% hyper critical trigger — 3 real-second cooldown between crits
      const crit = Math.random() < 0.05 && s.glintCritCooldown <= 0;
      if (crit) {
        s.glintCritCooldown = 3000;
        audio.playGlintCrit();
        
        // Trigger massive screen-flash alpha
        s.glintFlashAlpha = 1.0;

        // Render magical flash particles
        createExplosionParticles(clickX, clickY, "#ffffff", 80);

        // Slow all active enemies dramatically down for 3s
        const nowMs = Date.now();
    s.enemies.forEach((enemy: any) => {
      if (enemy.frozenUntil && nowMs < enemy.frozenUntil) return; // frozen by Neo Drop

          enemy.vx = 0.01;
          enemy.vy = 0.01;
        });

        // Set glint slow motion timer to 3 seconds
        s.glintSlowTimer = 3000;

        // Trigger safe block shield for 0.5 seconds
        s.player.isInvincible = true;
        s.player.invincibilityTimer = 500;

        // Mega AOE shockwave that sweeps out and kills everything (enemies & projectiles)
        s.shockwaves.push({
          x: clickX,
          y: clickY,
          radius: Math.round(10 * BIG),
          maxRadius: Math.round(360 * BIG),
          speed: 18,
          color: "#22d3ee",
          killsEnemies: true,
          killsProjectiles: true
        });
      }
    }

    // Store teleport line for drawing as a solid laser flash
    s.teleportLine = {
      x1: startX, y1: startY,
      x2: clickX, y2: clickY,
      alpha: 1.0,
      color: selectedDot.color
    };
  };

  const trackMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    s.mouse.x = e.clientX - rect.left;
    s.mouse.y = e.clientY - rect.top;
  };

  // Process spawners based on game timer and difficulty criteria
  const handleSpawning = (deltaReal: number, activeSpeedFactor: number) => {
    const s = stateRef.current;
    
    // Scale rates with elapsed real time
    const timeRatio = 1.0 + (s.timeElapsedReal / 30000) * 1.0; // scales up twice as fast now

    // Speed multiplier logic
    let spawnRateMultiplier = 1.0;
    let maxEnemiesAllowed = 15;
    
    if (customDifficulty != null) {
      // Custom difficulty: use spawnRateBase/spawnRateMin directly as ms thresholds
      // spawnRateBase = starting interval ms, spawnRateMin = floor ms
      const base = customDifficulty.spawnRateBase ?? 3000;
      const min = customDifficulty.spawnRateMin ?? 800;
      const rawThreshold = Math.max(min, base / timeRatio);
      maxEnemiesAllowed = customDifficulty.maxEnemies ?? 20;

      // A. ENEMY SPAWNER (custom path — uses raw ms threshold directly)
      s.enemySpawnProgress += deltaReal;
      if (s.enemySpawnProgress >= rawThreshold && s.enemies.length < maxEnemiesAllowed) {
        s.enemySpawnProgress = 0;
        spawnRandomEnemy(activeSpeedFactor);
      }
    } else {
      switch (difficulty) {
        case Difficulty.Blissful:
          spawnRateMultiplier = 2.0;
          maxEnemiesAllowed = 25;
          break;
        case Difficulty.Pissful:
          spawnRateMultiplier = 3.5;
          maxEnemiesAllowed = 40;
          break;
        case Difficulty.Ez:
          spawnRateMultiplier = 5.0;
          maxEnemiesAllowed = 60;
          break;
        case Difficulty.Medium:
          spawnRateMultiplier = 7.5;
          maxEnemiesAllowed = 90;
          break;
        case Difficulty.Hard:
          spawnRateMultiplier = 11.0;
          maxEnemiesAllowed = 120;
          break;
        case Difficulty.HardR:
          spawnRateMultiplier = 16.0;
          maxEnemiesAllowed = 150;
          break;
        case Difficulty.Impossible:
          spawnRateMultiplier = 22.0;
          maxEnemiesAllowed = 180;
          break;
        case Difficulty.Hell:
          spawnRateMultiplier = 35.0;
          maxEnemiesAllowed = 250;
          break;
        case Difficulty.Dot0:
          spawnRateMultiplier = 55.0;
          maxEnemiesAllowed = 300;
          break;
      }

      // Cut base from 1800 to 450 to make spawnings extremely active
      const enemySpawnThreshold = (450 / (spawnRateMultiplier * timeRatio));

      // A. ENEMY SPAWNER
      s.enemySpawnProgress += deltaReal;
      if (s.enemySpawnProgress >= enemySpawnThreshold && s.enemies.length < maxEnemiesAllowed) {
        s.enemySpawnProgress = 0;
        spawnRandomEnemy(activeSpeedFactor);
      }
    }

    // B. LASER SPAWNER
    // Progress scales with currentTimeScale so slow-mo doesn't cause laser pile-up.
    // Also hard-cap total lasers on screen so they can never stack uncontrollably.
    // Custom difficulty can override line/wave laser frequency independently.
    const lineLaserFreqMult = customDifficulty ? (customDifficulty.lineLaserFreq ?? 1.0) : 1.0;
    const waveLaserFreqMult = customDifficulty ? (customDifficulty.waveLaserFreq ?? 0.25) : 1.0;
    // Combined effective freq for the spawn timer (use the higher of the two to set pace)
    const effectiveLaserFreqMult = customDifficulty
      ? Math.max(lineLaserFreqMult, waveLaserFreqMult)
      : 1.0;
    // For custom difficulty, derive an equivalent spawnRateMultiplier from spawnRateBase
    // so laser frequency roughly matches the enemy density.
    const laserSpeedMult = customDifficulty != null
      ? Math.max(0.5, 3000 / Math.max(200, customDifficulty.spawnRateBase ?? 3000))
      : spawnRateMultiplier;
    const laserSpawnThreshold = (2500 / (laserSpeedMult * 0.45 * effectiveLaserFreqMult));
    s.laserSpawnProgress += deltaReal * s.currentTimeScale;
    const MAX_CONCURRENT_LASERS = (difficulty === Difficulty.Dot0) ? 8 :
                                   (difficulty === Difficulty.Hell) ? 6 :
                                   (difficulty === Difficulty.Impossible) ? 5 : 3;
    // Harder difficulties spawn lasers faster
    const hardLaserMult = (difficulty === Difficulty.Dot0) ? 4.5 :
                          (difficulty === Difficulty.Hell) ? 3.0 :
                          (difficulty === Difficulty.Impossible) ? 2.0 : 1.0;
    const effectiveLaserThreshold = laserSpawnThreshold / (customDifficulty ? 1.0 : hardLaserMult);
    if (s.laserSpawnProgress >= effectiveLaserThreshold && s.lasers.length < MAX_CONCURRENT_LASERS) {
      s.laserSpawnProgress = 0;
      spawnIncomingLaser(customDifficulty ? lineLaserFreqMult : null, customDifficulty ? waveLaserFreqMult : null);
    } else if (s.lasers.length >= MAX_CONCURRENT_LASERS) {
      // Don't let progress keep accumulating while capped — reset so we wait a full interval after clearing
      s.laserSpawnProgress = Math.min(s.laserSpawnProgress, effectiveLaserThreshold * 0.75);
    }

    // C. SHIELD POWER UP SPAWNER
    // "in Medium and before, add a shield power up that shows up every once in a while"
    const isShieldAllowed =
      difficulty === Difficulty.Blissful ||
      difficulty === Difficulty.Pissful ||
      difficulty === Difficulty.Ez ||
      difficulty === Difficulty.Medium;

    if (isShieldAllowed) {
      s.shieldSpawnProgress += deltaReal;
      // Spawn shield roughly every 16 - 25 real seconds
      const shieldThreshold = 18000 + Math.random() * 9000;
      if (s.shieldSpawnProgress >= shieldThreshold && s.shieldPowerUps.length < 3) {
        s.shieldSpawnProgress = 0;
        s.shieldPowerUps.push({
          x: 50 + Math.random() * (s.width - 100),
          y: 50 + Math.random() * (s.height - 100),
          radius: 14,
          pulsePhase: 0
        });
      }
    }
  };

  const spawnRandomEnemy = (activeSpeedFactor: number) => {
    const s = stateRef.current;
    
    // Choose spawn side: 0=top, 1=right, 2=bottom, 3=left
    const side = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;
    const margin = 40;

    if (side === 0) {
      x = Math.random() * s.width;
      y = -margin;
    } else if (side === 1) {
      x = s.width + margin;
      y = Math.random() * s.height;
    } else if (side === 2) {
      x = Math.random() * s.width;
      y = s.height + margin;
    } else {
      x = -margin;
      y = Math.random() * s.height;
    }

    // Determine type pool based on current difficulty
    const types: ("basic" | "shooter" | "fast" | "tank" | "swarmer" | "bullet_hell" | "target_shooter")[] = ["basic"];
    
    // All difficulties can have fast and shooter enemies to maintain strong active engagement
    types.push("fast", "shooter");

    // Custom difficulties get the full type pool (the difficulty enum value is meaningless for them)
    const isCustom = customDifficulty != null;

    // All difficulties except Blissful can have bullet hell and target shooter types
    if (isCustom || difficulty !== Difficulty.Blissful) {
      types.push("bullet_hell", "target_shooter");
    }

    // Ez and above gets swarmer
    if (isCustom || (difficulty !== Difficulty.Blissful && difficulty !== Difficulty.Pissful)) {
      types.push("swarmer");
    }
    // Hard and above gets tank
    if (isCustom || difficulty === Difficulty.Hard || difficulty === Difficulty.HardR || difficulty === Difficulty.Impossible || difficulty === Difficulty.Hell || difficulty === Difficulty.Dot0) {
      types.push("tank");
    }

    // Pick a type randomly
    const type = types[Math.floor(Math.random() * types.length)];
    let baseRadius = 8;
    let color = "#ef4444"; // red basic
    let speed = 1.0;
    let hp = 1;
    let scoreValue = 5;

    if (type === "fast") {
      baseRadius = 6;
      color = "#f43f5e"; // bright rose
      speed = 1.8;
      scoreValue = 10;
    } else if (type === "swarmer") {
      baseRadius = 4;
      color = "#fda4af"; // mini crimson dots
      speed = 2.4;
      scoreValue = 15;
    } else if (type === "shooter") {
      baseRadius = 10;
      color = "#f97316"; // neon orange
      speed = 0.6;
      scoreValue = 12;
    } else if (type === "bullet_hell") {
      baseRadius = 9;
      color = "#10b981"; // Emerald green
      speed = 0.8;
      scoreValue = 18;
    } else if (type === "target_shooter") {
      baseRadius = 11;
      color = "#a855f7"; // Neon purple
      speed = 0.5;
      hp = 2; // dual lives
      scoreValue = 20;
    } else if (type === "tank") {
      baseRadius = 16;
      color = "#8b5cf6"; // purple outline hexagons
      speed = 0.4;
      hp = 3;
      scoreValue = 25;
    }

    // Point velocity vector toward the screen center (not the player) so enemies
    // reliably enter the play area regardless of where the player is sitting.
    const centerX = s.width / 2;
    const centerY = s.height / 2;
    const dcx = centerX - x;
    const dcy = centerY - y;
    const dcDist = Math.sqrt(dcx * dcx + dcy * dcy);
    // Use a strong initial push so they visibly enter the field right away
    const entrySpeed = speed * 80 + 30;
    const wanderVx = (dcx / dcDist) * entrySpeed + (Math.random() - 0.5) * 8;
    const wanderVy = (dcy / dcDist) * entrySpeed + (Math.random() - 0.5) * 8;

    s.enemies.push({
      id: Math.random().toString(),
      x,
      y,
      vx: wanderVx,
      vy: wanderVy,
      radius: Math.round(baseRadius * BIG),
      type,
      color,
      shootCooldown: 1000 + Math.random() * 3000,
      maxShootCooldown: 3000,
      hp,
      scoreValue,
      speedMultiplier: speed
    });
  };

  const spawnIncomingLaser = (lineLaserFreqMult: number | null = null, waveLaserFreqMult: number | null = null) => {
    const s = stateRef.current;
    
    // Choose Laser variant: Waves are only in Hard and above and rare!
    // "Wave lasers only start at the middle of the screen and only 1 can happen at the same time"
    const canWave = customDifficulty
      ? (customDifficulty.waveLaserEnabled ?? false)
      : (difficulty === Difficulty.Hard || 
         difficulty === Difficulty.HardR || 
         difficulty === Difficulty.Impossible || 
         difficulty === Difficulty.Hell || 
         difficulty === Difficulty.Dot0);
    
    // If using custom difficulty, also check line laser enabled
    const canLine = customDifficulty ? (customDifficulty.lineLaserEnabled ?? true) : true;

    const countActiveWaves = s.lasers.filter(l => l.type === "wave").length;
    // Wave roll: base 25%, boosted/dampened by waveLaserFreqMult relative to lineLaserFreqMult
    const waveRollChance = (waveLaserFreqMult !== null && lineLaserFreqMult !== null && (lineLaserFreqMult + waveLaserFreqMult) > 0)
      ? waveLaserFreqMult / (lineLaserFreqMult + waveLaserFreqMult)
      : 0.25;
    const rollWave = canWave && countActiveWaves === 0 && Math.random() < waveRollChance;
    // If neither type is enabled, skip
    if (!canLine && !canWave) return;

    if (rollWave) {
      // 1. WAVE LASER SPAWN
      // Spawn at middle of screen, triggers dynamic countdown warning based on difficulty
      let waveWarningTime = 1000;
      if (difficulty === Difficulty.Dot0) waveWarningTime = 420;
      else if (difficulty === Difficulty.Hell) waveWarningTime = 600;
      else if (difficulty === Difficulty.Impossible) waveWarningTime = 750;
      else if (difficulty === Difficulty.Hard || difficulty === Difficulty.HardR) waveWarningTime = 900;

      s.lasers.push({
        id: Math.random().toString(),
        type: "wave",
        color: "#22c55e", // Bright Green
        x: s.width / 2,
        y: s.height / 2,
        radius: 5,
        maxRadius: Math.sqrt(s.width * s.width + s.height * s.height) / 2 + 50,
        warningTime: waveWarningTime, 
        maxWarningTime: waveWarningTime,
        activeTime: 2500, // how long ring expands
        maxActiveTime: 2500,
        isActive: false
      });
    } else if (canLine) {
      // 2. LINE LASER SPAWN
      // Line lasers start and end outside screen
      const orientation = Math.random() > 0.5 ? "horizontal" : "vertical";
      let x1 = 0, y1 = 0, x2 = 0, y2 = 0;

      if (orientation === "horizontal") {
        y1 = 50 + Math.random() * (s.height - 100);
        y2 = y1;
        x1 = -100;
        x2 = s.width + 100;
      } else {
        x1 = 50 + Math.random() * (s.width - 100);
        x2 = x1;
        y1 = -100;
        y2 = s.height + 100;
      }

      let lineWarningTime = 1300;
      if (difficulty === Difficulty.Dot0) lineWarningTime = 500;
      else if (difficulty === Difficulty.Hell) lineWarningTime = 700;
      else if (difficulty === Difficulty.Impossible) lineWarningTime = 900;
      else if (difficulty === Difficulty.Hard || difficulty === Difficulty.HardR) lineWarningTime = 1100;

      s.lasers.push({
        id: Math.random().toString(),
        type: "line",
        color: "#ef4444", // bright neon red
        x1, y1, x2, y2,
        warningTime: lineWarningTime, 
        maxWarningTime: lineWarningTime,
        activeTime: 400, // firing blast frame duration
        maxActiveTime: 400,
        isActive: false
      });
    }
  };

  // Renders the entire digital universe
  const draw = () => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear Screen with elegant retro pitch-black fade and subtle background grid
    ctx.fillStyle = "#0c0a0f"; // Extremely dark cybernetic violet
    ctx.fillRect(0, 0, s.width, s.height);

    // Screen shake: offset the ctx transform for the duration of shakeTimer
    if (screenShakeEnabledRef.current && s.shakeTimer > 0) {
      const intensity = (s.shakeIsTank ? 8 : 4) * screenShakeIntensityRef.current * (s.shakeTimer / (s.shakeIsTank ? 220 : 130));
      const dx = (Math.random() * 2 - 1) * intensity;
      const dy = (Math.random() * 2 - 1) * intensity;
      ctx.save();
      ctx.translate(dx, dy);
    }

    // Draw Cybernetic Grid Lines
    ctx.strokeStyle = "#1b1424";
    ctx.lineWidth = 1;
    const gridSize = 45;
    for (let x = 0; x < s.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, s.height);
      ctx.stroke();
    }
    for (let y = 0; y < s.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(s.width, y);
      ctx.stroke();
    }

    // DRAW DAMAGE ZONES (Vex pool)
    s.damageZones.forEach((dz) => {
      const p = dz.duration / dz.maxDuration;
      ctx.beginPath();
      ctx.arc(dz.x, dz.y, dz.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(220, 38, 38, ${0.15 * p})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(220, 38, 38, ${0.45 * p})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Outer rings
      ctx.beginPath();
      ctx.arc(dz.x, dz.y, dz.radius * (0.8 + Math.sin(Date.now() / 150) * 0.15), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.2 * p})`;
      ctx.stroke();
    });

    // DRAW ECHO GHOST RESIDUALS
    // DRAW PLOUM FIRE RESIDUES
    // DRAW PLOUM PULLS (contracting vacuum ring)


    s.ploumResidues.forEach((r) => {
      const p = r.duration / r.maxDuration; // 1 at spawn, 0 at death
      const grad = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, r.radius);
      grad.addColorStop(0, `rgba(251, 146, 60, ${0.55 * p})`);
      grad.addColorStop(0.5, `rgba(239, 68, 68, ${0.35 * p})`);
      grad.addColorStop(1, `rgba(239, 68, 68, 0)`);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });

    s.echoGhosts.forEach((eg) => {
      ctx.beginPath();
      ctx.arc(eg.x, eg.y, eg.radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(20, 184, 166, 0.25)";
      ctx.fill();
      ctx.strokeStyle = "rgba(153, 246, 228, 0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Hologram lines
      ctx.beginPath();
      ctx.moveTo(eg.x - eg.radius - 5, eg.y);
      ctx.lineTo(eg.x + eg.radius + 5, eg.y);
      ctx.stroke();
    });

    // DRAW EXPANDING VISUAL SHOCKWAVES
    s.shockwaves.forEach((sw: any) => {
      // p=1 at spawn, p=0 at end — for contracting waves, radius shrinks so invert
      const p = sw.speed < 0 ? sw.radius / sw.maxRadius : 1.0 - (sw.radius / sw.maxRadius);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 1.5 + p * 4.5;
      if (sw.arcAngle !== undefined) {
        // Katsune: draw a curved arc crescent in the travel direction
        const spread = Math.PI * 0.20625; // arc spans ~37 degrees (0.5x previous)
        const startA = sw.arcAngle - spread / 2;
        const endA = sw.arcAngle + spread / 2;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, Math.max(1, sw.radius), startA, endA);
        ctx.stroke();
        // Inner bright core line
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, Math.max(1, sw.radius), startA, endA);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // DRAW SHIELD POWER UPS
    s.shieldPowerUps.forEach((sp) => {
      const bounce = Math.sin(sp.pulsePhase) * 3;
      // Core glowing circle
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.radius + bounce, 0, Math.PI * 2);
      ctx.strokeStyle = "#22d3ee"; // cyan
      ctx.lineWidth = 2.5;
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      // Cyber shield crest crosshair
      ctx.beginPath();
      ctx.moveTo(sp.x - sp.radius - 4, sp.y);
      ctx.lineTo(sp.x + sp.radius + 4, sp.y);
      ctx.moveTo(sp.x, sp.y - sp.radius - 4);
      ctx.lineTo(sp.x, sp.y + sp.radius + 4);
      ctx.strokeStyle = "rgba(34, 211, 238, 0.4)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // DRAW LASERS
    s.lasers.forEach((laser) => {
      if (!laser.isActive) {
        // Warning Blink Stage
        const blink = Math.floor(Date.now() / 110) % 2 === 0;
        if (laser.type === "line") {
          ctx.strokeStyle = laser.color;
          ctx.lineWidth = blink ? 1.5 : 0.3;
          ctx.beginPath();
          ctx.moveTo(laser.x1 || 0, laser.y1 || 0);
          ctx.lineTo(laser.x2 || 0, laser.y2 || 0);
          ctx.stroke();

          // Laser borders warning tags
          if (blink) {
            ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
            ctx.fillRect((laser.x1 || 0) - 25, (laser.y1 || 0) - 25, 50, 50);
            ctx.fillRect((laser.x2 || 0) - 25, (laser.y2 || 0) - 25, 50, 50);
          }
        } else if (laser.type === "wave") {
          // Wave warning blink at the exact center coordinates
          if (blink) {
            ctx.beginPath();
            ctx.arc(laser.x || 0, laser.y || 0, 48, 0, Math.PI * 2);
            ctx.strokeStyle = "#22c55e"; // Green wave laser warning color
            ctx.lineWidth = 3;
            ctx.stroke();

            // Center radar cross
            ctx.beginPath();
            ctx.moveTo((laser.x || 0) - 40, laser.y || 0); ctx.lineTo((laser.x || 0) + 40, laser.y || 0);
            ctx.moveTo(laser.x || 0, (laser.y || 0) - 40); ctx.lineTo(laser.x || 0, (laser.y || 0) + 40);
            ctx.lineWidth = 1;
            ctx.stroke();

            // text "WARNING"
            ctx.fillStyle = "#22c55e";
            ctx.font = "800 12px 'JetBrains Mono', monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("SONIC WAVE LAUNCH", laser.x || 0, (laser.y || 0) - 62);
          }
        }
      } else {
        // Active Firing Stage!
        if (laser.type === "line") {
          // Huge red white-middle beam
          ctx.strokeStyle = "rgba(239, 68, 68, 0.35)";
          ctx.lineWidth = (30 + Math.sin(Date.now() / 10) * 8) * BIG;
          ctx.beginPath();
          ctx.moveTo(laser.x1 || 0, laser.y1 || 0);
          ctx.lineTo(laser.x2 || 0, laser.y2 || 0);
          ctx.stroke();

          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 6;
          ctx.stroke();
        } else if (laser.type === "wave") {
          // Expanding Green wave ring
          if (laser.radius !== undefined) {
            ctx.beginPath();
            ctx.arc(laser.x || 0, laser.y || 0, laser.radius, 0, Math.PI * 2);
            ctx.strokeStyle = "#22c55e"; // bright neon green wave
            ctx.lineWidth = 5 + Math.sin(Date.now() / 20) * 2; // thin, not BIG-scaled
            ctx.stroke();

            // Inner flare
            ctx.beginPath();
            ctx.arc(laser.x || 0, laser.y || 0, laser.radius, 0, Math.PI * 2);
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      }
    });

    // DRAW INCOMING PROJECTILES
    s.projectiles.forEach((proj) => {
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
      ctx.fillStyle = proj.color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();

      // tail particle effect
      ctx.beginPath();
      ctx.arc(proj.x - proj.vx * 3, proj.y - proj.vy * 3, proj.radius * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(249, 115, 22, 0.4)";
      ctx.fill();
    });

    // DRAW ALL ENEMIES
    const nowMs = Date.now();
    s.enemies.forEach((enemy: any) => {
      const isFrozen = !!(enemy.frozenUntil && nowMs < enemy.frozenUntil);

      ctx.save();
      if (isFrozen) {
        ctx.globalAlpha = 0.35;
      }

      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
      ctx.fillStyle = enemy.color;
      ctx.fill();

      // Distinct visual markings based on enemy style
      if (enemy.type === "tank") {
        // Hexagonal surrounding outer ring
        ctx.strokeStyle = "rgba(139, 92, 246, 0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
          const angle = (i * Math.PI) / 3;
          const hX = enemy.x + Math.cos(angle) * (enemy.radius + 5);
          const hY = enemy.y + Math.sin(angle) * (enemy.radius + 5);
          if (i === 0) ctx.moveTo(hX, hY);
          else ctx.lineTo(hX, hY);
        }
        ctx.stroke();
      } else if (enemy.type === "shooter") {
        // Warning sights
        ctx.strokeStyle = "rgba(249, 115, 22, 0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (enemy.type === "bullet_hell") {
        // Draw orbital spikes / neon crosshairs
        ctx.strokeStyle = "rgba(16, 185, 129, 0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 3, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(enemy.x - enemy.radius - 5, enemy.y);
        ctx.lineTo(enemy.x + enemy.radius + 5, enemy.y);
        ctx.moveTo(enemy.x, enemy.y - enemy.radius - 5);
        ctx.lineTo(enemy.x, enemy.y + enemy.radius + 5);
        ctx.stroke();
      } else if (enemy.type === "target_shooter") {
        // Triple-sight ring targeter
        ctx.strokeStyle = "rgba(168, 85, 247, 0.6)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      } else if (enemy.type === "fast") {
        // Tail trails
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y);
        ctx.lineTo(enemy.x - enemy.vx * 0.3, enemy.y - enemy.vy * 0.3);
        ctx.strokeStyle = "rgba(244, 63, 94, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Enemy core center point
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      ctx.restore();
    });

    // DRAW PARTICLES
    s.particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      if (p.shape === "square") {
        ctx.fillRect(p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1.0; // reset transparency

    // DRAW TELEPORT PREVIEW LINE (Unless Wraith)
    const isWraith = selectedDot.id === "wraith";
    if (!isWraith) {
      ctx.beginPath();
      ctx.moveTo(s.player.x, s.player.y);
      ctx.lineTo(s.mouse.x, s.mouse.y);
      // Literal line, no thickness, drawn beautifully neon-bright
      ctx.strokeStyle = `rgba(${selectedDot.id === "null" ? "244, 63, 94, 0.7" : "34, 211, 238, 0.7"})`; // Null dot shows red warning since it doesn't do line damage
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Cyber tracking tick marks every 30px
      const dx = s.mouse.x - s.player.x;
      const dy = s.mouse.y - s.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const points = Math.floor(dist / 35);
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      for (let i = 1; i < points; i++) {
        const frac = i / points;
        const px = s.player.x + dx * frac;
        const py = s.player.y + dy * frac;
        ctx.fillRect(px - 1, py - 1, 2, 2);
      }
    }

    // DRAW MICRO DROPS
    if (s.microDrops) {
      s.microDrops.forEach((drop) => {
        ctx.save();
        ctx.globalAlpha = drop.alpha * 0.9;
        ctx.fillStyle = "#c084fc";
        ctx.shadowColor = "#c084fc";
        ctx.shadowBlur = 8 * BIG;
        ctx.beginPath();
        ctx.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    // DRAW TELEPORT LASER LINE FLASH
    if ((s as any).teleportLine) {
      const tl = (s as any).teleportLine;
      ctx.save();
      ctx.globalAlpha = tl.alpha;
      // Outer glow
      ctx.strokeStyle = tl.color;
      ctx.lineWidth = 4 * BIG;
      ctx.shadowColor = tl.color;
      ctx.shadowBlur = 12 * BIG;
      ctx.beginPath();
      ctx.moveTo(tl.x1, tl.y1);
      ctx.lineTo(tl.x2, tl.y2);
      ctx.stroke();
      // Bright white core
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5 * BIG;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(tl.x1, tl.y1);
      ctx.lineTo(tl.x2, tl.y2);
      ctx.stroke();
      ctx.restore();
    }

    // DRAW CURRENT DOT POSITION
    ctx.beginPath();
    ctx.arc(s.player.x, s.player.y, s.player.radius, 0, Math.PI * 2);
    ctx.fillStyle = selectedDot.color;
    ctx.fill();
    ctx.strokeStyle = selectedDot.borderColor;
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // Invincibility shield halo around player
    if (s.player.isInvincible) {
      ctx.beginPath();
      ctx.arc(s.player.x, s.player.y, s.player.radius + 10, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(s.player.x, s.player.y, s.player.radius + 15, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // DRAW MOUSE POINTER BRIGHT DOT
    // "cursor also shows another one thats brighter and less vague."
    ctx.beginPath();
    ctx.arc(s.mouse.x, s.mouse.y, s.player.radius - 1, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = selectedDot.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Pulse rings on cursor
    ctx.beginPath();
    ctx.arc(s.mouse.x, s.mouse.y, s.player.radius + 6 + Math.sin(Date.now() / 100) * 3, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${selectedDot.id === "null" ? "244, 63, 94, 0.35" : "34, 211, 238, 0.35"})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // RENDER DEPLOYING NOTIFICATION OVERLAY
    if (!s.hasMoved) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Display a beautiful subtle instruction at the center bottom
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.font = "900 11px 'Space Grotesk', system-ui, sans-serif";
      ctx.fillText("CLICK TO START", s.width / 2, s.height / 2 + 100);
    }

    // Restore shake transform before fullscreen overlays (they should not shift)
    if (screenShakeEnabledRef.current && s.shakeTimer > 0) {
      ctx.restore();
    }

    // KILL FLASH
    if (killFlashEnabledRef.current && s.killFlashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${s.killFlashAlpha})`;
      ctx.fillRect(0, 0, s.width, s.height);
    }

    // DRAW GLINT HIT FULL-SCREEN FLASH
    if (s.glintFlashAlpha && s.glintFlashAlpha > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${s.glintFlashAlpha * 0.75})`;
      ctx.fillRect(0, 0, s.width, s.height);
    }

    // NEO DROP FREEZE FLASH
    if (s.neoFreezeFlashAlpha > 0) {
      ctx.fillStyle = `rgba(192, 132, 252, ${s.neoFreezeFlashAlpha * 0.35})`;
      ctx.fillRect(0, 0, s.width, s.height);
    }
  };

  const timerPanel = (
    <div className="flex flex-col items-center bg-[#0a0a0a] border border-[#333] px-5 py-2.5 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
      <div className="text-[9px] text-zinc-500 uppercase tracking-widest leading-none font-bold">ELAPSED</div>
      <div id="hud-timer" className="text-2xl font-black text-white py-1">{hudTime.toFixed(2)}s</div>
      <div className="text-[9px] bg-neon-red/10 border border-neon-red/50 text-neon-red px-2.5 py-0.5 uppercase tracking-widest font-black">
        {(customDifficulty ? customDifficulty.name : difficulty).toUpperCase()}
      </div>
    </div>
  );

  const sloPanel = (
    <div className="bg-[#0a0a0a] border border-[#333] p-3 flex flex-col select-none">
      <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold mb-1.5">SLO CHARGE</div>
      <div className="flex items-center gap-3">
        <span id="hud-slo-label" className="text-sm font-black text-neon-cyan glow-cyan">{hudSlo}</span>
        <div className="w-20 h-2 bg-[#050505] border border-[#333] p-0.5">
          <div
            id="hud-slo-bar"
            className="h-full transition-all duration-75 bg-neon-cyan"
            style={{ width: `${Math.min(100, (hudSlo / 150) * 100)}%`, boxShadow: "0 0 8px #00FFFF" }}
          />
        </div>
      </div>
    </div>
  );

  const isNeoDrop = selectedDot.id === "neo_drop" || selectedDot.id === NEO_DROP_ID;
  const freezePanel = isNeoDrop && (
    <div className={`border p-3 flex flex-col select-none ${hudFreezeReady ? "border-neon-purple bg-[#1a0a2a]" : "border-[#333] bg-[#0a0a0a]"}`}>
      <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold mb-1">FREEZE [SPACE]</div>
      {hudSlo < 100 ? (
        <div className="text-[10px] font-black text-zinc-600">NEED 100 SLO</div>
      ) : (
        <div className="text-[10px] font-black text-neon-purple animate-pulse">READY</div>
      )}
    </div>
  );

  const plointsPanel = (
    <div className="bg-[#0a0a0a] border-2 border-neon-magenta/40 text-neon-magenta p-2 flex items-center gap-2 select-none glow-magenta">
      <div className="text-[10px] uppercase font-black">PLOINTS:</div>
      <div id="hud-ploints-gained" className="text-xs font-black text-white">+{hudPlointsGained.toLocaleString()}</div>
    </div>
  );

  const exitButton = (
    <button
      onClick={() => { audio.playClick(); triggerGameOver(); }}
      className="text-[11px] text-zinc-400 hover:text-white transition-colors bg-[#0a0a0a] hover:bg-[#111] border border-[#333] hover:border-white px-3.5 py-1.5 font-black cursor-pointer pointer-events-auto"
    >
      [ESC] EXIT
    </button>
  );



  const hyperOverlay = isHyperSlo && (
    <div className="absolute inset-x-0 bottom-5 pointer-events-none flex justify-center z-10 select-none animate-pulse">
      <div className="bg-neon-magenta/25 border border-neon-magenta text-white px-4 py-1.5 text-[11px] font-mono uppercase tracking-widest text-center shadow-lg glow-magenta">
        HYPER SLO-MO INITIATED
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex bg-black" style={{ cursor: "none" }}>
        {/* LEFT SIDEBAR */}
        <div
          className="flex flex-col justify-between py-6 px-3 border-r border-[#1a1a1a] font-mono select-none shrink-0"
          style={{
            width: "160px",
            background: "linear-gradient(180deg, #050505 0%, #080808 50%, #050505 100%)",
          }}
        >
          <div className="flex flex-col gap-4">
            <div className="border-b border-[#1f1f1f] pb-3">
              <div className="text-[8px] text-zinc-600 uppercase tracking-[0.2em] font-black">SYSTEM</div>
              <div className="text-[11px] text-zinc-300 font-black tracking-widest mt-1">DOT</div>
            </div>
            {timerPanel}
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[8px] text-zinc-700 uppercase tracking-widest font-black border-t border-[#1a1a1a] pt-3 mb-1">CONTROLS</div>
            {exitButton}
          </div>
        </div>

        {/* GAME CANVAS */}
        <div ref={containerRef} className="relative flex-1 overflow-hidden bg-brutal-grid">
          <canvas
            ref={canvasRef}
            id="game-canvas"
            onMouseMove={trackMouseMove}
            onMouseDown={handleStageClick}
            className="w-full h-full block touch-none"
          />
          {hyperOverlay}
        </div>

        {/* RIGHT SIDEBAR */}
        <div
          className="flex flex-col justify-between py-6 px-3 border-l border-[#1a1a1a] font-mono select-none shrink-0"
          style={{
            width: "160px",
            background: "linear-gradient(180deg, #050505 0%, #080808 50%, #050505 100%)",
          }}
        >
          <div className="flex flex-col gap-3">
            <div className="border-b border-[#1f1f1f] pb-3">
              <div className="text-[8px] text-zinc-600 uppercase tracking-[0.2em] font-black">RESOURCES</div>
            </div>
            {sloPanel}
            {freezePanel}
            {plointsPanel}
            {hudShields > 0 && (
              <div className="bg-[#0a0a0a] border border-[#333] p-2 flex flex-col gap-1 select-none">
                <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">SHIELDS</div>
                <div className="flex gap-1">
                  {Array.from({ length: hudShields }).map((_, i) => (
                    <div key={i} className="w-3 h-3 bg-neon-cyan/80 border border-neon-cyan" style={{ boxShadow: "0 0 6px #00FFFF" }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-[8px] text-zinc-700 uppercase tracking-widest font-black border-t border-[#1a1a1a] pt-3">STATUS</div>
            <div className="text-[9px] text-zinc-600 font-mono">
              {invincible && <div className="text-yellow-500/70 font-black text-[8px] uppercase tracking-widest">INVINCIBLE</div>}
              {bigMode && <div className="text-purple-400/70 font-black text-[8px] uppercase tracking-widest">BIG MODE</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Normal layout
  return (
    <div
      ref={containerRef}
      id="game-viewport-container"
      className="relative w-full h-full min-h-[500px] overflow-hidden bg-brutal-grid flex flex-col justify-between select-none"
      style={{ cursor: "none", WebkitUserSelect: "none", userSelect: "none", touchAction: "none" }}
    >
      {/* Top HUD overlay */}
      <div className="absolute top-0 inset-x-0 p-5 flex justify-between items-start pointer-events-none z-10 font-mono text-zinc-300">
        <div></div>
        {timerPanel}
        <div className="flex flex-col gap-1.5 items-end">
          {sloPanel}
          {plointsPanel}
        </div>
      </div>

      {/* Main interactive Canvas */}
      <canvas
        ref={canvasRef}
        id="game-canvas"
        onMouseMove={trackMouseMove}
        onMouseDown={handleStageClick}
        className="w-full h-full block touch-none"
      />

      {hyperOverlay}

      {/* Bottom controls */}
      <div className="absolute bottom-4 left-4 z-10 font-mono flex gap-2">
        {exitButton}
      </div>
    </div>
  );
};