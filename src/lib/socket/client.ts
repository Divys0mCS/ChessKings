import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@/shared/events";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function socketUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (configured) return configured;
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

export function createGameSocket(
  auth: (callback: (data: object) => void) => void,
): GameSocket {
  return io(socketUrl(), {
    autoConnect: false,
    auth,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
  });
}
