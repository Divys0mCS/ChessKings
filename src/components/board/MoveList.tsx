"use client";

import { useEffect, useRef } from "react";
import type { MoveRecord } from "@/shared/types";

export function MoveList({ moves }: { moves: MoveRecord[] }) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [moves.length]);

  if (moves.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted">
        Moves will appear here
      </div>
    );
  }

  const rows: Array<{ number: number; white?: MoveRecord; black?: MoveRecord }> = [];
  for (let index = 0; index < moves.length; index += 2) {
    rows.push({
      number: index / 2 + 1,
      white: moves[index],
      black: moves[index + 1],
    });
  }

  return (
    <div className="h-40 overflow-y-auto rounded-xl border border-border bg-background/40 font-mono text-sm lg:h-56">
      <table className="w-full border-collapse">
        <tbody>
          {rows.map((row) => (
            <tr key={row.number} className="odd:bg-white/[0.02]">
              <td className="w-10 py-1 pl-3 text-right text-xs text-muted">{row.number}.</td>
              <td className="py-1 pl-3 pr-2">{row.white?.san ?? ""}</td>
              <td className="py-1 pl-2 pr-3 text-foreground/85">{row.black?.san ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div ref={endRef} />
    </div>
  );
}
