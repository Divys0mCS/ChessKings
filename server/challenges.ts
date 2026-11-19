import { randomUUID } from "node:crypto";
import type { Socket } from "socket.io";
import { categoryFor } from "../src/shared/timeControl";
import { getAdminDb } from "../src/lib/firebase/admin";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "../src/shared/events";
import type { ChallengeCreateInput } from "../src/shared/schemas";
import type {
  Challenge,
  ChallengeColor,
  GameMode,
  PlayerColor,
  TimeControl,
} from "../src/shared/types";
import { GameError, GameManager, gameRoom, type GameServer } from "./games";
import type { Presence } from "./presence";
import { getPlayerRating } from "./ratings";
import {
  persistChallenge,
  removeChallenge,
  loadActiveChallenges,
  loadOutgoingChallenges,
} from "./persistence";

export const CHALLENGE_TTL_MS = 5 * 60_000;

type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type LiveChallenge = {
  id: string;
  from: { uid: string; displayName: string };
  to: { uid: string; displayName: string };
  timeControl: TimeControl;
  mode: GameMode;
  color: ChallengeColor;
  createdAt: number;
  expiresAt: number;
  timer?: NodeJS.Timeout;
};

export class ChallengeManager {
  private items = new Map<string, LiveChallenge>();

  constructor(
    private readonly io: GameServer,
    private readonly games: GameManager,
    private readonly presence: Presence,
  ) {
    this.startupLoad().catch((error) => {
      console.error(`[challenges] Failed to load challenges from Firestore:`, error);
    });
  }

  private async startupLoad(): Promise<void> {
    const db = getAdminDb();
    if (!db) return;

    const now = Date.now();
    const snapshot = await db.collection("challenges").get();

    for (const doc of snapshot.docs) {
      const data = doc.data() as {
        id: string;
        fromUid: string;
        fromDisplayName: string;
        toUid: string;
        toDisplayName: string;
        timeInitialSec: number;
        timeIncrementSec: number;
        mode: string;
        color: string;
        createdAt: number;
        expiresAt: number;
      };
      if (data.expiresAt > now) {
        const challenge: LiveChallenge = {
          id: data.id,
          from: { uid: data.fromUid, displayName: data.fromDisplayName },
          to: { uid: data.toUid, displayName: data.toDisplayName },
          timeControl: { initialSec: data.timeInitialSec, incrementSec: data.timeIncrementSec },
          mode: data.mode as GameMode,
          color: data.color as ChallengeColor,
          createdAt: data.createdAt,
          expiresAt: data.expiresAt,
        };
        this.items.set(challenge.id, challenge);
      } else {
        db.collection("challenges").doc(data.id).delete();
      }
    }
  }

  async create(
    user: { uid: string; displayName: string },
    input: ChallengeCreateInput,
  ): Promise<{ challengeId: string; expiresInMs: number }> {
    if (user.uid === input.toUid) {
      throw new GameError("self_challenge", "You can't challenge yourself.");
    }

    const target = this.presence.get(input.toUid);
    if (!target) {
      throw new GameError("not_online", "That player is not online right now.");
    }

    for (const existing of this.items.values()) {
      if (
        existing.from.uid === user.uid &&
        existing.to.uid === input.toUid &&
        existing.expiresAt > Date.now()
      ) {
        throw new GameError(
          "already_sent",
          "You already have a pending challenge to that player.",
        );
      }
    }

    const id = randomUUID().replace(/-/g, "").slice(0, 12);
    const now = Date.now();
    const challenge: LiveChallenge = {
      id,
      from: { uid: user.uid, displayName: user.displayName },
      to: { uid: target.uid, displayName: target.displayName },
      timeControl: input.timeControl,
      mode: input.mode,
      color: input.color,
      createdAt: now,
      expiresAt: now + CHALLENGE_TTL_MS,
    };

    this.items.set(id, challenge);

    // Persist to Firestore for survival across restarts
    const db = getAdminDb();
    if (db) {
      const challengeDoc = {
        id,
        fromUid: user.uid,
        fromDisplayName: user.displayName,
        toUid: target.uid,
        toDisplayName: target.displayName,
        timeControl: { initialSec: input.timeControl.initialSec, incrementSec: input.timeControl.incrementSec },
        mode: input.mode,
        color: input.color,
        createdAt: now,
        expiresAt: challenge.expiresAt,
      };
      persistChallenge(challengeDoc);
    }

    this.emitAll(user.uid, (socket) =>
      socket.emit("challenge:sent", this.toChallenge(challenge)),
    );
    this.emitAll(challenge.to.uid, (socket) =>
      socket.emit("challenge:received", this.toChallenge(challenge)),
    );

    return { challengeId: id, expiresInMs: CHALLENGE_TTL_MS };
  }

  list(uid: string): { incoming: Challenge[]; outgoing: Challenge[] } {
    const now = Date.now();
    const all = [...this.items.values()].filter((item) => item.expiresAt > now);
    return {
      incoming: all
        .filter((item) => item.to.uid === uid)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((item) => this.toChallenge(item)),
      outgoing: all
        .filter((item) => item.from.uid === uid)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((item) => this.toChallenge(item)),
    };
  }

