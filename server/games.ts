import { randomUUID } from "node:crypto";
import { Chess } from "chess.js";
import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../src/shared/events";
import type { CreateGameInput, MoveInput } from "../src/shared/schemas";
import { categoryFor, DEFAULT_RATING } from "../src/shared/timeControl";
import type {
  Category,
  GameMode,
  GameResult,
  GameState,
  GameStatus,
  MoveRecord,
  PlayerColor,
  PlayerSummary,
  PromotionPiece,
  Termination,
  TimeControl,
} from "../src/shared/types";
import { persistGame } from "./persistence";
import { updateRating, K_FACTOR } from "../server/ratings";
import { getAdminDb } from "../src/lib/firebase/admin";
import { arrayUnion } from "firebase/firestore";
export type GameServer = Server<

  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export const DISCONNECT_FORFEIT_MS = 60_000;
const WAITING_GAME_TTL_MS = 30 * 60_000;
const FINISHED_GAME_TTL_MS = 15 * 60_000;
const CLOCK_SYNC_MS = 5_000;

type Player = {
  uid: string;
  displayName: string;
  rating: number;
  sockets: Set<string>;
};

type LiveGame = {
  id: string;
  chess: Chess;
  players: Record<PlayerColor, Player | null>;
  timeControl: TimeControl;
  mode: GameMode;
  category: Category;
  status: GameStatus;
  clocks: Record<PlayerColor, number>;
  turnStartedAt: number | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  moves: MoveRecord[];
  lastMove: { from: string; to: string } | null;
  drawOfferBy: string | null;
  result: GameResult | null;
  termination: Termination | null;
  turnTimer: NodeJS.Timeout | null;
  syncTimer: NodeJS.Timeout | null;
  waitingTimer: NodeJS.Timeout | null;
  cleanupTimer: NodeJS.Timeout | null;
  forfeitTimers: Map<string, NodeJS.Timeout>;
};

export class GameError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "GameError";
  }
}

export function gameRoom(gameId: string): string {
  return `game:${gameId}`;
}

function other(color: PlayerColor): PlayerColor {
  return color === "white" ? "black" : "white";
}

function colorFromTurn(turn: "w" | "b"): PlayerColor {
  return turn === "w" ? "white" : "black";
}

export class GameManager {
  private games = new Map<string, LiveGame>();
  private socketGames = new Map<string, Set<string>>();

  constructor(private readonly io: GameServer) {}

  create(
    user: { uid: string; displayName: string },
    input: CreateGameInput,
    options?: {
      rating?: number;
      opponent?: { uid: string; displayName: string; rating: number };
    },
  ): GameState {
    const now = Date.now();
    const initialMs = input.timeControl.initialSec * 1000;

    const game: LiveGame = {
      id: randomUUID().replace(/-/g, "").slice(0, 12),
      chess: new Chess(),
      players: {
        white: {
          uid: user.uid,
          displayName: user.displayName,
          rating: options?.rating ?? DEFAULT_RATING,
          sockets: new Set(),
        },
        black: options?.opponent
          ? { ...options.opponent, sockets: new Set() }
          : null,
      },
      timeControl: input.timeControl,
      mode: input.mode,
      category: categoryFor(input.timeControl.initialSec, input.timeControl.incrementSec),
      status: "waiting",
      clocks: { white: initialMs, black: initialMs },
      turnStartedAt: null,
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      moves: [],
      lastMove: null,
      drawOfferBy: null,
      result: null,
      termination: null,
      turnTimer: null,
      syncTimer: null,
      waitingTimer: null,
      cleanupTimer: null,
      forfeitTimers: new Map(),
    };

    game.waitingTimer = setTimeout(() => {
      if (game.status === "waiting") {
        this.dropGame(game.id);
        this.io.to(gameRoom(game.id)).emit("server:error", {
          code: "game_expired",
          message: "This game expired because no opponent joined.",
        });
      }
    }, WAITING_GAME_TTL_MS);

    this.games.set(game.id, game);
    const state = this.toState(game);
    persistGame(state);
    return state;
  }

