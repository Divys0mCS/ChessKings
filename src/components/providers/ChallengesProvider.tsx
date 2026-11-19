"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSocket } from "@/components/providers/SocketProvider";
import { Button } from "@/components/ui/Button";
import { describeTimeControl } from "@/shared/timeControl";
import type { Challenge } from "@/shared/types";

export type LocalChallenge = Challenge & {
  /** Local epoch ms, anchored when the payload arrived (immune to clock skew). */
  expiresAtLocal: number;
};

type ChallengesContextValue = {
  incoming: LocalChallenge[];
  outgoing: LocalChallenge[];
  toast: LocalChallenge | null;
  accept: (challengeId: string) => void;
  decline: (challengeId: string) => void;
  cancel: (challengeId: string) => void;
  dismissToast: () => void;
};

const ChallengesContext = createContext<ChallengesContextValue | null>(null);

export function useChallenges(): ChallengesContextValue {
  const value = useContext(ChallengesContext);
  if (!value) {
    throw new Error("useChallenges must be used inside ChallengesProvider");
  }
  return value;
}

function localize(challenge: Challenge): LocalChallenge {
  return {
    ...challenge,
    expiresAtLocal: Date.now() + challenge.expiresInMs,
  };
}

function upsert(list: LocalChallenge[], challenge: Challenge): LocalChallenge[] {
  return [localize(challenge), ...list.filter((item) => item.id !== challenge.id)];
}

export function ChallengesProvider({ children }: { children: ReactNode }) {
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [incoming, setIncoming] = useState<LocalChallenge[]>([]);
  const [outgoing, setOutgoing] = useState<LocalChallenge[]>([]);
  const [toast, setToast] = useState<LocalChallenge | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const messageTimer = useRef<number | null>(null);

  const showMessage = useCallback((text: string) => {
    setMessage(text);
    if (messageTimer.current) window.clearTimeout(messageTimer.current);
    messageTimer.current = window.setTimeout(() => setMessage(null), 5_000);
  }, []);

  useEffect(
    () => () => {
      if (messageTimer.current) window.clearTimeout(messageTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!socket || !connected) return;
    socket.emit("challenge:list", {}, (response) => {
      if (!response.ok) return;
      setIncoming(response.data.incoming.map(localize));
      setOutgoing(response.data.outgoing.map(localize));
    });
  }, [socket, connected]);

  useEffect(() => {
    if (!socket) return;

    const onReceived = (challenge: Challenge) => {
      setIncoming((prev) => upsert(prev, challenge));
      setToast(localize(challenge));
    };

    const onSent = (challenge: Challenge) => {
      setOutgoing((prev) => upsert(prev, challenge));
    };

    const remove = (challengeId: string) => {
      setIncoming((prev) => prev.filter((item) => item.id !== challengeId));
      setOutgoing((prev) => prev.filter((item) => item.id !== challengeId));
      setToast((prev) => (prev?.id === challengeId ? null : prev));
    };

    const onExpired = (payload: { challengeId: string }) => {
      remove(payload.challengeId);
      showMessage("A challenge expired.");
    };

    const onAccepted = (payload: { challengeId: string; gameId: string }) => {
      remove(payload.challengeId);
      router.push(`/game/${payload.gameId}`);
    };

    const onDeclined = (payload: { challengeId: string; by: string }) => {
      remove(payload.challengeId);
      if (payload.by !== user?.uid) showMessage("Your challenge was declined.");
    };

    const onCancelled = (payload: { challengeId: string }) => {
      remove(payload.challengeId);
      showMessage("Challenge cancelled.");
    };

    socket.on("challenge:received", onReceived);
    socket.on("challenge:sent", onSent);
    socket.on("challenge:expired", onExpired);
    socket.on("challenge:accepted", onAccepted);
    socket.on("challenge:declined", onDeclined);
    socket.on("challenge:cancelled", onCancelled);

    return () => {
      socket.off("challenge:received", onReceived);
      socket.off("challenge:sent", onSent);
      socket.off("challenge:expired", onExpired);
      socket.off("challenge:accepted", onAccepted);
      socket.off("challenge:declined", onDeclined);
      socket.off("challenge:cancelled", onCancelled);
    };
  }, [socket, router, user?.uid, showMessage]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 10_000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const accept = useCallback(
    (challengeId: string) => {
      if (pathname.startsWith("/game/")) {
        showMessage("Finish your current game first.");
        return;
      }
      socket?.emit("challenge:accept", { challengeId }, (response) => {
        if (!response.ok) showMessage(response.message);
        else setToast(null);
      });
    },
    [pathname, socket, showMessage],
  );

  const decline = useCallback(
    (challengeId: string) => {
      socket?.emit("challenge:decline", { challengeId }, (response) => {
        if (response && !response.ok) showMessage(response.message);
      });
    },
    [socket, showMessage],
  );

  const cancel = useCallback(
    (challengeId: string) => {
      socket?.emit("challenge:cancel", { challengeId }, (response) => {
        if (response && !response.ok) showMessage(response.message);
      });
    },
    [socket, showMessage],
  );

  const dismissToast = useCallback(() => setToast(null), []);

  const value = useMemo(
    () => ({ incoming, outgoing, toast, accept, decline, cancel, dismissToast }),
    [incoming, outgoing, toast, accept, decline, cancel, dismissToast],
  );

  return (
    <ChallengesContext.Provider value={value}>
      {children}

      {toast ? (
        <div className="fixed inset-x-4 bottom-4 z-50 sm:left-auto sm:right-6 sm:w-80">
          <div
            role="status"
            className="animate-pop rounded-2xl border border-brand/40 bg-panel p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">
                  Challenge
                </p>
                <p className="mt-1 truncate text-sm font-semibold">
                  {toast.from.displayName}
                </p>
                <p className="text-xs text-muted">
                  {describeTimeControl(toast.timeControl)} · {toast.mode} ·{" "}
                  {toast.color === "random" ? "random colors" : `they play ${toast.color}`}
                </p>
              </div>
              <button
                type="button"
                onClick={dismissToast}
                aria-label="Dismiss challenge"
                className="rounded-md p-1 text-muted transition-colors hover:bg-white/5 hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => accept(toast.id)}>
                Accept
              </Button>
              <Button size="sm" variant="secondary" onClick={() => decline(toast.id)}>
                Decline
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {message ? (
        <div
          role="status"
          className="animate-pop fixed right-4 top-20 z-50 max-w-xs rounded-xl border border-border bg-panel px-4 py-3 text-sm text-foreground shadow-2xl"
        >
          {message}
        </div>
      ) : null}
    </ChallengesContext.Provider>
  );
}
