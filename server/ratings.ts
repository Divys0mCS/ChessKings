import { getAdminDb } from "../src/lib/firebase/admin";
import { DEFAULT_RATING } from "../src/shared/timeControl";
import type { Category } from "../src/shared/types";

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: number; at: number }>();

/** K-factor for rating changes. Higher = more change per game. */
export const K_FACTOR = 32;

/** Expected score for player with rating R against opponent with rating O. */
function expectedScore(selfRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - selfRating) / 400));
}

/**
 * Simple Elo update. Only called for rated games; casual games keep the
 * default 1500 and ratings are not written.
 *
 * @param currentRating Player's current rating
 * @param opponentRating Opponent's current rating
 * @param outcome "win", "loss", or "draw"
 * @returns New rating (rounded integer)
 */
export function updateRating(
  currentRating: number,
  opponentRating: number,
  outcome: "win" | "loss" | "draw",
): number {
  const score = outcome === "win" ? 1 : outcome === "loss" ? 0 : 0.5;
  return Math.round(currentRating + K_FACTOR * (score - expectedScore(currentRating, opponentRating)));
}

/**
 * Current rating for matchmaking. Reads `users/{uid}.ratings.<category>.rating`
 * when Firebase is configured, otherwise falls back to the default rating.
 */
export async function getPlayerRating(uid: string, category: Category): Promise<number> {
  const key = `${uid}:${category}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const db = getAdminDb();
  if (!db) return DEFAULT_RATING;

  try {
    const snapshot = await db.collection("users").doc(uid).get();
    const raw: unknown = snapshot.get(`ratings.${category}.rating`);
    const value =
      typeof raw === "number" && Number.isFinite(raw) ? raw : DEFAULT_RATING;
    cache.set(key, { value, at: Date.now() });
    return value;
  } catch (error) {
    console.error(`[ratings] failed to read rating for ${uid}:`, error);
    return DEFAULT_RATING;
  }
}
