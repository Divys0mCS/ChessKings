export type Category = "bullet" | "blitz" | "rapid";
export type GameMode = "rated" | "casual";
export type PlayerColor = "white" | "black";
export type PieceColor = "w" | "b";
export type GameStatus = "waiting" | "active" | "finished";

export type GameResult = "white" | "black" | "draw";

export type Termination =
  | "checkmate"
  | "stalemate"
  | "insufficient-material"
  | "fifty-move"
  | "threefold"
  | "timeout"
  | "resignation"
  | "draw-agreement"
  | "abandonment";

export type TimeControl = {
  initialSec: number;
  incrementSec: number;
};

export type PromotionPiece = "q" | "r" | "b" | "n";

export type MoveRecord = {
  san: string;
  from: string;
  to: string;
  color: PlayerColor;
  promotion?: PromotionPiece;
};

export type PlayerSummary = {
  uid: string;
  displayName: string;
  rating: number;
  connected: boolean;
  /** Remaining clock time in milliseconds, as of `serverTime`. */
  remainingMs: number;
};

export type GameState = {
  id: string;
  status: GameStatus;
  fen: string;
  pgn: string;
  turn: PieceColor;
  moves: MoveRecord[];
  lastMove: { from: string; to: string } | null;
  white: PlayerSummary | null;
  black: PlayerSummary | null;
  timeControl: TimeControl;
  mode: GameMode;
  category: Category;
  result: GameResult | null;
  termination: Termination | null;
  /** Uid of the player with an outstanding draw offer, if any. */
  drawOfferBy: string | null;
  check: boolean;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  serverTime: number;
};

export type GameEndPayload = {
  gameId: string;
  result: GameResult;
  termination: Termination;
  game: GameState;
};

export type ChallengeColor = PlayerColor | "random";

export type Challenge = {
  id: string;
  from: { uid: string; displayName: string };
  to: { uid: string; displayName: string };
  timeControl: TimeControl;
  mode: GameMode;
  /** Color requested by the challenger. */
  color: ChallengeColor;
  /** Milliseconds until expiry, relative to when this payload was emitted. */
  expiresInMs: number;
};

export type OnlinePlayer = {
  uid: string;
  displayName: string;
};
