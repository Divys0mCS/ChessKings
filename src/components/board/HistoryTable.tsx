"use client";

import { useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import { MoveRecord } from "@/shared/types";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

type HistoryTableProps = {
  fen: string | null;
  moves: MoveRecord[];
  onMoveChange?: (moveNumber: number) => void;
};

export function HistoryTable({ fen, moves, onMoveChange }: HistoryTableProps) {
  const [chess, setChess] = useState<Chess | null>(null);
  const [moveNumbers, setMoveNumbers] = useState<number[]>([]);
  const [highlightedMove, setHighlightedMove] = useState(0);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    setChess(new Chess(fen ?? "8/8/8/8/8/8/8/8 w - - 0 1"));
    // Generate move numbers (1-indexed, each number covers white + black)
    const numbers: number[] = [];
    for (let i = 0; i < moves.length; i += 2) {
      numbers.push(i / 2 + 1);
    }
    setMoveNumbers(numbers);
  }, [fen, moves]);

  // Apply moves to chess board by loading PGN
  useEffect(() => {
    if (!chess) return;
    const game = new Chess(fen ?? "8/8/8/8/8/8/8/8 w - - 0 1");
    const pgn = game.pgn();
    // chess.js load_pgn can parse the PGN
    try {
      const loaded = new Chess();
      loaded.loadPgn(pgn);
      setChess(loaded);
    } catch (e) {
      console.error("[history] Failed to load PGN:", e);
      setChess(new Chess());
    }
  }, [chess, fen, moves]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!chess) return;
    
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = highlightedMove + 1;
      if (next < moveNumbers.length) {
        setHighlightedMove(next);
        onMoveChange?.(moveNumbers[next] - 1);
      }
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = highlightedMove - 1;
      if (prev >= 0) {
        setHighlightedMove(prev);
        onMoveChange?.(moveNumbers[prev] - 1);
      }
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [chess, highlightedMove, onMoveChange]);

  if (!chess || moves.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-muted">
        No moves to display
      </div>
    );
  }

  // Calculate position after highlighted move
  let sanMoves = moves.slice(0, highlightedMove * 2);
  const game = new Chess(fen ?? "8/8/8/8/8/8/8/8 w - - 0 1");
  game.loadPgn(sanMoves.map((m) => m.san).join(". "));

  const rows: Array<{ number: number; white?: MoveRecord; black?: MoveRecord; sanWhite: string; sanBlack: string }> = [];
  for (let index = 0; index < moves.length; index += 2) {
    const whiteMove = moves[index];
    const blackMove = moves[index + 1];
    rows.push({
      number: index / 2 + 1,
      white: whiteMove,
      black: blackMove,
      sanWhite: whiteMove?.san ?? "",
      sanBlack: blackMove?.san ?? "",
    });
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-background/50 p-3">
        <p className="text-xs uppercase tracking-[0.1em] text-muted">
          Move history
        </p>
        <div className="h-40 overflow-y-auto rounded-xl border border-border bg-background/40 font-mono text-sm lg:h-56">
          <table className="w-full border-collapse">
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.number}
                  className={cn(
                    "odd:bg-white/[0.02] cursor-pointer transition-colors",
                    highlightedMove === row.number - 1 ? "bg-highlight/30" : ""
                  )}
                  onClick={() => onMoveChange?.(row.number - 1)}
                  role="button"
                  tabIndex={0}
                >
                  <td className="w-10 py-1 pl-3 text-right text-xs text-muted">
                    {row.number}.</td>
                  <td className="py-1 pl-3 pr-2">
                    {row.sanWhite}
                    {row.black ? ` ${row.sanBlack}` : ""}
                  </td>
                  <td className="py-1 pl-2 pr-3 text-foreground/85">
                    {row.sanBlack}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="size-0" />
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onMoveChange?.(0)}
          disabled={highlightedMove === 0}
        >
          ⏪ First
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const next = highlightedMove + 1;
            if (next < moveNumbers.length) {
              setHighlightedMove(next);
              onMoveChange?.(moveNumbers[next] - 1);
            }
          }}
          disabled={highlightedMove >= moveNumbers.length - 1}
        >
          ⏩ Last
        </Button>
      </div>
    </div>
  );
}