  /** Seats both players up front (matchmaking); join() still attaches their sockets. */
  createMatched(
    white: { uid: string; displayName: string; rating: number },
    black: { uid: string; displayName: string; rating: number },
    input: CreateGameInput,
  ): GameState {
    return this.create(white, input, { rating: white.rating, opponent: black });
  }

  join(gameId: string, user: { uid: string; displayName: string }, socketId: string): GameState {
    const game = this.requireGame(gameId);

    let color = this.colorOf(game, user.uid);
    if (!color && game.status !== "finished") {
      color = this.seatOf(game, user.uid);
    }

    if (color) {
      const existing = game.players[color];
      const player: Player = existing ?? {
        uid: user.uid,
        displayName: user.displayName,
        rating: DEFAULT_RATING,
        sockets: new Set(),
      };
      player.sockets.add(socketId);
      game.players[color] = player;

      const forfeit = game.forfeitTimers.get(user.uid);
      if (forfeit) {
        clearTimeout(forfeit);
        game.forfeitTimers.delete(user.uid);
      }

      this.trackSocket(socketId, gameId);
      this.io.to(gameRoom(gameId)).emit("game:presence", {
        gameId,
        uid: user.uid,
        connected: true,
        disconnectInMs: null,
      });
    }

    if (game.status === "waiting" && game.players.white && game.players.black) {
      this.start(game);
    } else {
      this.io.to(gameRoom(gameId)).emit("game:state", this.toState(game));
    }

    const state = this.toState(game);
    persistGame(state);
    return state;
  }

  move(user: { uid: string }, input: MoveInput): GameState {
    const game = this.requireGame(input.gameId);
    if (game.status === "waiting") {
      throw new GameError("not_started", "Waiting for an opponent to join.");
    }
    if (game.status !== "active") {
      throw new GameError("finished", "This game is already over.");
    }

    const color = this.colorOf(game, user.uid);
    if (!color) throw new GameError("not_player", "You are not a player in this game.");

    const turn = colorFromTurn(game.chess.turn());
    if (color !== turn) throw new GameError("not_your_turn", "It is not your turn.");

    const now = Date.now();
    const elapsed = game.turnStartedAt ? now - game.turnStartedAt : 0;
    const remaining = game.clocks[turn] - elapsed;
    if (remaining <= 0) {
      game.clocks[turn] = 0;
      this.finish(game, other(turn), "timeout");
      throw new GameError("timeout", "Your time ran out.");
    }

    let move;
    try {
      move = game.chess.move({
        from: input.from,
        to: input.to,
        promotion: input.promotion ?? undefined,
      });
    } catch {
      throw new GameError("illegal_move", "That move is not legal.");
    }

    game.clocks[turn] = remaining + game.timeControl.incrementSec * 1000;
    game.turnStartedAt = now;
    game.drawOfferBy = null;
    game.lastMove = { from: move.from, to: move.to };

    const record: MoveRecord = {
      san: move.san,
      from: move.from,
      to: move.to,
      color,
      promotion: move.promotion as PromotionPiece | undefined,
    };
    game.moves.push(record);

    this.checkEndConditions(game, turn);

    const state = this.toState(game);
    this.io.to(gameRoom(game.id)).emit("game:move", {
      gameId: game.id,
      game: state,
      move: record,
    });

    if (game.status === "active") {
      this.armTurnTimer(game);
      this.emitClock(game);
    }

    persistGame(state);
    return state;
  }

  resign(user: { uid: string }, gameId: string): void {
    const game = this.requireGame(gameId);
    this.requireActivePlayer(game, user.uid);
    const color = this.colorOf(game, user.uid);
    if (!color) throw new GameError("not_player", "You are not a player in this game.");
    this.finish(game, other(color), "resignation");
  }

  offerDraw(user: { uid: string }, gameId: string): void {
    const game = this.requireGame(gameId);
    this.requireActivePlayer(game, user.uid);
    if (game.drawOfferBy === user.uid) return;
    game.drawOfferBy = user.uid;
    this.io.to(gameRoom(gameId)).emit("game:draw-offered", { gameId, by: user.uid });
    this.io.to(gameRoom(gameId)).emit("game:state", this.toState(game));
  }

