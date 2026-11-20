"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Chess, type Square } from "chess.js";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSocket } from "@/components/providers/SocketProvider";
import { ChessBoard } from "@/components/board/ChessBoard";
import { MoveList } from "@/components/board/MoveList";
import { PlayerBar } from "@/components/board/PlayerBar";
import { PromotionPicker } from "@/components/board/PromotionPicker";
import { Button } from "@/components/ui/Button";
import { capturedMaterial } from "@/lib/chess/captured";
import { playSound } from "@/lib/sounds";
import { cn } from "@/lib/cn";
import type {
  GameState,
  PlayerColor,
  PromotionPiece,
  Termination,
} from "@/shared/types";

type Snapshot = { game: GameState; at: number };

const TERMINATION_TEXT: Record<Termination, string> = {
  checkmate: "Checkmate",
  stalemate: "Stalemate",
  "insufficient-material": "Insufficient material",
  "fifty-move": "Fifty-move rule",
  threefold: "Threefold repetition",
  timeout: "Time out",
  resignation: "Resignation",
  "draw-agreement": "Draw by agreement",
  abandonment: "Opponent abandoned the game",
};

export const K_FACTOR = 32;

export function GameRoom({ gameId }: { gameId: string }) {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const router = useRouter();

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string } | null>(
    null,
  );
  const [pendingMove, setPendingMove] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [disconnect, setDisconnect] = useState<{ remainingMs: number; at: number } | null>(
    null,
  );
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [ratingChanges, setRatingChanges] = useState<{ whiteDelta: number; blackDelta: number } | null>(
    null,
  );

  const statusRef = useRef<GameState["status"] | null>(null);
  const game = snapshot?.game ?? null;
  const fen = game?.fen ?? null;

  useEffect(() => {
    setShareUrl(`${window.location.origin}/game/${gameId}`);
  }, [gameId]);

  const acceptGame = useCallback((next: GameState) => {
    if (statusRef.current === "waiting" && next.status === "active") playSound("start");
    statusRef.current = next.status;
    setSnapshot({ game: next, at: Date.now() });
    setPendingMove(false);
    if (next.status === "finished") setDisconnect(null);
  }, []);

  useEffect(() => {
    if (!socket || !connected) return;
    setJoining(true);
    socket.emit("game:join", { gameId }, (response) => {
      setJoining(false);
      if (response.ok) {
        setError(null);
        setDisconnect(null);
        acceptGame(response.data.game);
      } else {
        setError(response.message);
      }
    });
  }, [socket, connected, gameId, acceptGame]);

  // Guard for state updates on unmounted component
  const isMounted = useRef(true);
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!socket || !connected) return;
    setJoining(true);
    socket.emit("game:join", { gameId }, (response) => {
      setJoining(false);
      if (response.ok) {
        setError(null);
        setDisconnect(null);
        acceptGame(response.data.game);
      } else {
        setError(response.message);
      }
    });
  }, [socket, connected, gameId, acceptGame, isMounted]);

  useEffect(() => {
    if (!socket) return;

    const onState = (next: GameState) => {
      if (isMounted.current && next.id === gameId) acceptGame(next);
    };

    const onMove = (payload: { gameId: string; game: GameState; move: { san: string } }) => {
      if (isMounted.current && payload.gameId !== gameId) return;
      if (isMounted.current) acceptGame(payload.game);
      if (isMounted.current && payload.game.check) playSound("check");
      else if (isMounted.current && payload.move.san.includes("x")) playSound("capture");
      else if (isMounted.current) playSound("move");
    };

    const onClock = (payload: {
      gameId: string;
      whiteMs: number;
      blackMs: number;
      serverTime: number;
    }) => {
      if (!isMounted.current) return;
      if (payload.gameId !== gameId) return;
      setSnapshot((prev) => {
        if (!prev) return prev;
        return {
          at: Date.now(),
          game: {
            ...prev.game,
            white: prev.game.white
              ? { ...prev.game.white, remainingMs: payload.whiteMs }
              : null,
            black: prev.game.black
              ? { ...prev.game.black, remainingMs: payload.blackMs }
              : null,
          },
        };
      });
    };

    const onEnd = (payload: { gameId: string; game: GameState }) => {
      if (isMounted.current && payload.gameId !== gameId) return;
      if (isMounted.current) acceptGame(payload.game);
      if (isMounted.current) playSound("end");
    };

    const onDrawOffered = (payload: { gameId: string; by: string }) => {
      if (!isMounted.current || payload.gameId !== gameId || payload.by === user?.uid) return;
      setNotice("Your opponent offers a draw.");
    };

    const onDrawDeclined = (payload: { gameId: string; by: string }) => {
      if (!isMounted.current || payload.gameId !== gameId) return;
      setNotice(payload.by === user?.uid ? "Draw offer declined." : "Draw offer declined.");
    };

    // Compute rating changes when game state becomes finished
    useEffect(() => {
      if (!isMounted.current) return;
      if (!game || game.status !== "finished") return;
      if (game.mode === "rated" && game.white?.rating != null && game.black?.rating != null) {
        const whiteBefore = game.white.rating;
        const blackBefore = game.black.rating;

        // Simple Elo expected score: 1 / (1 + 10^((opponent - self) / 400))
        const expected = (rating: number, opponent: number) =>
          1 / (1 + Math.pow(10, (opponent - rating) / 400));

        let whiteDelta = whiteBefore;
        let blackDelta = blackBefore;
        if (game.result === "white") {
          whiteDelta = whiteBefore + K_FACTOR * (1 - expected(whiteBefore, blackBefore));
          blackDelta = blackBefore + K_FACTOR * (0 - expected(blackBefore, whiteBefore));
        } else if (game.result === "black") {
          whiteDelta = whiteBefore + K_FACTOR * (0 - expected(whiteBefore, blackBefore));
          blackDelta = blackBefore + K_FACTOR * (1 - expected(blackBefore, whiteBefore));
        } else {
          const exp = expected(whiteBefore, blackBefore);
          whiteDelta = whiteBefore + K_FACTOR * (0.5 - exp);
          blackDelta = blackBefore + K_FACTOR * (0.5 - exp);
        }

        setRatingChanges({ whiteDelta: Math.round(whiteDelta), blackDelta: Math.round(blackDelta) });
      }
    }, [game, isMounted]);

    const onPresence = (payload: {
      gameId: string;
      uid: string;
      connected: boolean;
      disconnectInMs: number | null;
    }) => {
      if (!isMounted.current || payload.gameId !== gameId) return;
      setDisconnect(
        payload.connected || payload.disconnectInMs === null
          ? null
          : { remainingMs: payload.disconnectInMs, at: Date.now() },
      );
      setSnapshot((prev) => {
        if (!prev) return prev;
        const update = (player: GameState["white"]) =>
          player && player.uid === payload.uid
            ? { ...player, connected: payload.connected }
            : player;
        return {
          ...prev,
          game: {
            ...prev.game,
            white: update(prev.game.white),
            black: update(prev.game.black),
          },
        };
      });
    };

    const onError = (payload: { code: string; message: string }) => {
      if (!isMounted.current) return;
      if (payload.code === "match_cancelled") {
        try {
          window.sessionStorage.setItem("chesskings:notice", payload.message);
        } catch {
          // Ignore storage failures; the redirect still happens.
        }
        router.replace("/");
        return;
      }
      if (payload.code === "game_expired" || payload.code === "finished") {
        setError(payload.message);
      } else {
        setNotice(payload.message);
      }
    };

    socket.on("game:state", onState);
    socket.on("game:move", onMove);
    socket.on("game:clock", onClock);
    socket.on("game:end", onEnd);
    socket.on("game:draw-offered", onDrawOffered);
    socket.on("game:draw-declined", onDrawDeclined);
    socket.on("game:presence", onPresence);
    socket.on("server:error", onError);

    return () => {
      socket.off("game:state", onState);
      socket.off("game:move", onMove);
      socket.off("game:clock", onClock);
      socket.off("game:end", onEnd);
      socket.off("game:draw-offered", onDrawOffered);
      socket.off("game:draw-declined", onDrawDeclined);
      socket.off("game:presence", onPresence);
      socket.off("server:error", onError);
    };
  }, [socket, gameId, user?.uid, acceptGame, router, ratingChanges, isMounted]);

  const myColor: PlayerColor | null = game
    ? game.white?.uid === user?.uid
      ? "white"
      : game.black?.uid === user?.uid
        ? "black"
        : null
    : null;

  const opponentColor: PlayerColor = myColor === "black" ? "white" : "black";
  const turnColor: PlayerColor | null = game
    ? game.turn === "w"
      ? "white"
      : "black"
    : null;
  const isMyTurn = Boolean(game && myColor && turnColor === myColor);
  const interactive = Boolean(
    game && game.status === "active" && isMyTurn && !pendingMove && !pendingPromotion,
  );

  // Keyboard navigation state for accessibility
  const [focusedSquare, setFocusedSquare] = useState<string | null>(null);
  const [keyboardMode, setKeyboardMode] = useState(false);

  // Handle keyboard input for square selection and navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!game || game.status !== "active" || !isMyTurn) return;

      // Toggle keyboard mode with F1 key
      if (event.key === "F1") {
        setKeyboardMode(!keyboardMode);
        return;
      }

      // Number keys 1-6 select piece type in keyboard mode
      if (keyboardMode && event.key >= "1" && event.key <= "6") {
        setFocusedSquare(event.key as string);
        return;
      }

      // Arrow keys move the focused square
      const squareMap: Record<string, string> = {
        ArrowUp: "e4",
        ArrowDown: "e4",
        ArrowLeft: "e4",
        ArrowRight: "e4",
        KeyW: "e4",
        KeyS: "e4",
        KeyA: "e4",
        KeyD: "e4",
      };
      if (squareMap[event.key]) {
        setFocusedSquare(squareMap[event.key]);
      }

      // Press Enter on a focused square to make a move
      if (event.key === "Enter" && focusedSquare && interactive) {
        // Try to move from focused square to itself (or highlight it)
        // In real play, this would need target logic
        setFocusedSquare(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [game, isMyTurn, interactive, keyboardMode, focusedSquare]);


  const targets = useMemo<string[]>(() => {
    if (!selected || !fen) return [];
    try {
      return new Chess(fen)
        .moves({ square: selected as Square, verbose: true })
        .map((move) => move.to);
    } catch {
      return [];
    }
  }, [selected, fen]);

  const captured = useMemo(
    () => capturedMaterial(fen ?? "8/8/8/8/8/8/8/8 w - - 0 1"),
    [fen],
  );

  function sendMove(from: string, to: string, promotion?: PromotionPiece) {
    if (!socket) return;
    setPendingMove(true);
    setSelected(null);
    socket.emit("game:move", { gameId, from, to, promotion }, (response) => {
      if (!response?.ok) {
        setPendingMove(false);
        setNotice(response?.message ?? "Move rejected.");
      }
    });
    window.setTimeout(() => setPendingMove(false), 4000);
  }

  function attemptMove(from: string, to: string): boolean {
    if (!game || !myColor || !interactive) return false;
    try {
      const chess = new Chess(game.fen);
      const piece = chess.get(from as Square);
      if (!piece || piece.color !== game.turn) return false;
      const legal = chess
        .moves({ square: from as Square, verbose: true })
        .filter((move) => move.to === to);
      if (legal.length === 0) return false;
      if (legal.some((move) => move.promotion)) {
        setPendingPromotion({ from, to });
        return true;
      }
      sendMove(from, to);
      return true;
    } catch {
      return false;
    }
  }

  function handleSquareClick(square: string) {
    if (!interactive) return;
    if (selected) {
      if (selected === square) {
        setSelected(null);
        return;
      }
      if (targets.includes(square)) {
        attemptMove(selected, square);
        return;
      }
    }
    const piece = fen ? safeGet(fen, square) : null;
    setSelected(piece?.color === game?.turn ? square : null);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice("Copy failed — select the link and copy it manually.");
    }
  }

  const [copiedPgn, setCopiedPgn] = useState(false);

  async function copyPgn() {
    try {
      if (!game || !game.pgn) return;
      await navigator.clipboard.writeText(game.pgn);
      setCopiedPgn(true);
      window.setTimeout(() => setCopiedPgn(false), 2000);
    } catch {
      setNotice("Copy failed — select the PGN and copy it manually.");
    }
  }

  function emitAction(
    event:
      | "game:resign"
      | "game:offer-draw"
      | "game:accept-draw"
      | "game:decline-draw",
  ) {
    socket?.emit(event, { gameId }, (response) => {
      if (!response?.ok) setNotice(response?.message ?? "Action failed.");
    });
  }

  if (error && !game) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <div className="w-full animate-pop rounded-2xl border border-border bg-panel/70 p-8">
          <p className="text-4xl" aria-hidden>♟</p>
          <h1 className="mt-4 text-xl font-semibold">Game unavailable</h1>
          <p className="mt-2 text-sm text-muted">{error}</p>
          <Button className="mt-6 w-full" onClick={() => router.push("/")}>
            Start a new game
          </Button>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,560px)_320px]">
        <div className="mx-auto aspect-square w-full max-w-[560px] animate-pulse rounded-xl bg-panel/60" />
        <div className="h-48 animate-pulse rounded-2xl bg-panel/40" />
        <span className="sr-only">{joining ? "Joining game…" : "Loading game…"}</span>
      </div>
    );
  }

  const myPlayer = myColor ? game[myColor] : null;
  const opponent = game[opponentColor];
  const showWaiting = game.status === "waiting";
  const showResult = game.status === "finished";
  const drawOfferByOpponent = Boolean(game.drawOfferBy && game.drawOfferBy !== user?.uid);
  const myDrawOffer = game.drawOfferBy === user?.uid;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-[#33415a] hover:text-foreground"
          >
            ← Lobby
          </Link>
          <div className="text-sm">
            <span className="font-medium">
              {Math.round(game.timeControl.initialSec / 60)}+
              {game.timeControl.incrementSec} {game.category}
            </span>
            <span className="text-muted"> · {game.mode}</span>
          </div>
          <span className="hidden font-mono text-xs text-muted/60 sm:inline">
            #{game.id.slice(0, 6)}
          </span>
        </div>

        <button
          type="button"
          onClick={copyLink}
          className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-[#33415a] hover:text-foreground"
        >
          {copied ? "Link copied ✓" : "Copy game link"}
        </button>
      </div>

      {!connected ? (
        <div className="mb-4 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          Connection lost — reconnecting…
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,620px)_320px] lg:justify-center">
        <div className="mx-auto w-full max-w-[620px]">
          <PlayerBar
            player={opponent}
            color={opponentColor}
            syncedAt={snapshot?.at ?? Date.now()}
            baseMs={opponent?.remainingMs ?? 0}
            ticking={game.status === "active" && turnColor === opponentColor}
            isMe={false}
            captured={myColor === "white" ? captured.byWhite : captured.byBlack}
            disconnect={opponent && !opponent.connected ? disconnect : null}
          />

          <div className="relative my-2.5">
            <ChessBoard
              fen={game.fen}
              orientation={myColor ?? "white"}
              lastMove={game.lastMove}
              selected={selected}
              targets={targets}
              check={game.check}
              interactive={interactive}
              onSquareClick={handleSquareClick}
              onMove={attemptMove}
            />

            {pendingPromotion ? (
              <PromotionPicker
                color={game.turn}
                onSelect={(piece) => {
                  const move = pendingPromotion;
                  setPendingPromotion(null);
                  if (move) sendMove(move.from, move.to, piece);
                }}
                onCancel={() => setPendingPromotion(null)}
              />
            ) : null}

            {showWaiting ? (
              <div className="absolute inset-0 z-10 grid place-items-center rounded-xl bg-black/55 p-4 backdrop-blur-[2px]">
                <div className="animate-pop w-full max-w-xs rounded-2xl border border-border bg-panel p-5 text-center">
                  <div className="mx-auto mb-3 size-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                  <p className="text-sm font-medium">Waiting for an opponent…</p>
                  <p className="mt-1 text-xs text-muted">
                    Share this link to start the clocks.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      readOnly
                      value={shareUrl}
                      onFocus={(event) => event.currentTarget.select()}
                      className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background/60 px-2 font-mono text-[11px] text-muted"
                      aria-label="Game link"
                    />
                    <Button size="sm" onClick={copyLink}>
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {showResult ? (
              <div className="absolute inset-0 z-10 grid place-items-center rounded-xl bg-black/55 p-4 backdrop-blur-[2px]">
                <div className="animate-pop w-full max-w-xs rounded-2xl border border-border bg-panel p-5 text-center">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    {TERMINATION_TEXT[game.termination ?? "draw-agreement"]}
                  </p>
                  <h2
                    className={cn(
                      "mt-2 text-2xl font-semibold",
                      myColor && game.result === myColor ? "text-brand" : game.result === "draw" ? "text-foreground" : "text-danger",
                    )}
                  >
                    {resultHeadline(game, myColor)}
                  </h2>
                  <p className="mt-1 font-mono text-sm text-muted">
                    {game.result === "draw" ? "½–½" : game.result === "white" ? "1–0" : "0–1"}
                  </p>
                  {ratingChanges && (
                    <div className="mt-3 text-left">
                      <p className="text-xs font-medium">
{myColor === "white"
          ? `Your rating changed by +${ratingChanges.whiteDelta}`
          : myColor === "black"
          ? `Your rating changed by +${ratingChanges.blackDelta}`
          : `No rating change (casual game)`}
  </p>
                    </div>
                  )}
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="primary"
                      onClick={() => {
                        // Rematch: create new game with same settings
                        const tc = game.timeControl;
                        const mode = game.mode;
                        socket?.emit("game:create", {
                          timeControl: {
                            initialSec: tc.initialSec,
                            incrementSec: tc.incrementSec,
                          },
                          mode,
                        }, (response) => {
                          if (response?.ok) {
                            router.push(`/game/${response.data.gameId}`);
                          }
                        });
                      }}
                      disabled={game.mode === "casual" && !user?.uid}
                    >
                      Rematch
                    </Button>
                    <Button className="flex-1" onClick={() => router.push("/")}>
                      New game
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={copyLink}
                      className="shrink-0"
                      aria-label="Copy game link"
                    >
                      {copied ? "✓" : "Link"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={copyPgn}
                      className="shrink-0"
                      aria-label="Copy PGN"
                    >
                      {copiedPgn ? "✓" : "PGN"}
                    </Button>
                    <small className="ml-2 text-muted/70">·</small>
                    <div id="pgn-output" className="hidden" aria-live="polite"></div>
                  </div>
                </div>
              </div>
            ) : null}

          </div>

          <PlayerBar
            player={myPlayer}
            color={myColor ?? (game.white && game.white.uid === user?.uid ? "white" : "black")}
            syncedAt={snapshot?.at ?? Date.now()}
            baseMs={myPlayer?.remainingMs ?? 0}
            ticking={game.status === "active" && turnColor === myColor}
            isMe={Boolean(myColor)}
            captured={myColor === "white" ? captured.byBlack : captured.byWhite}
            disconnect={myPlayer && !myPlayer.connected ? disconnect : null}
          />

          <aside className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-panel/60 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Moves</h2>
                <span className="text-xs text-muted">
                  {game.status === "active"
                    ? turnColor === myColor
                      ? "Your move"
                      : "Opponent's move"
                    : game.status === "waiting"
                      ? "Not started"
                      : "Game over"}
                </span>
              </div>
              <div className="mt-3">
                <MoveList moves={game.moves} />
              </div>
            </div>

            {drawOfferByOpponent && game.status === "active" ? (
              <div className="animate-pop rounded-2xl border border-brand/30 bg-brand/10 p-4">
                <p className="text-sm font-medium">Draw offered</p>
                <p className="mt-0.5 text-xs text-muted">
                  Your opponent offers a draw. Accept?
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => emitAction("game:accept-draw")}>
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => emitAction("game:decline-draw")}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ) : null}

            {myDrawOffer && game.status === "active" ? (
              <div className="rounded-2xl border border-border bg-panel/40 px-4 py-3 text-xs text-muted">
                Draw offer sent — waiting for your opponent.
              </div>
            ) : null}

            {notice ? (
              <div className="animate-pop flex items-start justify-between gap-3 rounded-xl border border-border bg-panel/70 px-3 py-2 text-xs text-muted">
                <span>{notice}</span>
                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  className="text-muted hover:text-foreground"
                  aria-label="Dismiss message"
                >
                  ✕
                </button>
              </div>
            ) : null}

            <div className="rounded-2xl border border-border bg-panel/60 p-4">
              <h2 className="text-sm font-semibold">Actions</h2>
              <div className="mt-3 flex flex-col gap-2">
                <Button
                  variant="secondary"
                  onClick={() => emitAction("game:offer-draw")}
                  disabled={game.status !== "active" || Boolean(game.drawOfferBy)}
                >
                  {game.drawOfferBy === user?.uid ? "Draw offered" : "Offer draw"}
                </Button>
                {confirmResign ? (
                  <div className="flex gap-2">
                    <Button
                      variant="danger"
                      className="flex-1"
                      onClick={() => {
                        setConfirmResign(false);
                        emitAction("game:resign");
                      }}
                    >
                      Confirm resign
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1"
                      onClick={() => setConfirmResign(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="danger"
                    onClick={() => setConfirmResign(true)}
                    disabled={game.status !== "active"}
                  >
                    Resign
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-panel/40 p-4 text-xs text-muted">
              <p>
                You play{" "}<span className="font-medium text-foreground">
                  {myColor ?? "spectator"}
                </span>.
                Clocks are enforced server-side; refreshing keeps your seat for 60 seconds.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function safeGet(fen: string, square: string) {
  try {
    return new Chess(fen).get(square as Square) ?? null;
  } catch {
    return null;
  }
}

function resultHeadline(game: GameState, myColor: PlayerColor | null): string {
  if (game.result === "draw") return "Draw";
  if (!myColor) return game.result === "white" ? "White wins" : "Black wins";
  return game.result === myColor ? "You won" : "You lost";
}
