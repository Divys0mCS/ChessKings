import { Chess } from "chess.js";

const START_COUNTS: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };

export type CapturedMaterial = {
  /** Black pieces captured by White. */
  byWhite: string[];
  /** White pieces captured by Black. */
  byBlack: string[];
};

export function capturedMaterial(fen: string): CapturedMaterial {
  const counts: Record<"w" | "b", Record<string, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };

  try {
    const chess = new Chess(fen);
    for (const rank of chess.board()) {
      for (const square of rank) {
        if (!square || square.type === "k") continue;
        counts[square.color][square.type] = (counts[square.color][square.type] ?? 0) + 1;
      }
    }
  } catch {
    return { byWhite: [], byBlack: [] };
  }

  const missing = (color: "w" | "b") =>
    Object.entries(START_COUNTS).flatMap(([type, total]) =>
      Array<string>(Math.max(0, total - (counts[color][type] ?? 0))).fill(type),
    );

  return { byWhite: missing("b"), byBlack: missing("w") };
}