  acceptDraw(user: { uid: string }, gameId: string): void {
    const game = this.requireGame(gameId);
    this.requireActivePlayer(game, user.uid);
    if (!game.drawOfferBy) throw new GameError("no_offer", "There is no draw offer to accept.");
    if (game.drawOfferBy === user.uid) {
      throw new GameError("own_offer", "You cannot accept your own draw offer.");
    }
    this.finish(game, "draw", "draw-agreement");
  }

  declineDraw(user: { uid: string }, gameId: string): void {
    const game = this.requireGame(gameId);
    this.requireActivePlayer(game, user.uid);
    if (!game.drawOfferBy || game.drawOfferBy === user.uid) {
      throw new GameError("no_offer", "There is no draw offer to decline.");
    }
    game.drawOfferBy = null;
    this.io.to(gameRoom(gameId)).emit("game:draw-declined", { gameId, by: user.uid });
    this.io.to(gameRoom(gameId)).emit("game:state", this.toState(game));
  }

  leaveSocket(socketId: string): void {
    const gameIds = this.socketGames.get(socketId);
    if (!gameIds) return;
    this.socketGames.delete(socketId);

    for (const gameId of gameIds) {
      const game = this.games.get(gameId);
      if (!game) continue;

      for (const color of ["white", "black"] as PlayerColor[]) {
        const player = game.players[color];
        if (!player) continue;
        const wasPresent = player.sockets.delete(socketId);
        if (!wasPresent || player.sockets.size > 0) continue;

        this.io.to(gameRoom(gameId)).emit("game:presence", {
          gameId,
          uid: player.uid,
          connected: false,
          disconnectInMs:
            game.status === "active" ? DISCONNECT_FORFEIT_MS : null,
        });

        if (game.status === "active") this.armForfeitTimer(game, player.uid);
      }
    }
  }

  getGame(gameId: string): GameState | null {
    const game = this.games.get(gameId);
    return game ? this.toState(game) : null;
  }

  /**
   * Aborts a game that has not seen a move yet, used when a match is cancelled
   * right as it is created. Returns false if the game already progressed.
   */
  abort(gameId: string): boolean {
    const game = this.games.get(gameId);
    if (!game || game.moves.length > 0) return false;

    this.stopTimers(game);
    if (game.cleanupTimer) clearTimeout(game.cleanupTimer);

    this.io.to(gameRoom(gameId)).emit("server:error", {
      code: "match_cancelled",
      message: "Your opponent cancelled the match before it started.",
    });

    for (const color of ["white", "black"] as PlayerColor[]) {
      const player = game.players[color];
      if (!player) continue;
      for (const socketId of player.sockets) {
        this.socketGames.get(socketId)?.delete(gameId);
        this.io.sockets.sockets.get(socketId)?.leave(gameRoom(gameId));
      }
    }

    this.games.delete(gameId);
    return true;
  }

  private start(game: LiveGame): void {
    const now = Date.now();
    game.status = "active";
    game.startedAt = now;
    game.turnStartedAt = now;
    game.clocks = {
      white: game.timeControl.initialSec * 1000,
      black: game.timeControl.initialSec * 1000,
    };
    if (game.waitingTimer) {
      clearTimeout(game.waitingTimer);
      game.waitingTimer = null;
    }

    this.armTurnTimer(game);
    this.armSyncTimer(game);
    for (const color of ["white", "black"] as PlayerColor[]) {
      const player = game.players[color];
      if (player && player.sockets.size === 0) this.armForfeitTimer(game, player.uid);
    }
    this.io.to(gameRoom(game.id)).emit("game:state", this.toState(game));
    this.emitClock(game);
  }

  private checkEndConditions(game: LiveGame, mover: PlayerColor): void {
    if (game.chess.isCheckmate()) return this.finish(game, mover, "checkmate");
    if (game.chess.isStalemate()) return this.finish(game, "draw", "stalemate");
    if (game.chess.isInsufficientMaterial()) {
      return this.finish(game, "draw", "insufficient-material");
    }
    if (game.chess.isThreefoldRepetition()) return this.finish(game, "draw", "threefold");
    if (game.chess.isDrawByFiftyMoves()) return this.finish(game, "draw", "fifty-move");
    if (game.chess.isDraw()) return this.finish(game, "draw", "fifty-move");
  }

