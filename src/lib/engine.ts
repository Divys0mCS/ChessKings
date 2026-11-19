"use client";

import { useEffect, useState } from "react";

// Stockfish.js types
type EngineMessage =
  | { type: "ready" }
  | { type: "info"; data: { depth?: number; multipv?: number; pv?: string[]; score?: { type: "cp" | "mate"; value?: number; mate?: number } } }
  | { type: "bestmove"; data: { move: string } }
  | { type: "error"; data: string };

const WORKER_PATH = "/_next/static/chunks/stockfish.worker.js";

// Create a Stockfish web worker
function createStockfishWorker(): Worker {
  // Check if we're in a browser environment
  if (typeof window === "undefined") {
    // Return a mock worker for SSR
    return {
      postMessage: () => {},
      onmessage: { addEventListener: () => {}, removeEventListener: () => {} },
    } as unknown as Worker;
  }

  const worker = new Worker(
    WORKER_PATH,
    {
      type: "module" as WorkerType,
    }
  );

  return worker;
}

// Initialize Stockfish in the worker
export function initStockfish(): Promise<Worker> {
  const worker = createStockfishWorker();

  return new Promise((resolve, reject) => {
    worker.onmessage = (event: MessageEvent) => {
      const message: EngineMessage = event.data;

      if (message.type === "ready") {
        resolve(worker);
      } else if (message.type === "error") {
        reject(new Error(message.data));
      }
    };

    // Start Stockfish with the UCI command
    setTimeout(() => {
      worker.postMessage("uci");
    }, 100);

    // Set a timeout to reject if engine doesn't initialize
    setTimeout(() => {
      reject(new Error("Stockfish engine failed to initialize"));
    }, 5000);
  });
}

// Analyze a position with Stockfish
export function analyzePosition(fen: string, depth: number = 15): Promise<{
  bestMove: string | null;
  evaluation: number | null; // centipawns (positive = white advantage)
  depthReached: number | null;
  pv: string[]; // principal variation
}> {
  if (typeof window === "undefined") {
    return Promise.resolve({
      bestMove: null,
      evaluation: null,
      depthReached: null,
      pv: [],
    });
  }

  return new Promise(async (resolve) => {
    const worker = await initStockfish();

    // Reset the engine
    worker.postMessage("ucinewgame");

    // Set the position
    worker.postMessage(`position fen ${fen}`);

    // Start analysis at the specified depth
    worker.postMessage(`go depth ${depth}`);

    let bestMove: string | null = null;
    let evaluation: number | null = null;
    let depthReached: number | null = null;
    let pv: string[] = [];

    const timeout = setTimeout(() => {
      // Engine finished or timed out
      worker.terminate();
      resolve({
        bestMove,
        evaluation,
        depthReached,
        pv,
      });
    }, depth * 200 + 1000);

    worker.onmessage = (event: MessageEvent) => {
      const message: EngineMessage = event.data;

      if (message.type === "bestmove") {
        bestMove = message.data.move;
      } else if (message.type === "info") {
        const data = message.data;

        if (data.depth && data.depth > (depthReached ?? 0)) {
          depthReached = data.depth;
        }

        if (data.pv && data.pv.length > 0) {
          pv = data.pv;
        }

        if (data.score) {
          if (data.score.type === "cp") {
            evaluation = data.score.value ?? null; // centipawns
          } else if (data.score.type === "mate") {
            evaluation = data.score.mate ?? null; // mate in N
          }
        }
      }
    };

    // Cleanup when promise resolves or rejects
    return () => {
      clearTimeout(timeout);
      worker.terminate();
    };
  });
}

// Stop the engine and clean up
export function stopStockfish(worker: Worker): void {
  worker.terminate();
}