  async accept(
    user: { uid: string; displayName: string },
    challengeId: string,
  ): Promise<{ gameId: string }> {
    const challenge = this.require(challengeId);
    if (challenge.to.uid !== user.uid) {
      throw new GameError("not_recipient", "This challenge is not for you.");
    }
    if (challenge.expiresAt <= Date.now()) {
      this.remove(challenge);
      throw new GameError("expired", "This challenge has expired.");
    }

    const creator = this.presence.get(challenge.from.uid);
    if (!creator) {
      this.remove(challenge);
      throw new GameError("opponent_offline", "That player went offline.");
    }

    const category = categoryFor(
      challenge.timeControl.initialSec,
      challenge.timeControl.incrementSec,
    );
    const [creatorRating, acceptorRating] = await Promise.all([
      getPlayerRating(creator.uid, category),
      getPlayerRating(user.uid, category),
    ]);

    const creatorColor: PlayerColor =
      challenge.color === "random"
        ? Math.random() < 0.5
          ? "white"
          : "black"
        : challenge.color;

    const acceptorName =
      this.presence.get(user.uid)?.displayName ?? user.displayName;

    const creatorSeat = {
      uid: creator.uid,
      displayName: creator.displayName,
      rating: creatorRating,
    };
    const acceptorSeat = {
      uid: user.uid,
      displayName: acceptorName,
      rating: acceptorRating,
    };

    const game = this.games.createMatched(
      creatorColor === "white" ? creatorSeat : acceptorSeat,
      creatorColor === "white" ? acceptorSeat : creatorSeat,
      { timeControl: challenge.timeControl, mode: challenge.mode },
    );

    this.attach(creator.uid, game.id);
    this.attach(user.uid, game.id);
    this.remove(challenge);

    for (const uid of [creator.uid, user.uid]) {
      this.emitAll(uid, (socket) =>
        socket.emit("challenge:accepted", {
          challengeId: challenge.id,
          gameId: game.id,
        }),
      );
    }

    // Remove from Firestore since the challenge is now a game
    const db = getAdminDb();
    if (db) {
      removeChallenge(challenge.id);
    }

    return { gameId: game.id };
  }

  decline(user: { uid: string }, challengeId: string): void {
    const challenge = this.require(challengeId);
    if (user.uid !== challenge.to.uid && user.uid !== challenge.from.uid) {
      throw new GameError("not_player", "This challenge is not yours.");
    }
    this.remove(challenge);
    for (const uid of [challenge.from.uid, challenge.to.uid]) {
      this.emitAll(uid, (socket) =>
        socket.emit("challenge:declined", { challengeId, by: user.uid }),
      );
    }

    // Remove from Firestore
    const db = getAdminDb();
    if (db) {
      removeChallenge(challenge.id);
    }
  }

  cancel(user: { uid: string }, challengeId: string): void {
    const challenge = this.require(challengeId);
    if (challenge.from.uid !== user.uid) {
      throw new GameError("not_sender", "Only the challenger can cancel this.");
    }
    this.remove(challenge);
    for (const uid of [challenge.from.uid, challenge.to.uid]) {
      this.emitAll(uid, (socket) =>
        socket.emit("challenge:cancelled", { challengeId }),
      );
    }

    // Remove from Firestore
    const db = getAdminDb();
    if (db) {
      removeChallenge(challenge.id);
    }
  }

  stop(): void {
    for (const challenge of this.items.values()) clearTimeout(challenge.timer);
    this.items.clear();

    // Clean up all challenges from Firestore on shutdown
    const db = getAdminDb();
    if (db) {
      db.collection("challenges")
        .get()
        .then((snapshot) => {
          const batch = db.batch();
          snapshot.docs.forEach((doc) => batch.delete(doc.ref));
          return batch.commit();
        })
        .catch((error) => {
          console.error(
            `[challenges] Failed to clean up challenges on shutdown:`,
            error,
          );
        });
    }
  }

  private require(challengeId: string): LiveChallenge {
    const challenge = this.items.get(challengeId);
    if (!challenge) {
      throw new GameError("not_found", "This challenge is no longer available.");
    }
    return challenge;
  }

  private remove(challenge: LiveChallenge): void {
    clearTimeout(challenge.timer);
    this.items.delete(challenge.id);
  }

  private attach(uid: string, gameId: string): void {
    for (const socketId of this.presence.socketIds(uid)) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (!socket) continue;
      socket.join(gameRoom(gameId));
      this.games.join(
        gameId,
        {
          uid,
          displayName: this.presence.get(uid)?.displayName ?? "Player",
        },
        socketId,
      );
    }
  }

  private emitAll(uid: string, emit: (socket: AppSocket) => void): void {
    for (const socketId of this.presence.socketIds(uid)) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) emit(socket as AppSocket);
    }
  }

  toChallenge(challenge: LiveChallenge): Challenge {
    return {
      id: challenge.id,
      from: challenge.from,
      to: challenge.to,
      timeControl: challenge.timeControl,
      mode: challenge.mode,
      color: challenge.color,
      expiresInMs: Math.max(0, challenge.expiresAt - Date.now()),
    };
  }
}