  private finish(game: LiveGame, result: GameResult, termination: Termination): void {
    if (game.status === "finished") return;

    game.status = "finished";
    game.result = result;
    game.termination = termination;
    game.finishedAt = Date.now();
    game.drawOfferBy = null;
    this.stopTimers(game);

    const state = this.toState(game);
    persistGame(state);
    this.io.to(gameRoom(game.id)).emit("game:end", {
      gameId: game.id,
      result,
      termination,
      game: state,
    });

    // Update ratings for rated games only
    if (game.mode === "rated" && game.players.white?.rating != null && game.players.black?.rating != null) {
      // Since we checked above that both ratings are non-null, we can assert non-null
      const white: Player = game.players.white!;
      const black: Player = game.players.black!;
      const whiteOutcome: "win" | "loss" | "draw" = result === "white" ? "win" : result === "black" ? "loss" : "draw";
      const blackOutcome: "win" | "loss" | "draw" = result === "black" ? "win" : result === "white" ? "loss" : "draw";

      const whiteCategory: Category = game.category;
      const blackCategory: Category = game.category;

      const whiteNewRating = updateRating(white.rating, black.rating, whiteOutcome);
      const blackNewRating = updateRating(black.rating, white.rating, blackOutcome);

      const db = getAdminDb();
      if (db) {
        // Store new ratings
        db.collection("users")
          .doc(white.uid)
          .set({
            ratings: {
              [whiteCategory]: {
                rating: whiteNewRating,
              },
            },
          },
          { merge: true }
        ).catch((error) => {
          console.warn(`[ratings] Failed to update rating for white player ${white.uid}:`, error);
        });

        db.collection("users")
          .doc(black.uid)
          .set({
            ratings: {
              [blackCategory]: {
                rating: blackNewRating,
              },
            },
          },
          { merge: true }
        ).catch((error) => {
          console.warn(`[ratings] Failed to update rating for black player ${black.uid}:`, error);
        });

        // Store rating history for both players
        db.collection("users")
          .doc(white.uid)
          .update({
            ratingHistory: arrayUnion({ category: whiteCategory, rating: whiteNewRating, at: game.finishedAt }),
          }).catch((error) => {
            console.warn(`[ratings] Failed to update history for white player ${white.uid}:`, error);
          });

        db.collection("users")
          .doc(black.uid)
          .update({
            ratingHistory: arrayUnion({ category: blackCategory, rating: blackNewRating, at: game.finishedAt }),
          }).catch((error) => {
            console.warn(`[ratings] Failed to update history for black player ${black.uid}:`, error);
          });
      }
    }

    game.cleanupTimer = setTimeout(() => this.dropGame(game.id), FINISHED_GAME_TTL_MS);
  }

  private armTurnTimer(game: LiveGame): void {
    if (game.turnTimer) clearTimeout(game.turnTimer);
    if (game.status !== "active") return;

    const turn = colorFromTurn(game.chess.turn());
    const remaining = this.remainingFor(game, turn);
    game.turnTimer = setTimeout(() => this.onFlag(game.id), Math.max(0, remaining) + 30);
  }

  private onFlag(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game || game.status !== "active") return;

    const turn = colorFromTurn(game.chess.turn());
    const remaining = this.remainingFor(game, turn);
    if (remaining > 0) {
      game.clocks[turn] = remaining;
      game.turnStartedAt = Date.now();
      this.armTurnTimer(game);
      this.emitClock(game);
      return;
    }

