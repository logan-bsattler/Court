/// <reference lib="webworker" />
import type { PlayerView } from "../engine/game";
import { makeRng } from "../engine/rng";
import { type Difficulty, LEVELS, analyse } from "./agent";

export interface AiRequest {
  id: number;
  view: PlayerView;
  difficulty: Difficulty;
  seed: number;
}

export interface AiResponse {
  id: number;
  move: number;
  worlds: number;
  ms: number;
}

self.onmessage = (e: MessageEvent<AiRequest>) => {
  const { id, view, difficulty, seed } = e.data;
  const t = performance.now();
  const a = analyse(view, LEVELS[difficulty], makeRng(seed));
  const res: AiResponse = { id, move: a.move, worlds: a.worldsExamined, ms: performance.now() - t };
  (self as unknown as Worker).postMessage(res);
};
