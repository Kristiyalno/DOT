/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private musicInterval: any = null;
  private musicBPM = 135;
  private isMutedState = false;
  private volumeNode: GainNode | null = null;
  private musicGainNode: GainNode | null = null;
  private sfxGainNode: GainNode | null = null;
  private musicVolumeLevel = 1.0;
  private sfxVolumeLevel = 1.0;
  private currentTrackStep = 0;

  constructor() {
    // Audio Context is initialized lazily upon first interaction.
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
        this.volumeNode = this.ctx.createGain();
        this.volumeNode.gain.setValueAtTime(this.isMutedState ? 0 : 1.0, this.ctx.currentTime);
        this.volumeNode.connect(this.ctx.destination);

        this.musicGainNode = this.ctx.createGain();
        this.musicGainNode.gain.setValueAtTime(this.musicVolumeLevel, this.ctx.currentTime);
        this.musicGainNode.connect(this.volumeNode);

        this.sfxGainNode = this.ctx.createGain();
        this.sfxGainNode.gain.setValueAtTime(this.sfxVolumeLevel, this.ctx.currentTime);
        this.sfxGainNode.connect(this.volumeNode);
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public toggleMute() {
    this.isMutedState = !this.isMutedState;
    if (this.volumeNode && this.ctx) {
      this.volumeNode.gain.setValueAtTime(this.isMutedState ? 0 : 1.15, this.ctx.currentTime);
    }
    return this.isMutedState;
  }

  public get isMuted() {
    return this.isMutedState;
  }

  public setMusicVolume(v: number) {
    this.musicVolumeLevel = Math.max(0, Math.min(1, v));
    if (this.musicGainNode && this.ctx) {
      this.musicGainNode.gain.setValueAtTime(this.musicVolumeLevel, this.ctx.currentTime);
    }
  }

  public setSfxVolume(v: number) {
    this.sfxVolumeLevel = Math.max(0, Math.min(1, v));
    if (this.sfxGainNode && this.ctx) {
      this.sfxGainNode.gain.setValueAtTime(this.sfxVolumeLevel, this.ctx.currentTime);
    }
  }

  public get musicVolume() { return this.musicVolumeLevel; }
  public get sfxVolume() { return this.sfxVolumeLevel; }

  // SFX: Quick ascending beep for teleportation
  public playTeleport() {
    this.initCtx();
    if (!this.ctx || this.isMutedState) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.32, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    if (this.sfxGainNode) {
      gain.connect(this.sfxGainNode);
    } else {
      gain.connect(this.ctx.destination);
    }

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  // SFX: Sharp laser blast
  public playLaserFire(isWave = false) {
    this.initCtx();
    if (!this.ctx || this.isMutedState) return;

    const duration = isWave ? 0.35 : 0.25;
    const osc = this.ctx.createOscillator();
    const noise = this.createNoiseBuffer();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(isWave ? 80 : 220, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + duration);

    gain.gain.setValueAtTime(0.42, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);

    if (noise) {
      const noiseSource = this.ctx.createBufferSource();
      const noiseGain = this.ctx.createGain();
      noiseSource.buffer = noise;
      noiseGain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      noiseSource.connect(noiseGain);
      if (this.sfxGainNode) {
        noiseGain.connect(this.sfxGainNode);
      } else {
        noiseGain.connect(this.ctx.destination);
      }
      noiseSource.start();
    }

    if (this.sfxGainNode) {
      gain.connect(this.sfxGainNode);
    } else {
      gain.connect(this.ctx.destination);
    }

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  // SFX: High-pitched alarm chirp for laser warning
  public playLaserWarning() {
    this.initCtx();
    if (!this.ctx || this.isMutedState) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.setValueAtTime(600, this.ctx.currentTime + 0.05);
    osc.frequency.setValueAtTime(800, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    if (this.sfxGainNode) {
      gain.connect(this.sfxGainNode);
    } else {
      gain.connect(this.ctx.destination);
    }

    osc.start();
    osc.stop(this.ctx.currentTime + 0.16);
  }

  // SFX: Short metallic sound for shield impact or pickup
  public playShieldOption(isPickup: boolean) {
    this.initCtx();
    if (!this.ctx || this.isMutedState) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = "sine";
    osc2.type = "triangle";

    if (isPickup) {
      osc1.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.15);
      osc2.frequency.setValueAtTime(659, this.ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(1318, this.ctx.currentTime + 0.15);
    } else {
      // Shield cracked
      osc1.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.2);
      osc2.type = "sawtooth";
      osc2.frequency.setValueAtTime(250, this.ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.2);
    }

    gain.gain.setValueAtTime(0.28, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

    osc1.connect(gain);
    osc2.connect(gain);

    if (this.sfxGainNode) {
      gain.connect(this.sfxGainNode);
    } else {
      gain.connect(this.ctx.destination);
    }

    osc1.start();
    osc2.start();
    osc1.stop(this.ctx.currentTime + 0.22);
    osc2.stop(this.ctx.currentTime + 0.22);
  }

  // SFX: Enemy hit / kill crunchy noise burst
  // pitchMult > 1.0 raises pitch for combo escalation
  public playEnemyKill(isTank = false, pitchMult = 1.0, volumeMult = 1.0) {
    this.initCtx();
    if (!this.ctx || this.isMutedState) return;

    const noise = this.createNoiseBuffer();
    if (!noise) return;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    const baseFreq = isTank ? 200 : 500;
    filter.frequency.setValueAtTime(baseFreq * pitchMult, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(60 * pitchMult, this.ctx.currentTime + 0.15);

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noise;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime((isTank ? 0.45 : 0.35) * volumeMult, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.17);

    noiseSource.connect(filter);
    filter.connect(gain);

    if (this.sfxGainNode) {
      gain.connect(this.sfxGainNode);
    } else {
      gain.connect(this.ctx.destination);
    }

    noiseSource.start();
    noiseSource.stop(this.ctx.currentTime + 0.18);

    // Tonal "zing" oscillator — always present for tanks, and for combo hits (pitchMult > 1).
    // This is the primary carrier of the combo pitch escalation effect since filtered
    // white noise alone provides no perceptible pitch change.
    const shouldZing = isTank || pitchMult > 1.0;
    if (shouldZing) {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = isTank ? "sine" : "triangle";
      const baseNote = isTank ? 80 : 220;
      osc.frequency.setValueAtTime(baseNote * pitchMult, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(isTank ? 30 : 60, this.ctx.currentTime + 0.22);
      oscGain.gain.setValueAtTime((isTank ? 0.4 : 0.28) * volumeMult, this.ctx.currentTime);
      oscGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);
      osc.connect(oscGain);
      if (this.sfxGainNode) {
        oscGain.connect(this.sfxGainNode);
      } else {
        oscGain.connect(this.ctx.destination);
      }
      osc.start();
      osc.stop(this.ctx.currentTime + 0.24);
    }
  }

  // SFX: Glint high probability/crit item or slowdown
  public playGlintCrit() {
    this.initCtx();
    if (!this.ctx || this.isMutedState) return;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = "sine";
    osc2.type = "square";

    osc1.frequency.setValueAtTime(900, this.ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(2000, this.ctx.currentTime + 0.4);

    osc2.frequency.setValueAtTime(1100, this.ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(2400, this.ctx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.45);

    osc1.connect(gain);
    osc2.connect(gain);

    if (this.sfxGainNode) {
      gain.connect(this.sfxGainNode);
    } else {
      gain.connect(this.ctx.destination);
    }

    osc1.start();
    osc2.start();
    osc1.stop(this.ctx.currentTime + 0.5);
    osc2.stop(this.ctx.currentTime + 0.5);
  }

  // SFX: Menu click sound (little retro square/triangle sound)
  public playClick() {
    this.initCtx();
    if (!this.ctx || this.isMutedState) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, this.ctx.currentTime + 0.05); // E5

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    if (this.sfxGainNode) {
      gain.connect(this.sfxGainNode);
    } else {
      gain.connect(this.ctx.destination);
    }

    osc.start();
    osc.stop(this.ctx.currentTime + 0.13);
  }

  // SFX: Yawn — plays dedeniz_yawn_edited.mp3 at a configurable probability
  private yawnProbabilityValue = 0.01;
  private yawnAudio: HTMLAudioElement | null = null;

  public get yawnProbability() { return this.yawnProbabilityValue; }
  public setYawnProbability(v: number) { this.yawnProbabilityValue = Math.max(0, v); }

  public maybePlayYawn(baseUrl: string) {
    if (this.isMutedState) return;
    if (Math.random() >= this.yawnProbabilityValue) return;
    // Stop any currently playing yawn first
    if (this.yawnAudio) { this.yawnAudio.pause(); this.yawnAudio.currentTime = 0; }
    const a = new Audio(`${baseUrl}dedeniz_yawn_edited.mp3`);
    a.volume = Math.min(1, this.sfxVolumeLevel * 1.0);
    a.play().catch(() => {});
    this.yawnAudio = a;
  }

  // SFX: Dark and falling sound for game over
  public playGameOver() {
    this.initCtx();
    if (!this.ctx || this.isMutedState) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.65);

    gain.gain.setValueAtTime(0.48, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.65);

    osc.connect(gain);
    if (this.sfxGainNode) {
      gain.connect(this.sfxGainNode);
    } else {
      gain.connect(this.ctx.destination);
    }

    osc.start();
    osc.stop(this.ctx.currentTime + 0.7);
  }

  private createNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // EXTRA SFX: impact/whoosh/ambient sounds for abilities
  public playExtraSfx(type: "explosion" | "jolt_whoosh" | "pull_whoosh" | "ghost_dissolve" | "freeze" | "katsune_slash" | "wraith_blast" | "glint_crit_echo", volume: number) {
    this.initCtx();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const dest = this.sfxGainNode || ctx.destination;
    const t = ctx.currentTime;
    const vol = Math.max(0, volume);

    switch (type) {
      case "explosion": {
        // Low-pitch boom — very deep sine, slow decay
        const bo = ctx.createOscillator(); const bg = ctx.createGain();
        bo.type = "sine";
        bo.frequency.setValueAtTime(55, t);
        bo.frequency.exponentialRampToValueAtTime(12, t + 0.45);
        bg.gain.setValueAtTime(vol * 1.2, t);
        bg.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        bo.connect(bg); bg.connect(dest); bo.start(t); bo.stop(t + 0.55);
        // Very low noise rumble underneath
        const noise = this.createNoiseBuffer();
        if (noise) {
          const src = ctx.createBufferSource(); src.buffer = noise;
          const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(120, t);
          const g = ctx.createGain(); g.gain.setValueAtTime(vol * 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
          src.connect(f); f.connect(g); g.connect(dest); src.start(t); src.stop(t + 0.45);
        }
        break;
      }
      case "jolt_whoosh": {
        // Magnetic repulsion — two sine layers, punchy attack, fast decay
        const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
        o1.type = "sine";
        o1.frequency.setValueAtTime(200, t); o1.frequency.exponentialRampToValueAtTime(50, t + 0.18);
        g1.gain.setValueAtTime(vol * 0.55, t); g1.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o1.connect(g1); g1.connect(dest); o1.start(t); o1.stop(t + 0.22);
        const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
        o2.type = "sine";
        o2.frequency.setValueAtTime(90, t); o2.frequency.exponentialRampToValueAtTime(30, t + 0.15);
        g2.gain.setValueAtTime(vol * 0.4, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        o2.connect(g2); g2.connect(dest); o2.start(t); o2.stop(t + 0.2);
        break;
      }
      case "pull_whoosh": {
        // Gravitational pull — descending sine whomp then a low boom to lead into explosion
        const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
        o1.type = "sine";
        o1.frequency.setValueAtTime(250, t); o1.frequency.exponentialRampToValueAtTime(40, t + 0.25);
        g1.gain.setValueAtTime(vol * 0.5, t); g1.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        o1.connect(g1); g1.connect(dest); o1.start(t); o1.stop(t + 0.3);
        // Sub layer
        const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
        o2.type = "sine";
        o2.frequency.setValueAtTime(80, t); o2.frequency.exponentialRampToValueAtTime(20, t + 0.22);
        g2.gain.setValueAtTime(vol * 0.35, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o2.connect(g2); g2.connect(dest); o2.start(t); o2.stop(t + 0.28);
        break;
      }
      case "ghost_dissolve": {
        // Teal shimmer dissolve
        const osc = ctx.createOscillator(); const og = ctx.createGain();
        osc.type = "sine"; osc.frequency.setValueAtTime(900, t); osc.frequency.exponentialRampToValueAtTime(200, t + 0.4);
        og.gain.setValueAtTime(vol * 0.25, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.connect(og); og.connect(dest); osc.start(t); osc.stop(t + 0.45);
        const osc2 = ctx.createOscillator(); const og2 = ctx.createGain();
        osc2.type = "triangle"; osc2.frequency.setValueAtTime(1400, t); osc2.frequency.exponentialRampToValueAtTime(400, t + 0.3);
        og2.gain.setValueAtTime(vol * 0.15, t); og2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc2.connect(og2); og2.connect(dest); osc2.start(t); osc2.stop(t + 0.35);
        break;
      }
      case "freeze": {
        // Crystalline ice freeze — high descending shimmer
        const noise = this.createNoiseBuffer();
        if (noise) {
          const src = ctx.createBufferSource(); src.buffer = noise;
          const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.setValueAtTime(4000, t);
          const g = ctx.createGain(); g.gain.setValueAtTime(vol * 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
          src.connect(f); f.connect(g); g.connect(dest); src.start(t); src.stop(t + 0.55);
        }
        [1200, 1800, 2400].forEach((freq, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = "sine"; o.frequency.setValueAtTime(freq, t + i * 0.04);
          o.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.5 + i * 0.04);
          g.gain.setValueAtTime(vol * 0.12, t + i * 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5 + i * 0.04);
          o.connect(g); g.connect(dest); o.start(t + i * 0.04); o.stop(t + 0.55 + i * 0.04);
        });
        break;
      }
      case "katsune_slash": {
        // Sharp high-frequency slice
        const noise = this.createNoiseBuffer();
        if (noise) {
          const src = ctx.createBufferSource(); src.buffer = noise;
          const f = ctx.createBiquadFilter(); f.type = "bandpass";
          f.frequency.setValueAtTime(6000, t); f.frequency.exponentialRampToValueAtTime(1000, t + 0.12);
          f.Q.setValueAtTime(3.0, t);
          const g = ctx.createGain(); g.gain.setValueAtTime(vol * 0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
          src.connect(f); f.connect(g); g.connect(dest); src.start(t); src.stop(t + 0.18);
        }
        break;
      }
      case "wraith_blast": {
        // Heavy thud — deep sine punch, no rasp
        const o1 = ctx.createOscillator(); const g1 = ctx.createGain();
        o1.type = "sine";
        o1.frequency.setValueAtTime(80, t);
        o1.frequency.exponentialRampToValueAtTime(22, t + 0.28);
        g1.gain.setValueAtTime(vol * 1.1, t);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        o1.connect(g1); g1.connect(dest); o1.start(t); o1.stop(t + 0.35);
        // Sub layer for weight
        const o2 = ctx.createOscillator(); const g2 = ctx.createGain();
        o2.type = "sine";
        o2.frequency.setValueAtTime(40, t);
        o2.frequency.exponentialRampToValueAtTime(10, t + 0.22);
        g2.gain.setValueAtTime(vol * 0.7, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o2.connect(g2); g2.connect(dest); o2.start(t); o2.stop(t + 0.28);
        break;
      }
      case "glint_crit_echo": {
        // Crystalline reverb echo after glint crit
        [0, 0.1, 0.22].forEach((delay, i) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = "sine"; o.frequency.setValueAtTime(2200 - i * 300, t + delay);
          g.gain.setValueAtTime(vol * (0.18 - i * 0.05), t + delay);
          g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.2);
          o.connect(g); g.connect(dest); o.start(t + delay); o.stop(t + delay + 0.25);
        });
        break;
      }
    }
  }

  // SFX: Neo Drop unlock — shake/fizz buildup, then big knock transformation
  public playNeoDropUnlock() {
    this.initCtx();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const dest = this.sfxGainNode || ctx.destination;
    const t = ctx.currentTime;

    // Phase 1: Fizzy friction / shaking sound (0 - 2.5s)
    // Repeated bursts of filtered noise to simulate something vibrating under pressure
    for (let i = 0; i < 8; i++) {
      const noise = this.createNoiseBuffer();
      if (!noise) continue;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const filt = ctx.createBiquadFilter();
      filt.type = "bandpass";
      // Frequency rises over the shake period
      filt.frequency.setValueAtTime(300 + i * 80, t + i * 0.28);
      filt.Q.setValueAtTime(2.0, t + i * 0.28);
      const g = ctx.createGain();
      const burstT = t + i * 0.28;
      g.gain.setValueAtTime(0.0, burstT);
      g.gain.linearRampToValueAtTime(0.25 + i * 0.02, burstT + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, burstT + 0.22);
      src.connect(filt); filt.connect(g); g.connect(dest);
      src.start(burstT); src.stop(burstT + 0.25);
    }

    // Phase 2: Rising tension hum during shake (0 - 2.4s)
    const humOsc = ctx.createOscillator();
    const humGain = ctx.createGain();
    humOsc.type = "sawtooth";
    humOsc.frequency.setValueAtTime(55, t);
    humOsc.frequency.exponentialRampToValueAtTime(180, t + 2.4);
    humGain.gain.setValueAtTime(0.0, t);
    humGain.gain.linearRampToValueAtTime(0.18, t + 0.3);
    humGain.gain.setValueAtTime(0.18, t + 2.2);
    humGain.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
    humOsc.connect(humGain); humGain.connect(dest);
    humOsc.start(t); humOsc.stop(t + 2.6);

    // Phase 3: Big knock / impact at 2.5s
    const knockOsc = ctx.createOscillator();
    const knockGain = ctx.createGain();
    knockOsc.type = "sine";
    knockOsc.frequency.setValueAtTime(90, t + 2.5);
    knockOsc.frequency.exponentialRampToValueAtTime(18, t + 2.9);
    knockGain.gain.setValueAtTime(1.1, t + 2.5);
    knockGain.gain.exponentialRampToValueAtTime(0.001, t + 2.9);
    knockOsc.connect(knockGain); knockGain.connect(dest);
    knockOsc.start(t + 2.5); knockOsc.stop(t + 3.0);

    // Phase 3b: Knock noise burst
    const knockNoise = this.createNoiseBuffer();
    if (knockNoise) {
      const src = ctx.createBufferSource();
      src.buffer = knockNoise;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(600, t + 2.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.7, t + 2.5);
      g.gain.exponentialRampToValueAtTime(0.001, t + 2.75);
      src.connect(f); f.connect(g); g.connect(dest);
      src.start(t + 2.5); src.stop(t + 2.8);
    }

    // Phase 4: Triumphant rising tones after transformation (2.8 - 5s)
    const notes = [220, 329.63, 440];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i === 0 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq * 0.4, t + 2.8 + i * 0.08);
      osc.frequency.exponentialRampToValueAtTime(freq, t + 3.2 + i * 0.08);
      g.gain.setValueAtTime(0.0, t + 2.8 + i * 0.08);
      g.gain.linearRampToValueAtTime(0.2 - i * 0.03, t + 3.3 + i * 0.08);
      g.gain.setValueAtTime(0.2 - i * 0.03, t + 4.2);
      g.gain.exponentialRampToValueAtTime(0.001, t + 5.0);
      osc.connect(g); g.connect(dest);
      osc.start(t + 2.8 + i * 0.08); osc.stop(t + 5.1);
    });

    // Phase 5: Sparkle ping at end (4.3s)
    const sparkOsc = ctx.createOscillator();
    const sparkGain = ctx.createGain();
    sparkOsc.type = "sine";
    sparkOsc.frequency.setValueAtTime(1800, t + 4.3);
    sparkOsc.frequency.exponentialRampToValueAtTime(3600, t + 4.7);
    sparkGain.gain.setValueAtTime(0.18, t + 4.3);
    sparkGain.gain.exponentialRampToValueAtTime(0.001, t + 4.8);
    sparkOsc.connect(sparkGain); sparkGain.connect(dest);
    sparkOsc.start(t + 4.3); sparkOsc.stop(t + 4.9);
  }

  // BACKGROUND CHIPTUNE SYNTH
  public startMusic() {
    this.initCtx();
    if (this.musicInterval) return;

    const stepDuration = 60 / this.musicBPM / 2; // eighth notes

    // Loops a cool robotic synthesizer arpeggio
    this.musicInterval = setInterval(() => {
      if (this.isMutedState || !this.ctx) return;

      const BassPath = [36, 36, 43, 43, 39, 39, 41, 41, 36, 36, 48, 48, 43, 43, 46, 46]; // Midi notes
      const LeadPath = [
        60, 63, 67, 72, 70, 67, 63, 65,
        60, 63, 67, 72, 75, 74, 70, 72
      ];

      const currentStep = this.currentTrackStep % 16;
      const bassNote = BassPath[currentStep % BassPath.length];
      const leadNote = LeadPath[currentStep % LeadPath.length];

      // Bass note (subtle triangle wave)
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bassOsc.type = "triangle";
      bassOsc.frequency.setValueAtTime(this.midiToFreq(bassNote), this.ctx.currentTime);
      bassGain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      bassGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + stepDuration * 0.9);
      bassOsc.connect(bassGain);
      if (this.musicGainNode) {
        bassGain.connect(this.musicGainNode);
      } else {
        bassGain.connect(this.ctx.destination);
      }
      bassOsc.start();
      bassOsc.stop(this.ctx.currentTime + stepDuration);

      // Lead note on sixteenth / syncopated notes (occasionally)
      if (currentStep % 2 === 0 || currentStep % 3 === 0) {
        const leadOsc = this.ctx.createOscillator();
        const leadGain = this.ctx.createGain();
        leadOsc.type = "triangle"; // Nice retro square or triangle
        leadOsc.frequency.setValueAtTime(this.midiToFreq(leadNote), this.ctx.currentTime);
        leadGain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        leadGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + stepDuration * 0.55);
        leadOsc.connect(leadGain);
        if (this.musicGainNode) {
          leadGain.connect(this.musicGainNode);
        } else {
          leadGain.connect(this.ctx.destination);
      }
        leadOsc.start();
        leadOsc.stop(this.ctx.currentTime + stepDuration * 0.6);
      }

      // Simple synthesized retro-drum snare/hat
      if (currentStep % 4 === 2) {
        // Snare burst
        this.playDrumHat(0.05, 0.08, 1000);
      } else if (currentStep % 2 === 0) {
        // Closed hat burst
        this.playDrumHat(0.015, 0.055, 6000);
      }

      this.currentTrackStep++;
    }, stepDuration * 1000);
  }

  public stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  private playDrumHat(duration: number, volume: number, filterFreq: number) {
    if (!this.ctx || this.isMutedState) return;
    const noise = this.createNoiseBuffer();
    if (!noise) return;

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noise;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(filterFreq, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    noiseSource.connect(filter);
    filter.connect(gain);
    if (this.sfxGainNode) {
      gain.connect(this.sfxGainNode);
    } else {
      gain.connect(this.ctx.destination);
    }

    noiseSource.start();
    noiseSource.stop(this.ctx.currentTime + duration + 0.01);
  }

  private midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
}

export const audio = new AudioEngine();