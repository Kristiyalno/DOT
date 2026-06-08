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
  public playEnemyKill(isTank = false, pitchMult = 1.0) {
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
    gain.gain.setValueAtTime(isTank ? 0.45 : 0.35, this.ctx.currentTime);
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

    // Tank: add a deep tonal thud underneath for a heavier feel
    if (isTank) {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(80 * pitchMult, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.25);
      oscGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      oscGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
      osc.connect(oscGain);
      if (this.sfxGainNode) {
        oscGain.connect(this.sfxGainNode);
      } else {
        oscGain.connect(this.ctx.destination);
      }
      osc.start();
      osc.stop(this.ctx.currentTime + 0.26);
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