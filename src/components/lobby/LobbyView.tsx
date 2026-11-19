"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/components/providers/SocketProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { categoryFor, TIME_CONTROLS, type TimeControlPreset } from "@/shared/timeControl";
import type {
  Category,
  ChallengeColor,
  GameMode,
  OnlinePlayer,
} from "@/shared/types";

const GROUPS: Array<{ id: Category; label: string; hint: string; accent: string }> = [
  { id: "bullet", label: "Bullet", hint: "Under 3 minutes", accent: "text-amber-300" },
  { id: "blitz", label: "Blitz", hint: "3 to 10 minutes", accent: "text-brand" },
  { id: "rapid", label: "Rapid", hint: "10 minutes and up", accent: "text-sky-300" },
];

function labelFor(preset: TimeControlPreset): string {
  const minutes = Math.round(preset.initialSec / 60);
  return preset.incrementSec ? `${minutes}+${preset.incrementSec}` : `${minutes}+0`;
}

export function LobbyView() {
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const router = useRouter();

  const [selected, setSelected] = useState<TimeControlPreset>(TIME_CONTROLS[5]);
  const [mode, setMode] = useState<GameMode>("casual");
  const [creatingLink, setCreatingLink] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchStartedAt, setSearchStartedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [target, setTarget] = useState<OnlinePlayer | null>(null);
  const [challengeColor, setChallengeColor] = useState<ChallengeColor>("random");
  const [sendingChallenge, setSendingChallenge] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);

  const searchingRef = useRef(false);
  const cancelRequestedRef = useRef(false);

  useEffect(() => {
    if (!socket) return;

    const onConnectError = (err: Error) => {
      setError(err.message || "Could not reach the game server.");
      setCreatingLink(false);
      searchingRef.current = false;
      setSearching(false);
    };
    const onFound = (payload: { gameId: string }) => {
      searchingRef.current = false;
      setSearching(false);
      // A cancel that raced the pairing wins: the server aborts that game.
      if (cancelRequestedRef.current) return;
      router.push(`/game/${payload.gameId}`);
    };
    const onCancelled = () => {
      searchingRef.current = false;
      setSearching(false);
    };

    socket.on("connect_error", onConnectError);
    socket.on("matchmaking:found", onFound);
    socket.on("matchmaking:cancelled", onCancelled);

    return () => {
      socket.off("connect_error", onConnectError);
      socket.off("matchmaking:found", onFound);
      socket.off("matchmaking:cancelled", onCancelled);
    };
  }, [socket, router]);

  useEffect(() => {
    if (!connected && searching) {
      searchingRef.current = false;
      setSearching(false);
      setError("Connection lost while searching. Try again.");
    }
  }, [connected, searching]);

  // Leaving the lobby (or unmounting) drops the queue entry even though the
  // socket itself stays connected for the rest of the app.
  useEffect(() => {
    const currentSocket = socket;
    return () => {
      if (!searchingRef.current) return;
      searchingRef.current = false;
      currentSocket?.emit("matchmaking:cancel", {});
    };
  }, [socket]);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem("chesskings:notice");
      if (stored) {
        window.sessionStorage.removeItem("chesskings:notice");
        setNotice(stored);
      }
    } catch {
      // sessionStorage can be unavailable in hardened browsers.
    }
  }, []);

  useEffect(() => {
    if (!socket || !connected) return;

    socket.emit("presence:list", {}, (response) => {
      if (response.ok) setPlayers(response.data.players);
    });

    const onPresence = (payload: { players: OnlinePlayer[] }) => {
      setPlayers(payload.players);
    };
    socket.on("presence:update", onPresence);
    return () => {
      socket.off("presence:update", onPresence);
    };
  }, [socket, connected]);

  useEffect(() => {
    if (target && !players.some((player) => player.uid === target.uid)) {
      setTarget(null);
    }
  }, [players, target]);

  function findOpponent() {
    if (!socket || !connected) {
      setError("Still connecting to the game server…");
      return;
    }
    setError(null);
    cancelRequestedRef.current = false;
    searchingRef.current = true;
    setSearching(true);
    setSearchStartedAt(Date.now());

    const timeout = window.setTimeout(() => {
      setSearching(false);
      setError("The matchmaker didn't respond. Is the Socket.IO process running?");
    }, 10_000);

    socket.emit(
      "matchmaking:find",
      {
        timeControl: {
          initialSec: selected.initialSec,
          incrementSec: selected.incrementSec,
        },
        mode,
      },
      (response) => {
        window.clearTimeout(timeout);
        if (!response.ok) {
          setSearching(false);
          setError(response.message);
        }
      }
    );
  }

  function cancelSearch() {
    cancelRequestedRef.current = true;
    searchingRef.current = false;
    setSearching(false);

    socket?.emit("matchmaking:cancel", {}, (response) => {
      if (!response) return;
      if (!response.ok) {
        setError(response.message);
        return;
      }
      // The pairing won the race and the game already started: join it.
      if (!response.data.cancelled && response.data.gameId) {
        cancelRequestedRef.current = false;
        router.push(`/game/${response.data.gameId}`);
      }
    });
  }

  function sendChallenge() {
    if (!socket || !connected || !target) return;
    setSendingChallenge(true);
    setChallengeError(null);
    setNotice(null);

    const timeout = window.setTimeout(() => {
      setSendingChallenge(false);
      setChallengeError("The server didn't respond. Try again.");
    }, 10_000);

    socket.emit(
      "challenge:create",
      {
        toUid: target.uid,
        timeControl: {
          initialSec: selected.initialSec,
          incrementSec: selected.incrementSec,
        },
        mode,
        color: challengeColor,
      },
      (response) => {
        window.clearTimeout(timeout);
        setSendingChallenge(false);
        if (response.ok) {
          setNotice(`Challenge sent to ${target.displayName}.`);
        } else {
          setChallengeError(response.message);
        }
      }
    );
  }

  function createLinkGame() {
    if (!socket || !connected) {
      setError("Still connecting to the game server…");
      return;
    }
    setCreatingLink(true);
    setError(null);

    const timeout = window.setTimeout(() => {
      setCreatingLink(false);
      setError("The game server didn't respond. Is the Socket.IO process running?");
    }, 10_000);

    socket.emit(
      "game:create",
      {
        timeControl: {
          initialSec: selected.initialSec,
          incrementSec: selected.incrementSec,
        },
        mode: "casual",
      },
      (response) => {
        window.clearTimeout(timeout);
        setCreatingLink(false);
        if (response.ok) {
          router.push(`/game/${response.data.gameId}`);
        } else {
          setError(response.message);
        }
      }
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="animate-rise">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">Play</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Find your next game
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Pick a time control and get paired with a player near your rating. Or send a
          private link to a friend — clocks, legality and results are enforced by the
          server either way.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="animate-rise rounded-2xl border border-border bg-panel/60 p-5 sm:p-6">
          <div className="mb-6">
            <h2 className="mb-2.5 text-sm font-semibold">Game type</h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("casual")}
                aria-pressed={mode === "casual"}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition-all",
                  mode === "casual"
                    ? "border-brand/70 bg-brand/10"
                    : "border-border bg-background/40 hover:border-[#33415a] hover:bg-background/70",
                )}
              >
                <span className="block text-sm font-semibold">Casual</span>
                <span className="mt-0.5 block text-[11px] text-muted">
                  Pair with anyone, usually faster
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMode("rated")}
                aria-pressed={mode === "rated"}
                className={cn(
                  "rounded-xl border px-3 py-3 text-left transition-all",
                  mode === "rated"
                    ? "border-brand/70 bg-brand/10"
                    : "border-border bg-background/40 hover:border-[#33415a] hover:bg-background/70",
                )}
              >
                <span className="block text-sm font-semibold">Rated</span>
                <span className="mt-0.5 block text-[11px] text-muted">
                  Paired by rating with an expanding window
                </span>
              </button>
            </div>
          </div>

          {GROUPS.map((group) => {
            const options = TIME_CONTROLS.filter((option) => option.category === group.id);
            return (
              <div key={group.id} className="mb-6 last:mb-0">
                <div className="mb-2.5 flex items-baseline justify-between">
                  <h2 className={cn("text-sm font-semibold", group.accent)}>{group.label}</h2>
                  <span className="text-xs text-muted">{group.hint}</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {options.map((option) => {
                    const active = option.id === selected.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelected(option)}
                        aria-pressed={active}
                        className={cn(
                          "group rounded-xl border px-3 py-3 text-left transition-all",
                          active
                            ? "border-brand/70 bg-brand/10 shadow-[0_0_0_1px_rgba(126,196,107,0.35)_inset]"
                            : "border-border bg-background/40 hover:border-[#33415a] hover:bg-background/70",
                        )}
                      >
                        <span className="block font-mono text-base font-semibold">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-muted">
                          {option.incrementSec ? `+${option.incrementSec}s` : "No increment"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {notice ? (
            <p
              role="status"
              className="mb-4 rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-xs text-brand"
            >
              {notice}
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted">
              <span className="font-medium text-foreground">
                {labelFor(selected)}
              </span> {" "}
              · {categoryFor(selected.initialSec, selected.incrementSec)} · {mode}
            </div>
            <Button
              size="lg"
              onClick={findOpponent}
              loading={searching}
              disabled={!connected}
            >
              {connected ? "Find opponent" : "Connecting to server…"}
            </Button>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="animate-rise rounded-2xl border border-border bg-panel/40 p-5">
            <h2 className="text-sm font-semibold">Challenge a player</h2>
            <p className="mt-1 text-xs text-muted">
              Online now · {labelFor(selected)} · {mode}
            </p>

            <div className="mt-3">
              {players.filter((player) => player.uid !== user?.uid).length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted">
                  No one else is online right now. Open a second window to test a
                  challenge.
                </p>
              ) : (
                <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                  {players
                    .filter((player) => player.uid !== user?.uid)
                    .map((player) => {
                      const active = target?.uid === player.uid;
                      return (
                        <button
                          key={player.uid}
                          type="button"
                          onClick={() => setTarget(player)}
                          aria-pressed={active}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs transition-colors",
                            active
                              ? "border-brand/70 bg-brand/15 text-foreground"
                              : "border-border bg-background/40 text-muted hover:text-foreground",
                          )}
                        >
                          {player.displayName}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="mt-3">
              <span className="text-[11px] uppercase tracking-wide text-muted">
                Your color
              </span>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {["white", "random", "black"].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setChallengeColor(color as ChallengeColor)}
                    aria-pressed={challengeColor === color}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-xs transition-colors",
                      challengeColor === color
                        ? "border-brand/70 bg-brand/10 text-foreground"
                        : "border-border bg-background/40 text-muted hover:text-foreground",
                    )}
                  >
                    {color === "white" ? "White" : color === "black" ? "Black" : "Random"}
                  </button>
                ))}
              </div>
            </div>

            {challengeError ? (
              <p role="alert" className="mt-2 text-xs text-danger">
                {challengeError}
              </p>
            ) : null}

            <Button
              size="sm"
              className="mt-3 w-full"
              onClick={sendChallenge}
              loading={sendingChallenge}
              disabled={!connected || !target}
            >
              {target ? `Challenge ${target.displayName}` : "Select a player"}
            </Button>
          </div>

          <div className="animate-rise rounded-2xl border border-border bg-panel/40 p-5">
            <h2 className="text-sm font-semibold">Play a friend</h2>
            <p className="mt-2 text-sm text-muted">
              Create a private game at the selected time control and share the link. You
              start as white and the clocks begin when they join.
            </p>
            <Button
              variant="secondary"
              className="mt-4 w-full"
              onClick={createLinkGame}
              loading={creatingLink}
              disabled={!connected}
            >
              Create link game · {labelFor(selected)}
            </Button>
          </div>

          <div className="animate-rise rounded-2xl border border-border bg-panel/40 p-5">
            <h2 className="text-sm font-semibold">How matchmaking works</h2>
            <ol className="mt-3 space-y-3 text-sm text-muted">
              {[
                "Choose a time control and game type.",
                "Rated games start at ±100 rating and widen by 50 every 5 seconds, up to ±400.",
                "Casual games pair on time control alone.",
                "Colors are assigned randomly and both clocks start together.",
              ].map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="animate-rise rounded-2xl border border-border bg-panel/40 p-5 text-sm text-muted">
            <h2 className="font-semibold text-foreground">Fair play by default</h2>
            <p className="mt-2">
              Every move is validated with a full rules engine, including castling, en
              passant, promotion and draw rules. Leaving a game gives your opponent 60
              seconds to wait for you before the clock forfeits.
            </p>
          </div>

          {user?.demo ? (
            <div className="animate-rise rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-xs text-amber-200">
              Demo mode: you're signed in as a local guest. Open the game link in a
              private window to play both sides.
            </div>
          ) : null}
        </aside>
      </div>

      {searching ? (
        <SearchingOverlay
          startedAt={searchStartedAt}
          mode={mode}
          label={labelFor(selected)}
          onCancel={cancelSearch}
        />
      ) : null}
    </div>
  );
}

function SearchingOverlay({
  startedAt,
  mode,
  label,
  onCancel,
}: {
  startedAt: number;
  mode: GameMode;
  label: string;
  onCancel: () => void;
}) {
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const elapsedMs = Math.max(0, now - startedAt);
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const ratingWindow = Math.min(400, 100 + 50 * Math.floor(elapsedMs / 5000));
  const wideningIn = 5 - (Math.floor(elapsedMs / 5000) % 5);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="searching-title"
    >
      <div className="animate-pop w-full max-w-sm rounded-2xl border border-border bg-panel p-6 text-center">
        <div className="relative mx-auto mb-4 size-14">
          <span className="absolute inset-0 rounded-full border-2 border-brand/25" />
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <span className="absolute inset-0 grid place-items-center text-lg">♞</span>
        </div>

        <h2 id="searching-title" className="text-lg font-semibold">
          Searching for an opponent
        </h2>
        <p className="mt-1 text-sm text-muted" aria-live="polite">
          {label} · {mode} · {Math.floor(elapsedSec / 60)}:
          {String(elapsedSec % 60).padStart(2, "0")}
        </p>

        <p className="mt-4 rounded-lg border border-border bg-background/50 px-3 py-2 text-xs text-muted">
          {mode === "rated" ? (
            <>
              Rating window <span className="font-mono text-foreground">±{ratingWindow}</span>
              <span className="text-muted/70"> · widening in {wideningIn}s</span>
            </>
          ) : (
            "Pairing on time control alone — any rating is welcome."
          )}
        </p>

        <Button variant="secondary" className="mt-5 w-full" onClick={onCancel}>
          Cancel search
        </Button>
      </div>
    </div>
  );
}