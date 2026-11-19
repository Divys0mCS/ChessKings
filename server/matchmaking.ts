import { categoryFor } from "../src/shared/timeControl";
import type { FindMatchInput } from "../src/shared/schemas";
import type { Category, GameMode, TimeControl } from "../src/shared/types";
import { GameManager, gameRoom, type GameServer } from "./games";
import { getPlayerRating } from "./ratings";

export const MATCH_WINDOW_BASE = 100;
export const MATCH_WINDOW_STEP = 50;
export const MATCH_WINDOW_INTERVAL_MS = 5_000;
export const MATCH_WINDOW_MAX = 400;

/** How long after pairing a cancel may still abort the fresh game. */
export const MATCH_CANCEL_GRACE_MS = 10_000;

/** ±100 initially, widening by 50 every 5s, capped at ±400. */
export function matchWindow(waitedMs: number): number {
  const steps = Math.floor(Math.max(0, waitedMs) / MATCH_WINDOW_INTERVAL_MS);
  return Math.min(MATCH_WINDOW_MAX, MATCH_WINDOW_BASE + MATCH_WINDOW_STEP * steps);
}

type QueuedPlayer = {
  uid: string;
  displayName: string;
  socketId: string;
  rating: number;
  category: Category;
  timeControl: TimeControl;
  mode: GameMode;
  /** Queue bucket: exact time control + mode. */
  key: string;
  joinedAt: number;
};

/**
 * In-memory matchmaking queue. Rated players are paired inside an expanding
 * rating window; casual players are paired on time control alone.
 */
export class Matchmaker {
  private queue = new Map<string, QueuedPlayer>();
  /** uid -> the game it was just placed in, so a racing cancel can undo it. */
  private recentMatches = new Map<
    string,
    { gameId: string; opponentUid: string; at: number }
  >();
  private ticker: NodeJS.Timeout;

  constructor(
    private readonly io: GameServer,
    private readonly games: GameManager,
  ) {
    this.ticker = setInterval(() => this.scan(), 1_000);
    this.ticker.unref();
  }

  async add(
    user: { uid: string; displayName: string },
    socketId: string,
    input: FindMatchInput,
  ): Promise<{ window: number }> {
    const category = categoryFor(
      input.timeControl.initialSec,
      input.timeControl.incrementSec,
    );
    const rating = await getPlayerRating(user.uid, category);

    // The socket may have gone away while we read the rating.
    if (!this.io.sockets.sockets.has(socketId)) return { window: MATCH_WINDOW_BASE };

    // Re-queueing replaces any previous entry without a cancellation event.
    this.queue.delete(user.uid);

    const entry: QueuedPlayer = {
      uid: user.uid,
      displayName: user.displayName,
      socketId,
      rating,
      category,
      timeControl: input.timeControl,
      mode: input.mode,
      key: `${category}|${input.timeControl.initialSec}+${input.timeControl.incrementSec}|${input.mode}`,
      joinedAt: Date.now(),
    };

    this.queue.set(user.uid, entry);
    this.io.to(socketId).emit("matchmaking:searching", {
      timeControl: entry.timeControl,
      mode: entry.mode,
      window: MATCH_WINDOW_BASE,
    });

    this.scan();
    return { window: MATCH_WINDOW_BASE };
  }

  /**
   * Cancels a search. If pairing raced with the cancel, the fresh game is
   * aborted so the opponent is returned to the lobby instead of being stranded;
   * if the game already progressed, its id is returned so the client can join.
   */
  cancel(uid: string): { cancelled: boolean; gameId: string | null } {
    const entry = this.queue.get(uid);
    if (entry) {
      this.queue.delete(uid);
      this.io.to(entry.socketId).emit("matchmaking:cancelled", { reason: "user" });
      return { cancelled: true, gameId: null };
    }

    const recent = this.recentMatches.get(uid);
    if (!recent || Date.now() - recent.at > MATCH_CANCEL_GRACE_MS) {
      return { cancelled: false, gameId: null };
    }

    this.recentMatches.delete(uid);
    this.recentMatches.delete(recent.opponentUid);
    const aborted = this.games.abort(recent.gameId);
    return aborted
      ? { cancelled: true, gameId: null }
      : { cancelled: false, gameId: recent.gameId };
  }

  /** Drop queued entries for a socket that disconnected. */
  removeSocket(socketId: string): void {
    for (const [uid, entry] of this.queue) {
      if (entry.socketId === socketId) this.queue.delete(uid);
    }
  }

  stop(): void {
    clearInterval(this.ticker);
  }

  private scan(): void {
    for (const [uid, entry] of this.queue) {
      if (!this.io.sockets.sockets.has(entry.socketId)) this.queue.delete(uid);
    }

    const entries = [...this.queue.values()];
    const paired = new Set<string>();

    for (let i = 0; i < entries.length; i++) {
      const a = entries[i];
      if (paired.has(a.uid)) continue;

      for (let j = i + 1; j < entries.length; j++) {
        const b = entries[j];
        if (paired.has(b.uid) || a.key !== b.key) continue;
        if (!this.compatible(a, b)) continue;

        paired.add(a.uid);
        paired.add(b.uid);
        this.queue.delete(a.uid);
        this.queue.delete(b.uid);
        this.startMatch(a, b);
        break;
      }
    }
  }

  private compatible(a: QueuedPlayer, b: QueuedPlayer): boolean {
    if (a.mode === "casual") return true;
    const now = Date.now();
    const window = Math.min(
      matchWindow(now - a.joinedAt),
      matchWindow(now - b.joinedAt),
    );
    return Math.abs(a.rating - b.rating) <= window;
  }

  private startMatch(a: QueuedPlayer, b: QueuedPlayer): void {
    const aIsWhite = Math.random() < 0.5;
    const white = aIsWhite ? a : b;
    const black = aIsWhite ? b : a;

    const game = this.games.createMatched(
      { uid: white.uid, displayName: white.displayName, rating: white.rating },
      { uid: black.uid, displayName: black.displayName, rating: black.rating },
      { timeControl: a.timeControl, mode: a.mode },
    );

    this.attach(white, game.id);
    this.attach(black, game.id);

    this.trackRecentMatch(white, black, game.id);
    this.trackRecentMatch(black, white, game.id);

    this.io
      .to(white.socketId)
      .emit("matchmaking:found", { gameId: game.id, color: "white" });
    this.io
      .to(black.socketId)
      .emit("matchmaking:found", { gameId: game.id, color: "black" });

    console.log(
      `[matchmaking] ${white.uid} (white) vs ${black.uid} (black) game ${game.id} ${a.mode}`,
    );
  }

  private trackRecentMatch(
    entry: QueuedPlayer,
    opponent: QueuedPlayer,
    gameId: string,
  ): void {
    this.recentMatches.set(entry.uid, {
      gameId,
      opponentUid: opponent.uid,
      at: Date.now(),
    });
    const timer = setTimeout(() => {
      const current = this.recentMatches.get(entry.uid);
      if (current?.gameId === gameId) this.recentMatches.delete(entry.uid);
    }, MATCH_CANCEL_GRACE_MS);
    timer.unref();
  }

  private attach(entry: QueuedPlayer, gameId: string): void {
    const socket = this.io.sockets.sockets.get(entry.socketId);
    if (!socket) return;
    socket.join(gameRoom(gameId));
    this.games.join(
      gameId,
      { uid: entry.uid, displayName: entry.displayName },
      entry.socketId,
    );
  }
}
