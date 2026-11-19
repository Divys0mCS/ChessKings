import type { OnlinePlayer } from "../src/shared/types";
import type { GameServer } from "./games";

type OnlineUser = {
  displayName: string;
  sockets: Set<string>;
};

/** Tracks which players are online so challenges can be addressed by uid. */
export class Presence {
  private users = new Map<string, OnlineUser>();

  constructor(private readonly io: GameServer) {}

  add(user: { uid: string; displayName: string }, socketId: string): void {
    const existing = this.users.get(user.uid);
    if (existing) {
      existing.displayName = user.displayName;
      existing.sockets.add(socketId);
    } else {
      this.users.set(user.uid, {
        displayName: user.displayName,
        sockets: new Set([socketId]),
      });
    }
    this.broadcast();
  }

  removeSocket(socketId: string): void {
    for (const [uid, user] of this.users) {
      if (!user.sockets.delete(socketId)) continue;
      if (user.sockets.size === 0) this.users.delete(uid);
      this.broadcast();
      return;
    }
  }

  has(uid: string): boolean {
    return (this.users.get(uid)?.sockets.size ?? 0) > 0;
  }

  get(uid: string): OnlinePlayer | null {
    const user = this.users.get(uid);
    return user ? { uid, displayName: user.displayName } : null;
  }

  socketIds(uid: string): string[] {
    return [...(this.users.get(uid)?.sockets ?? [])];
  }

  list(): OnlinePlayer[] {
    return [...this.users.entries()]
      .filter(([, user]) => user.sockets.size > 0)
      .map(([uid, user]) => ({ uid, displayName: user.displayName }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  private broadcast(): void {
    this.io.emit("presence:update", { players: this.list() });
  }
}
