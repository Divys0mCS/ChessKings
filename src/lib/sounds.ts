export type SoundName = "move" | "capture" | "check" | "end" | "start";

let context: AudioContext | null = null;
let lastPlayed = 0;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  if (context.state === "suspended") void context.resume();
  return context;
}

function tone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
  type: OscillatorType = "triangle",
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function playSound(name: SoundName): void {
  const ctx = getContext();
  if (!ctx) return;

  const now = performance.now();
  if (name === "move" && now - lastPlayed < 35) return;
  lastPlayed = now;

  const t = ctx.currentTime;
  switch (name) {
    case "move":
      tone(ctx, 520, t, 0.07, 0.16);
      break;
    case "capture":
      tone(ctx, 300, t, 0.09, 0.18, "square");
      tone(ctx, 190, t + 0.03, 0.1, 0.12, "square");
      break;
    case "check":
      tone(ctx, 720, t, 0.08, 0.16);
      tone(ctx, 900, t + 0.09, 0.12, 0.16);
      break;
    case "end":
      tone(ctx, 440, t, 0.16, 0.14);
      tone(ctx, 330, t + 0.14, 0.2, 0.14);
      tone(ctx, 262, t + 0.3, 0.3, 0.12);
      break;
    case "start":
      tone(ctx, 392, t, 0.1, 0.12);
      tone(ctx, 523, t + 0.1, 0.14, 0.12);
      break;
  }
}
