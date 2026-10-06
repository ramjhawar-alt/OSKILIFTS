import { Platform, Vibration } from 'react-native';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) audioContext = new Ctor();
  return audioContext;
}

/**
 * Browsers only allow audio after a user gesture, so call this from a tap
 * (e.g. when a set is checked) so the beep can play when the rest ends.
 */
export function primeRestAlert(): void {
  getAudioContext()?.resume?.().catch(() => undefined);
}

export function playRestOver(): void {
  if (Platform.OS !== 'web') {
    Vibration.vibrate([0, 300, 150, 300]);
    return;
  }
  try {
    (navigator as any).vibrate?.([200, 100, 200]);
    const ctx = getAudioContext();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.55);
  } catch {
    // Alerts are best-effort.
  }
}
