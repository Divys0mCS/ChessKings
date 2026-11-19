import { getAdminDb } from "../src/lib/firebase/admin";
import type { GameState } from "../src/shared/types";
import type { Challenge } from "../src/shared/types";

const GAMES = "games";
const CHALLENGES = "challenges";

function toDocument(game: GameState) {
  return {
    id: game.id,
    status: game.status,
    fen: game.fen,
    pgn: game.pgn,
    turn: game.turn,
    moves: game.moves.map((move) => ({
      san: move.san,
      from: move.from,
      to: move.to,
      color: move.color,
      promotion: move.promotion ?? null,
    })),
    lastMove: game.lastMove,
    whiteUid: game.white?.uid ?? null,
    blackUid: game.black?.uid ?? null,
    players: {
      white: game.white
        ? {
            uid: game.white.uid,
            displayName: game.white.displayName,
            rating: game.white.rating,
          }
        : null,
      black: game.black
        ? {
            uid: game.black.uid,
            displayName: game.black.displayName,
            rating: game.black.rating,
          }
        : null,
    },
    timeControl: game.timeControl,
    mode: game.mode,
    category: game.category,
    result: game.result,
    termination: game.termination,
    createdAt: game.createdAt,
    startedAt: game.startedAt,
    finishedAt: game.finishedAt,
  };
}

/** Best-effort persistence. The in-memory engine stays authoritative. */
export function persistGame(game: GameState): void {
  const db = getAdminDb();
  if (!db) return;

  db.collection(GAMES)
    .doc(game.id)
    .set(toDocument(game), { merge: true })
    .catch((error) => {
      console.warn(`[persistence] Failed to save game ${game.id}:`, error);
    });
}

/** Used by history/replay pages in a later phase. */
export async function loadGame(gameId: string): Promise<Record<string, unknown> | null> {
  const db = getAdminDb();
  if (!db) return null;
  const snapshot = await db.collection(GAMES).doc(gameId).get();
  return snapshot.exists ? (snapshot.data() ?? null) : null;
}

/** Firestore document shape for a challenge. */
interface ChallengeDocument {
  id: string;
  fromUid: string;
  fromDisplayName: string;
  toUid: string;
  toDisplayName: string;
  timeControl: { initialSec: number; incrementSec: number };
  mode: string;
  color: string;
  createdAt: number;
  expiresAt: number;
}

/** Persist a challenge to Firestore. Called when a challenge is created. */
export function persistChallenge(challenge: ChallengeDocument): void {
  const db = getAdminDb();
  if (!db) return;

  db.collection(CHALLENGES)
    .doc(challenge.id)
    .set({
      id: challenge.id,
      fromUid: challenge.fromUid,
      fromDisplayName: challenge.fromDisplayName,
      toUid: challenge.toUid,
      toDisplayName: challenge.toDisplayName,
      timeControl: challenge.timeControl,
      mode: challenge.mode,
      color: challenge.color,
      createdAt: challenge.createdAt,
      expiresAt: challenge.expiresAt,
    })
    .catch((error) => {
      console.warn(`[persistence] Failed to save challenge ${challenge.id}:`, error);
    });
}

/** Remove a challenge from Firestore. Called when accepted, cancelled, or expired. */
export function removeChallenge(challengeId: string): void {
  const db = getAdminDb();
  if (!db) return;

  db.collection(CHALLENGES)
    .doc(challengeId)
    .delete()
    .catch((error) => {
      console.warn(`[persistence] Failed to remove challenge ${challengeId}:`, error);
    });
}

/** Load active (not yet expired) challenges from Firestore. */
export async function loadActiveChallenges(uid: string): Promise<ChallengeDocument[]> {
  const db = getAdminDb();
  if (!db) return [];

  const now = Date.now();
  const snapshot = await db.collection(CHALLENGES)
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as ChallengeDocument)
    .filter((c) => c.expiresAt > now && c.toUid === uid)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Load outgoing (sent by this user) active challenges from Firestore. */
export async function loadOutgoingChallenges(uid: string): Promise<ChallengeDocument[]> {
  const db = getAdminDb();
  if (!db) return [];

  const now = Date.now();
  const snapshot = await db.collection(CHALLENGES)
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as ChallengeDocument)
    .filter((c) => c.expiresAt > now && c.fromUid === uid)
    .sort((a, b) => b.createdAt - a.createdAt);
}
