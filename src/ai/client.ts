import type { Pos } from "../engine/cards";
import type { PlayerView } from "../engine/game";
import { makeRng } from "../engine/rng";
import { type Difficulty, LEVELS, analyse } from "./agent";
import type { AiRequest, AiResponse } from "./worker";

interface Pending {
  done: (r: AiResponse) => void;
  fail: () => void;
}

/**
 * Runs the AI in a Web Worker so the UI stays responsive. Falls back to the
 * main thread if workers are unavailable or the worker fails. Only a
 * PlayerView ever crosses this boundary.
 */
export class AiClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  constructor() {
    try {
      this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
      this.worker.onmessage = (e: MessageEvent<AiResponse>) => {
        const p = this.pending.get(e.data.id);
        this.pending.delete(e.data.id);
        p?.done(e.data);
      };
      this.worker.onerror = () => this.abandonWorker();
    } catch {
      this.worker = null;
    }
  }

  private abandonWorker(): void {
    this.worker?.terminate();
    this.worker = null;
    const waiting = [...this.pending.values()];
    this.pending.clear();
    for (const p of waiting) p.fail();
  }

  choose(view: PlayerView, difficulty: Difficulty, seed: number): Promise<Pos> {
    const local = () => analyse(view, LEVELS[difficulty], makeRng(seed)).move;
    if (!this.worker) return Promise.resolve(local());
    const id = this.nextId++;
    const req: AiRequest = { id, view, difficulty, seed };
    return new Promise<Pos>((resolve) => {
      this.pending.set(id, {
        done: (r) => resolve(r.move),
        fail: () => resolve(local()),
      });
      this.worker!.postMessage(req);
    });
  }
}
