import type {
  Challenge,
  GameState,
  GameEndPayload,
  GameMode,
  MoveRecord,
  OnlinePlayer,
  PlayerColor,
  TimeControl,
} from "./types";
import type {
  ChallengeActionInput,
  ChallengeCreateInput,
  CreateGameInput,
  FindMatchInput,
  GameActionInput,
  JoinGameInput,
  MoveInput,
} from "./schemas";

export type AckSuccess<T> = { ok: true; data: T };
export type AckFailure = { ok: false; code: string; message: string };
export type Ack<T> = (response: AckSuccess<T> | AckFailure) => void;

export type AuthUser = {
  uid: string;
  displayName: string;
};

export type ClientToServerEvents = {
  "game:create": (payload: CreateGameInput, ack: Ack<{ gameId: string }>) => void;
  "game:join": (payload: JoinGameInput, ack: Ack<{ game: GameState }>) => void;
  "game:move": (payload: MoveInput, ack?: Ack<{ game: GameState }>) => void;
  "game:resign": (payload: GameActionInput, ack?: Ack<null>) => void;
  "game:offer-draw": (payload: GameActionInput, ack?: Ack<null>) => void;
  "game:accept-draw": (payload: GameActionInput, ack?: Ack<null>) => void;
  "game:decline-draw": (payload: GameActionInput, ack?: Ack<null>) => void;
  "matchmaking:find": (payload: FindMatchInput, ack: Ack<{ window: number }>) => void;
  "matchmaking:cancel": (
    payload: Record<string, never>,
    ack?: Ack<{ cancelled: boolean; gameId: string | null }>,
  ) => void;
  "presence:list": (
    payload: Record<string, never>,
    ack: Ack<{ players: OnlinePlayer[] }>,
  ) => void;
  "challenge:create": (
    payload: ChallengeCreateInput,
    ack: Ack<{ challengeId: string; expiresInMs: number }>,
  ) => void;
  "challenge:accept": (payload: ChallengeActionInput, ack: Ack<{ gameId: string }>) => void;
  "challenge:decline": (payload: ChallengeActionInput, ack?: Ack<null>) => void;
  "challenge:cancel": (payload: ChallengeActionInput, ack?: Ack<null>) => void;
  "challenge:list": (
    payload: Record<string, never>,
    ack: Ack<{ incoming: Challenge[]; outgoing: Challenge[] }>,
  ) => void;
};

export type ServerToClientEvents = {
  "game:state": (game: GameState) => void;
  "game:move": (payload: { gameId: string; game: GameState; move: MoveRecord }) => void;
  "game:clock": (payload: {
    gameId: string;
    whiteMs: number;
    blackMs: number;
    serverTime: number;
  }) => void;
  "game:end": (payload: GameEndPayload) => void;
  "game:draw-offered": (payload: { gameId: string; by: string }) => void;
  "game:draw-declined": (payload: { gameId: string; by: string }) => void;
  "game:presence": (payload: {
    gameId: string;
    uid: string;
    connected: boolean;
    /**
     * Time left before forfeit, relative to when this event was emitted.
     * Clients anchor it to receipt time so clock skew cannot distort the countdown.
     */
    disconnectInMs: number | null;
  }) => void;
  "matchmaking:searching": (payload: {
    timeControl: TimeControl;
    mode: GameMode;
    window: number;
  }) => void;
  "matchmaking:found": (payload: { gameId: string; color: PlayerColor }) => void;
  "matchmaking:cancelled": (payload: { reason?: "user" | "disconnect" }) => void;
  "presence:update": (payload: { players: OnlinePlayer[] }) => void;
  "challenge:received": (challenge: Challenge) => void;
  "challenge:sent": (challenge: Challenge) => void;
  "challenge:expired": (payload: { challengeId: string }) => void;
  "challenge:accepted": (payload: { challengeId: string; gameId: string }) => void;
  "challenge:declined": (payload: { challengeId: string; by: string }) => void;
  "challenge:cancelled": (payload: { challengeId: string }) => void;
  "server:error": (payload: { code: string; message: string }) => void;
};

export type InterServerEvents = Record<string, never>;

export type SocketData = {
  user: AuthUser;
};
