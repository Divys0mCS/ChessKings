"use client";

import { useState } from "react";

type FenInputProps = {
  initialFen?: string;
  onFenChange: (fen: string) => void;
};

export function FenInput({ initialFen = "", onFenChange }: FenInputProps) {
  const [fen, setFen] = useState(initialFen);

  return (
    <div className="rounded-2xl border border-border bg-panel/60 p-4">
      <label className="block text-sm font-medium text-foreground mb-2">
        Position FEN
      </label>
      <textarea
        value={fen}
        onChange={(e) => {
          const value = e.target.value;
          // Basic FEN validation - check for spaces (FEN has 6 fields separated by spaces)
          if (value.split(" ").length === 6) {
            setFen(value);
            onFenChange(value);
          }
        }}
        className="w-full rounded border border-border px-3 py-2 text-muted resize-none min-h-[80px]"
        placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        aria-label="FEN position"
      />
    </div>
  );
}