    game.clocks[turn] = 0;
    this.finish(game, other(turn), "timeout");
  }

  private armSyncTimer(game: LiveGame): void {
    if (game.syncTimer) clearInterval(game.syncTimer);
    game.syncTimer = setInterval(() => {
      if (game.status === "active") this.emitClock(game);
    }, CLOCK_SYNC_MS);
  }

  private emitClock(game: LiveGame): void {
    this.io.to(gameRoom(game.id)).emit("game:clock", {
      gameId: game.id,
      whiteMs: this.remainingFor(game, "white"),
      blackMs: this.remainingFor(game, "black"),
      serverTime: Date.now(),
    });
  }

  private armForfeitTimer(game: LiveGame, uid: string): void {
    const existing = game.forfeitTimers.get(uid);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      game.forfeitTimers.delete(uid);
      const player = this.playerByUid(game, uid);
      if (!player || player.sockets.size > 0 || game.status !== "active") return;
      const color = this.colorOf(game, uid);
      if (!color) return;
      this.finish(game, other(color), "abandonment");
    }, DISCONNECT_FORFEIT_MS);

    game.forfeitTimers.set(uid, timer);
  }

  private remainingFor(game: LiveGame, color: PlayerColor): number {
    const base = game.clocks[color];
    if (game.status !== "active") return Math.max(0, base);
    const turn = colorFromTurn(game.chess.turn());
    if (turn !== color) return Math.max(0, base);
    const elapsed = game.turnStartedAt ? Date.now() - game.turnStartedAt : 0;
    return Math.max(0, base - elapsed);
  }

  private stopTimers(game: LiveGame): void {
    if (game.turnTimer) clearTimeout(game.turnTimer);
    if (game.syncTimer) clearInterval(game.syncTimer);
    if (game.waitingTimer) clearTimeout(game.waitingTimer);
    game.turnTimer = null;
    game.syncTimer = null;
    game.waitingTimer = null;
    for (const timer of game.forfeitTimers.values()) clearTimeout(timer);
    game.forfeitTimers.clear();
  }

  private dropGame(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;
    this.stopTimers(game);
    if (game.cleanupTimer) clearTimeout(game.cleanupTimer);
    this.games.delete(gameId);
  }

  private requireGame(gameId: string): LiveGame {
    const game = this.games.get(gameId);
    if (!game) {
      throw new GameError("not_found", "This game does not exist or has ended.");
    }
    return game;
  }

  private requireActivePlayer(game: LiveGame, uid: string): void {
    if (game.status === "waiting") {
      throw new GameError("not_started", "Waiting for an opponent to join.");
    }
    if (game.status !== "active") {
      throw new GameError("finished", "This game is already over.");
    }
    if (!this.colorOf(game, uid)) {
      throw new GameError("not_player", "You are not a player in this game.");
    }
  }

  private colorOf(game: LiveGame, uid: string): PlayerColor | null {
    if (game.players.white?.uid === uid) return "white";
    if (game.players.black?.uid === uid) return "black";
    return null;
  }

  private playerByUid(game: LiveGame, uid: string): Player | null {
    const color = this.colorOf(game, uid);
    return color ? game.players[color] : null;
  }

  private seatOf(game: LiveGame, uid: string): PlayerColor | null {
    if (!game.players.white && game.players.black?.uid !== uid) return "white";
    if (!game.players.black && game.players.white?.uid !== uid) return "black";
    return null;
  }

  private trackSocket(socketId: string, gameId: string): void {
    const set = this.socketGames.get(socketId) ?? new Set<string>();
    set.add(gameId);
    this.socketGames.set(socketId, set);
  }

  private toState(game: LiveGame): GameState {
    const now = Date.now();
    const summary = (color: PlayerColor): PlayerSummary | null => {
      const player = game.players[color];
      if (!player) return null;
      return {
        uid: player.uid,
        displayName: player.displayName,
        rating: player.rating,
        connected: player.sockets.size > 0,
        remainingMs: this.remainingFor(game, color),
      };
    };

    return {
      id: game.id,
      status: game.status,
      fen: game.chess.fen(),
      pgn: game.chess.pgn(),
      turn: game.chess.turn(),
      moves: game.moves,
      lastMove: game.lastMove,
      white: summary("white"),
      black: summary("black"),
      timeControl: game.timeControl,
      mode: game.mode,
      category: game.category,
      result: game.result,
      termination: game.termination,
      drawOfferBy: game.drawOfferBy,
      check: game.chess.isCheck(),
      createdAt: game.createdAt,
      startedAt: game.startedAt,
      finishedAt: game.finishedAt,
      serverTime: now,
    };
  }
}
