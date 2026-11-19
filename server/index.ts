import "./env";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { ZodError } from "zod";
import type { Ack } from "../src/shared/events";
import {
  challengeActionSchema,
  challengeCreateSchema,
  createGameSchema,
  emptyPayloadSchema,
  findMatchSchema,
  gameActionSchema,
  joinGameSchema,
  moveSchema,
} from "../src/shared/schemas";
import { AuthError, devAuthEnabled, verifyToken } from "./auth";
import { ChallengeManager } from "./challenges";
import { GameError, GameManager, gameRoom, type GameServer } from "./games";
import { Matchmaker } from "./matchmaking";
import { Presence } from "./presence";

const PORT = Number(process.env.SOCKET_PORT ?? 4001);
const ORIGINS = (process.env.CLIENT_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const httpServer = createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "chesskings-socket" }));
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: false }));
});

const io: GameServer = new Server(httpServer, {
  cors: { origin: ORIGINS, credentials: true },
  maxHttpBufferSize: 64 * 1024,
  pingInterval: 20_000,
  pingTimeout: 20_000,
});

const manager = new GameManager(io);
const presence = new Presence(io);
const matchmaker = new Matchmaker(io, manager);
const challenges = new ChallengeManager(io, manager, presence);

io.use(async (socket, next) => {
  try {
    const token =
      typeof socket.handshake.auth?.token === "string"
        ? socket.handshake.auth.token
        : "";
    socket.data.user = await verifyToken(token);
    next();
  } catch (error) {
    const message = error instanceof AuthError ? error.message : "Unauthorized";
    next(new Error(message));
  }
});

function toFailure(error: unknown): { code: string; message: string } {
  if (error instanceof GameError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof AuthError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof ZodError) {
    return {
      code: "invalid_payload",
      message: error.issues[0]?.message ?? "Invalid request.",
    };
  }
  console.error("[socket] Unhandled error:", error);
  return { code: "server_error", message: "Something went wrong. Try again." };
}

function handle<T>(ack: Ack<T> | undefined, run: () => T): void {
  try {
    const data = run();
    ack?.({ ok: true, data });
  } catch (error) {
    ack?.({ ok: false, ...toFailure(error) });
  }
}

io.on("connection", (socket) => {
  const user = socket.data.user;
  console.log(`[socket] connected ${user.uid} (${socket.id})`);
  presence.add(user, socket.id);

  socket.on("game:create", (payload, ack) => {
    handle(ack, () => {
      const input = createGameSchema.parse(payload);
      const game = manager.create(user, input);
      socket.join(gameRoom(game.id));
      manager.join(game.id, user, socket.id);
      return { gameId: game.id };
    });
  });

  socket.on("game:join", (payload, ack) => {
    handle(ack, () => {
      const { gameId } = joinGameSchema.parse(payload);
      socket.join(gameRoom(gameId));
      const game = manager.join(gameId, user, socket.id);
      return { game };
    });
  });

  socket.on("game:move", (payload, ack) => {
    handle(ack, () => {
      const input = moveSchema.parse(payload);
      return { game: manager.move(user, input) };
    });
  });

  socket.on("game:resign", (payload, ack) => {
    handle(ack, () => {
      const { gameId } = gameActionSchema.parse(payload);
      manager.resign(user, gameId);
      return null;
    });
  });

  socket.on("game:offer-draw", (payload, ack) => {
    handle(ack, () => {
      const { gameId } = gameActionSchema.parse(payload);
      manager.offerDraw(user, gameId);
      return null;
    });
  });

  socket.on("game:accept-draw", (payload, ack) => {
    handle(ack, () => {
      const { gameId } = gameActionSchema.parse(payload);
      manager.acceptDraw(user, gameId);
      return null;
    });
  });

  socket.on("game:decline-draw", (payload, ack) => {
    handle(ack, () => {
      const { gameId } = gameActionSchema.parse(payload);
      manager.declineDraw(user, gameId);
      return null;
    });
  });

  socket.on("matchmaking:find", (payload, ack) => {
    void (async () => {
      try {
        const input = findMatchSchema.parse(payload);
        const data = await matchmaker.add(user, socket.id, input);
        ack({ ok: true, data });
      } catch (error) {
        ack({ ok: false, ...toFailure(error) });
      }
    })();
  });

  socket.on("matchmaking:cancel", (payload, ack) => {
    handle(ack, () => {
      emptyPayloadSchema.parse(payload ?? {});
      return matchmaker.cancel(user.uid);
    });
  });

  socket.on("presence:list", (payload, ack) => {
    handle(ack, () => {
      emptyPayloadSchema.parse(payload ?? {});
      return { players: presence.list() };
    });
  });

  socket.on("challenge:create", (payload, ack) => {
    void (async () => {
      try {
        const input = challengeCreateSchema.parse(payload);
        const data = await challenges.create(user, input);
        ack({ ok: true, data });
      } catch (error) {
        ack({ ok: false, ...toFailure(error) });
      }
    })();
  });

  socket.on("challenge:accept", (payload, ack) => {
    void (async () => {
      try {
        const { challengeId } = challengeActionSchema.parse(payload);
        const data = await challenges.accept(user, challengeId);
        ack({ ok: true, data });
      } catch (error) {
        ack({ ok: false, ...toFailure(error) });
      }
    })();
  });

  socket.on("challenge:decline", (payload, ack) => {
    handle(ack, () => {
      const { challengeId } = challengeActionSchema.parse(payload);
      challenges.decline(user, challengeId);
      return null;
    });
  });

  socket.on("challenge:cancel", (payload, ack) => {
    handle(ack, () => {
      const { challengeId } = challengeActionSchema.parse(payload);
      challenges.cancel(user, challengeId);
      return null;
    });
  });

  socket.on("challenge:list", (payload, ack) => {
    handle(ack, () => {
      emptyPayloadSchema.parse(payload ?? {});
      return challenges.list(user.uid);
    });
  });

  socket.on("disconnect", (reason) => {
    console.log(`[socket] disconnected ${user.uid} (${socket.id}): ${reason}`);
    presence.removeSocket(socket.id);
    matchmaker.removeSocket(socket.id);
    manager.leaveSocket(socket.id);
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`[socket] listening on :${PORT}`);
  console.log(`[socket] allowed origins: ${ORIGINS.join(", ")}`);
  if (devAuthEnabled) {
    console.warn(
      "[socket] WARNING: ALLOW_DEV_AUTH is enabled. Development tokens are accepted (never use this in production).",
    );
  }
});

function shutdown(signal: string) {
  console.log(`[socket] ${signal} received, shutting down`);
  challenges.stop();
  matchmaker.stop();
  io.close(() => httpServer.close(() => process.exit(0)));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
