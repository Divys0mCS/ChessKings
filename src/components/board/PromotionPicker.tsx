"use client";

import type { PromotionPiece } from "@/shared/types";

const CHOICES: Array<{ piece: PromotionPiece; white: string; black: string; label: string }> = [
  { piece: "q", white: "♕", black: "♛", label: "Queen" },
  { piece: "r", white: "♖", black: "♜", label: "Rook" },
  { piece: "b", white: "♗", black: "♝", label: "Bishop" },
  { piece: "n", white: "♘", black: "♞", label: "Knight" },
];

type PromotionPickerProps = {
  color: "w" | "b";
  onSelect: (piece: PromotionPiece) => void;
  onCancel: () => void;
};

export function PromotionPicker({ color, onSelect, onCancel }: PromotionPickerProps) {
  return (
    <div
      className="absolute inset-0 z-20 grid place-items-center rounded-xl bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-label="Choose promotion piece"
    >
      <div className="animate-pop rounded-2xl border border-border bg-panel p-4 shadow-2xl">
        <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-muted">
          Promote to
        </p>
        <div className="flex gap-2">
          {CHOICES.map((choice) => (
            <button
              key={choice.piece}
              type="button"
              onClick={() => onSelect(choice.piece)}
              className="grid size-14 place-items-center rounded-xl border border-border bg-background/60 text-3xl transition-colors hover:border-brand/60 hover:bg-brand/10"
              aria-label={choice.label}
            >
              <span className={color === "w" ? "text-[#f4f7fa]" : "text-[#c9d2dd]"}>
                {color === "w" ? choice.white : choice.black}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="mt-3 w-full rounded-lg py-1.5 text-xs text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
