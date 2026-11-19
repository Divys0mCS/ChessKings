"use client";

import { useEffect, useState } from "react";
import { analyzePosition } from "@/lib/engine";

type StockfishAnalysisProps = {
  fen: string;
};

type AnalysisState = {
  depth: number;
  evaluation: number | null;
  bestMove: string | null;
  isReady: boolean;
};

export function StockfishAnalysis({ fen }: StockfishAnalysisProps) {
  const [analysis, setAnalysis] = useState<AnalysisState>({
    depth: 0,
    evaluation: null,
    bestMove: null,
    isReady: false,
  });

  useEffect(() => {
    if (!fen) {
      setAnalysis({
        depth: 0,
        evaluation: null,
        bestMove: null,
        isReady: false,
      });
      return;
    }

    // Analyze position with Stockfish (async, don't await at top level)
    ;(async () => {
      const result = await analyzePosition(fen, 15);

      setAnalysis({
        depth: result.depthReached ?? 0,
        evaluation: result.evaluation ?? null,
        bestMove: result.bestMove ?? null,
        isReady: true,
      });
    })();
  }, [fen]);

  if (!fen) {
    return <div className="p-4 text-muted">Enter a FEN position to analyze</div>;
  }

  return (
    <div className="rounded-2xl border border-border bg-panel/60 p-4">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.1em] text-muted">Evaluation</p>
        {analysis.isReady ? (
          <div>
            {analysis.bestMove && (
              <p className="font-medium text-foreground">
                Best move: {analysis.bestMove}
              </p>
            )}
            {analysis.evaluation !== null && (
              <p className="text-sm">
                {analysis.evaluation > 0 ? "White advantage" : analysis.evaluation < 0 ? "Black advantage" : "Equal position"}
                {analysis.evaluation !== null && (
                  <span className="ml-2 text-xs font-mono">
                    {analysis.evaluation > 0 ? `+${analysis.evaluation}` : analysis.evaluation < 0 ? `${analysis.evaluation}` : "0"}
                  </span>
                )}
              </p>
            )}
            {analysis.bestMove && (
              <p className="text-xs text-muted/60 mt-1">
                Depth: {analysis.depth}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted">Engine loading...</p>
        )}
      </div>
    </div>
  );
}