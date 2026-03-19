import type { SoundManager } from '../types.js';

export function createSoundManager(audioContext: AudioContext): SoundManager {
  let enabled = true;

  function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', gainValue = 0.3): void {
    if (!enabled) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gain.gain.setValueAtTime(gainValue, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + duration);
  }

  function playNote(frequency: number, startTime: number, duration: number, type: OscillatorType = 'sine', gainValue = 0.3): void {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(gainValue, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  const manager: SoundManager = {
    playCorrect(): void {
      if (!enabled) return;
      const now = audioContext.currentTime;
      // Ascending 2-note chime: C5 (523Hz) -> E5 (659Hz)
      playNote(523.25, now, 0.15);
      playNote(659.25, now + 0.1, 0.2);
    },

    playIncorrect(): void {
      if (!enabled) return;
      // Low buzz at 100Hz for 200ms
      playTone(100, 0.2, 'sawtooth', 0.2);
    },

    playStart(): void {
      if (!enabled) return;
      // Ascending glide C4 (262Hz) -> C5 (523Hz)
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(261.63, now);
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.4);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    },

    playEnd(): void {
      if (!enabled) return;
      const now = audioContext.currentTime;
      // Short fanfare: 3 ascending notes
      playNote(523.25, now, 0.15);        // C5
      playNote(659.25, now + 0.12, 0.15); // E5
      playNote(783.99, now + 0.24, 0.25); // G5
    },

    playTick(): void {
      if (!enabled) return;
      // Very short noise burst (10ms)
      const bufferSize = audioContext.sampleRate * 0.01;
      const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.3;
      }
      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime(0.2, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.01);
      source.connect(gain);
      gain.connect(audioContext.destination);
      source.start(audioContext.currentTime);
    },

    playLevelUp(): void {
      if (!enabled) return;
      const now = audioContext.currentTime;
      // Celebratory arpeggio: C5-E5-G5-C6
      playNote(523.25, now, 0.15);           // C5
      playNote(659.25, now + 0.1, 0.15);     // E5
      playNote(783.99, now + 0.2, 0.15);     // G5
      playNote(1046.50, now + 0.3, 0.3);     // C6
    },

    playBadge(): void {
      if (!enabled) return;
      // Sparkle: high frequency with decay
      const now = audioContext.currentTime;
      playNote(2093, now, 0.08, 'sine', 0.15);
      playNote(2637, now + 0.06, 0.1, 'sine', 0.12);
      playNote(3136, now + 0.12, 0.15, 'sine', 0.1);
      playNote(2637, now + 0.2, 0.2, 'sine', 0.08);
    },

    setEnabled(value: boolean): void {
      enabled = value;
    },

    isEnabled(): boolean {
      return enabled;
    },
  };

  return manager;
}
