"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useChallenges } from "@/components/providers/ChallengesProvider";
import { useSocket } from "@/components/providers/SocketProvider";
import { Button } from "@/components/ui/Button";
import { describeTimeControl } from "@/shared/timeControl";

function CrownMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-6 text-brand" fill="currentColor">
      <path d="M3 8.2 6.6 11l2.2-4.6a3.5 3.5 0 0 1 6.4 0L17.4 11 21 8.2l-1.5 10.1A2 2 0 0 1 17.5 20h-11a2 2 0 0 1-2-1.7L3 8.2Zm6 9.3h6v-1.4H9v1.4Z" />
    </svg>
  );
}

function Remaining({ expiresAt }: { expiresAt: number }) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  const seconds = Math.max(0, Math.ceil((expiresAt - (now || Date.now())) / 1_000));
  return (
    <span className="font-mono">
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
    </span>
  );
}

export function SiteHeader() {
  const { user, signOutUser } = useAuth();
  const { connected } = useSocket();
  const { incoming, outgoing, accept, decline, cancel } = useChallenges();
  const router = useRouter();
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);
  const [challengesOpen, setChallengesOpen] = useState(false);

  useEffect(() => setChallengesOpen(false), [pathname]);

  async function handleSignOut() {
    setSigningOut(true);
    await signOutUser();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <CrownMark />
            <span className="text-lg">
              Chess<span className="text-brand">Kings</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <Link
              href="/"
              className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-white/5 hover:text-foreground"
            >
              Play
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="hidden items-center gap-1.5 text-xs text-muted sm:flex"
            title={connected ? "Connected to game server" : "Connecting to game server"}
          >
            <span
              className={`size-1.5 rounded-full ${connected ? "bg-brand" : "bg-amber-400"}`}
            />
            {connected ? "Live" : "Connecting"}
          </span>

          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setChallengesOpen((open) => !open)}
                aria-expanded={challengesOpen}
                aria-label={`Challenges${
                  incoming.length ? ` (${incoming.length} pending)` : ""
                }`}
                className="relative grid size-9 place-items-center rounded-lg border border-border bg-panel text-muted transition-colors hover:text-foreground"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
                  <path d="M10 19a2 2 0 0 0 4 0" />
                </svg>
                {incoming.length ? (
                  <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-brand text-[10px] font-bold text-[#0a0d12]">
                    {incoming.length}
                  </span>
                ) : null}
              </button>

              {challengesOpen ? (
                <div className="absolute right-0 top-11 z-40 w-[19rem] rounded-2xl border border-border bg-panel p-3 shadow-2xl">
                  <div className="flex items-center justify-between px-1 pb-2">
                    <h2 className="text-sm font-semibold">Challenges</h2>
                    <button
                      type="button"
                      onClick={() => setChallengesOpen(false)}
                      className="text-xs text-muted hover:text-foreground"
                    >
                      Close
                    </button>
                  </div>

                  {incoming.length === 0 && outgoing.length === 0 ? (
                    <p className="px-1 py-3 text-sm text-muted">
                      No pending challenges. Challenge an online player from the lobby.
                    </p>
                  ) : null}

                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {incoming.map((challenge) => (
                      <div
                        key={challenge.id}
                        className="rounded-xl border border-border bg-background/50 p-2.5"
                      >
                        <p className="text-sm">
                          <span className="font-medium">{challenge.from.displayName}</span>{" "}
                          invited you
                        </p>
                        <p className="text-[11px] text-muted">
                          {describeTimeControl(challenge.timeControl)} · {challenge.mode} ·{" "}
                          {challenge.color === "random"
                            ? "random colors"
                            : `they play ${challenge.color}`}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted/80">
                          Expires in <Remaining expiresAt={challenge.expiresAtLocal} />
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => accept(challenge.id)}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => decline(challenge.id)}
                          >
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))}

                    {outgoing.map((challenge) => (
                      <div
                        key={challenge.id}
                        className="rounded-xl border border-border bg-background/50 p-2.5"
                      >
                        <p className="text-sm">
                          Waiting for <span className="font-medium">{challenge.to.displayName}</span>
                        </p>
                        <p className="text-[11px] text-muted">
                          {describeTimeControl(challenge.timeControl)} · {challenge.mode}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[11px] text-muted">
                            <Remaining expiresAt={challenge.expiresAtLocal} /> left
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cancel(challenge.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-border bg-panel py-1 pl-1 pr-3">
                <span className="grid size-7 place-items-center rounded-full bg-brand/15 text-xs font-semibold uppercase text-brand">
                  {user.displayName.slice(0, 1)}
                </span>
                <span className="max-w-[9rem] truncate text-sm">{user.displayName}</span>
                {user.demo ? (
                  <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                    Demo
                  </span>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                loading={signingOut}
                aria-label="Sign out"
              >
                Sign out
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
