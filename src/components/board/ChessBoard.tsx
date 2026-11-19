"use client";

import { useMemo, type CSSProperties } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";

type ChessBoardProps = {
  fen: string;
  orientation: "white" | "black";
  lastMove: { from: string; to: string } | null;
  selected: string | null;
  targets: string[];
  check: boolean;
  interactive: boolean;
  onSquareClick: (square: string) => void;
  /** Return true only when the move was accepted; false snaps the piece back. */
  onMove: (from: string, to: string) => boolean;
};

const LAST_MOVE = "rgba(255, 213, 79, 0.32)";
const SELECTED = "rgba(126, 196, 107, 0.42)";

export function ChessBoard({
  fen,
  orientation,
  lastMove,
  selected,
  targets,
  check,
  interactive,
  onSquareClick,
  onMove,
}: ChessBoardProps) {
  const { checkSquare, occupied } = useMemo(() => {
    const squares = new Map<string, boolean>();
    let kingSquare: string | null = null;
    try {
      const chess = new Chess(fen);
      const turn = chess.turn();
      for (const rank of chess.board()) {
        for (const square of rank) {
          if (!square) continue;
          squares.set(square.square, true);
          if (square.type === "k" && square.color === turn) kingSquare = square.square;
        }
      }
    } catch {
      // Invalid FEN while animating; skip highlights.
    }
    return { checkSquare: check ? kingSquare : null, occupied: squares };
  }, [fen, check]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};

    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: LAST_MOVE };
      styles[lastMove.to] = { backgroundColor: LAST_MOVE };
    }

    if (selected) {
      styles[selected] = {
        ...(styles[selected] ?? {}),
        backgroundColor: SELECTED,
      };
    }

    for (const target of targets) {
      styles[target] = {
        ...(styles[target] ?? {}),
        backgroundImage: occupied.has(target)
          ? "radial-gradient(circle, transparent 0 52%, rgba(12, 20, 8, 0.32) 53% 61%, transparent 62%)"
          : "radial-gradient(circle, rgba(12, 20, 8, 0.3) 0 17%, transparent 18%)",
      };
    }

    if (checkSquare) {
      styles[checkSquare] = {
        ...(styles[checkSquare] ?? {}),
        backgroundImage:
          "radial-gradient(circle, rgba(239, 107, 107, 0.9) 0 20%, rgba(239, 107, 107, 0.35) 21% 44%, transparent 45%)",
      };
    }

    return styles;
  }, [lastMove, selected, targets, occupied, checkSquare]);

  return (
    <div className="relative overflow-hidden rounded-xl" aria-label="Chess board" role="grid">
      <div className="max-w-[560px] w-full mx-auto rounded-xl" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
        <Chessboard
          options={{
            position: fen,
            boardOrientation: orientation,
            allowDragging: interactive,
            showNotation: true,
            animationDurationInMs: 180,
            boardStyle: { width: "100%", borderRadius: "12px", touchAction: "none" },
            darkSquareStyle: { backgroundColor: "var(--board-dark)" },
            lightSquareStyle: { backgroundColor: "var(--board-light)" },
            darkSquareNotationStyle: { color: "rgba(233, 237, 242, 0.55)" },
            lightSquareNotationStyle: { color: "rgba(20, 28, 18, 0.55)" },
            squareStyles,
            onSquareClick: ({ square }) => onSquareClick(square),
            onPieceDrop: ({ sourceSquare, targetSquare }) => {
              if (!targetSquare || !interactive) return false;
              return onMove(sourceSquare as Square, targetSquare as Square);
            },
          }}
        />
      </div>
    </div>
  );
}