import type { Category, TimeControl } from "./types";

export const DEFAULT_RATING = 1500;

export type TimeControlPreset = TimeControl & {
  id: string;
  label: string;
  category: Category;
};

export const TIME_CONTROLS: TimeControlPreset[] = [
  { id: "1+0", label: "1 min", initialSec: 60, incrementSec: 0, category: "bullet" },
  { id: "2+1", label: "2 | 1", initialSec: 120, incrementSec: 1, category: "bullet" },
  { id: "3+0", label: "3 min", initialSec: 180, incrementSec: 0, category: "blitz" },
  { id: "3+2", label: "3 | 2", initialSec: 180, incrementSec: 2, category: "blitz" },
  { id: "5+0", label: "5 min", initialSec: 300, incrementSec: 0, category: "blitz" },
  { id: "5+3", label: "5 | 3", initialSec: 300, incrementSec: 3, category: "blitz" },
  { id: "10+0", label: "10 min", initialSec: 600, incrementSec: 0, category: "rapid" },
  { id: "10+5", label: "10 | 5", initialSec: 600, incrementSec: 5, category: "rapid" },
  { id: "15+10", label: "15 | 10", initialSec: 900, incrementSec: 10, category: "rapid" },
];

/** Category follows the common estimated game duration rule (initial + 40 * increment). */
export function categoryFor(initialSec: number, incrementSec: number): Category {
  const estimated = initialSec + 40 * incrementSec;
  if (estimated < 180) return "bullet";
  if (estimated < 600) return "blitz";
  return "rapid";
}

/** Chess clocks round up to the next whole second above 20s and show tenths below. */
export function formatClock(ms: number): string {
  const seconds = Math.max(0, ms) / 1000;
  if (seconds < 20) return seconds.toFixed(1);
  const whole = Math.ceil(seconds);
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, "0")}`;
}

export function describeTimeControl(tc: TimeControl): string {
  return `${Math.round(tc.initialSec / 60) || 1} + ${tc.incrementSec}`;
}
