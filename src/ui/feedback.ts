import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { load, save } from "./storage";

/**
 * Sound and haptic feedback. Sounds are synthesised with Web Audio, so the
 * app ships no audio files. Both can be switched off in Settings, and every
 * call is fire-and-forget: feedback must never break the game.
 */

export type Cue = "claim" | "combo" | "countered" | "warn" | "win" | "loss" | "draw" | "tap";

export const settings = {
  get sound(): boolean { return load("sound", true); },
  set sound(v: boolean) { save("sound", v); },
  get haptics(): boolean { return load("haptics", true); },
  set haptics(v: boolean) { save("haptics", v); },
};

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One short enveloped tone. */
function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.18): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const SOUNDS: Record<Cue, () => void> = {
  tap: () => tone(660, 0, 0.05, "triangle", 0.08),
  claim: () => { tone(420, 0, 0.07, "triangle", 0.12); tone(840, 0.02, 0.05, "sine", 0.05); },
  combo: () => [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.22, "triangle")),
  warn: () => { tone(880, 0, 0.09, "square", 0.07); tone(880, 0.14, 0.09, "square", 0.07); },
  countered: () => { tone(196, 0, 0.25, "sawtooth", 0.1); tone(147, 0.1, 0.3, "sawtooth", 0.08); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, "triangle")),
  loss: () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.14, 0.32, "sine")),
  draw: () => [440, 440].forEach((f, i) => tone(f, i * 0.16, 0.2, "sine")),
};

function haptic(cue: Cue): void {
  try {
    if (cue === "claim" || cue === "tap") void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    else if (cue === "combo" || cue === "win") void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    else if (cue === "countered" || cue === "loss" || cue === "warn") void Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
  } catch {
    /* no haptics on this device */
  }
}

export function cue(c: Cue): void {
  if (settings.sound) {
    try { SOUNDS[c](); } catch { /* audio unavailable */ }
  }
  if (settings.haptics) haptic(c);
}
