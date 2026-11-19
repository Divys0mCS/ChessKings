"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { formatClock } from "@/shared/timeControl";
import type { PlayerSummary } from "@/shared/types";

const GLYPHS: Record<string, string> = {
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
};

type PlayerBarProps = {
  player: PlayerSummary | null;
  color: "white" | "black";
  /** Server timestamp (epoch ms, client clock) when `baseMs` was captured. */
  syncedAt: number;
  baseMs: number;
  /** True while this player's clock is running. */
  ticking: boolean;
  isMe: boolean;
  captured: string[];
  /** Relative forfeit countdown, anchored to when the client received it. */
  disconnect: { remainingMs: number; at: number } | null;
};

export function PlayerBar({
  player,
  color,
  syncedAt,
  baseMs,
  ticking,
  isMe,
  captured,
  disconnect,
}: PlayerBarProps) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    if (!ticking && !disconnect) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [ticking, disconnect]);

  const reference = now || syncedAt;
  const timeMs = Math.max(0, baseMs - (ticking ? Math.max(0, reference - syncedAt) : 0));
  const disconnectSeconds =
    disconnect === null
      ? null
      : Math.max(
          0,
          Math.ceil(
            (disconnect.remainingMs - Math.max(0, (now || disconnect.at) - disconnect.at)) /
              1000,
          ),
        );

  const low = ticking && timeMs <= 20_000;
  const pieces = [...captured].sort((a, b) => "pnbrq".indexOf(a) - "pnbrq".indexOf(b));

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg text-sm font-semibold uppercase",
            color === "white"
              ? "bg-[#e9edf2] text-[#1b2118]"
              : "bg-[#1c2430] text-[#e9edf2] ring-1 ring-inset ring-white/15",
          )}
          aria-hidden
        >
          {player ? player.displayName.slice(0, 1) : "?"}
        </span>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">
              {player ? player.displayName : "Waiting for opponent…"}
            </span>
            {isMe ? (
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                You
              </span>
            ) : null}
            {player && !player.connected ? (
              <span className="rounded bg-danger/15 px-1.5 py-0.5 text-[10px] font-semibold text-danger">
                {disconnectSeconds !== null ? `${disconnectSeconds}s` : "offline"}
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex h-4 items-center gap-2 text-[11px] text-muted">
            <span className="font-mono">{player ? player.rating : "—"}</span>
            {pieces.length > 0 ? (
              <span className="truncate text-muted/80" aria-label="Captured pieces">
                {pieces.map((piece) => GLYPHS[piece] ?? "").join("")}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "shrink-0 rounded-lg border px-3 py-1.5 font-mono text-xl tabular-nums transition-colors",
          ticking
            ? "border-brand/40 bg-brand/10 text-foreground"
            : "border-border bg-background/50 text-muted",
          low && "border-danger/50 bg-danger/15 text-danger",
        )}
        aria-label={`${color} clock ${formatClock(timeMs)}`}
      >
        {formatClock(timeMs)}
      </div>
    </div>
  );
}
