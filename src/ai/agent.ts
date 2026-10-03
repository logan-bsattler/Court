import type { Card, Pos } from "../engine/cards";
import { legalClaims, type PlayerView } from "../engine/game";
import { type Rng, shuffle } from "../engine/rng";
import { Solver } from "./solver";

/**
 * Determinized (PIMC) opponent. The agent only ever receives a PlayerView,
 * so it cannot see face-down cards it has not claimed. For each world
 * consistent with its view it solves the game exactly, then takes the move
 * with the best average margin.
 *
 * Known limit: inside each world the opponent is assumed to see everything,
 * so the agent never bluffs or plays to conceal (see FINDINGS.md).
 */

export type Difficulty = "easy" | "medium" | "hard";

export interface AiLevel {
  /** Worlds to examine. Enumerated exactly when the belief space is no larger. */
  worlds: number;
  /** Always examine at least this many worlds, even past the time budget. */
  minWorlds: number;
  /** Stop adding worlds after this many ms (0 = no limit). */
  timeBudgetMs: number;
  /** Choose randomly among moves whose average is within this many points of the best. */
  tolerance: number;
}

export const LEVELS: Record<Difficulty, AiLevel> = {
  easy: { worlds: 2, minWorlds: 1, timeBudgetMs: 800, tolerance: 3 },
  medium: { worlds: 6, minWorlds: 2, timeBudgetMs: 2500, tolerance: 0.5 },
  hard: { worlds: 24, minWorlds: 4, timeBudgetMs: 6000, tolerance: 0 },
};

function factorial(n: number): number {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const out: T[][] = [];
  items.forEach((x, i) => {
    for (const rest of permutations([...items.slice(0, i), ...items.slice(i + 1)])) out.push([x, ...rest]);
  });
  return out;
}

/** Layouts consistent with the view: enumerated if there are at most `cap`, else `cap` random samples. */
export function possibleWorlds(view: PlayerView, cap: number, rng: Rng): Card[][] {
  const unknownPos: Pos[] = [];
  view.cells.forEach((c, p) => { if (c === null) unknownPos.push(p); });
  const base = view.cells.map((c) => (c === null ? -1 : c));
  if (unknownPos.length === 0) return [base];
  const fill = (perm: readonly Card[]): Card[] => {
    const lay = base.slice();
    unknownPos.forEach((p, i) => { lay[p] = perm[i]; });
    return lay;
  };
  if (factorial(unknownPos.length) <= cap) {
    return shuffle(permutations([...view.unseen]), rng).map(fill);
  }
  return Array.from({ length: cap }, () => fill(shuffle([...view.unseen], rng)));
}

export interface MoveAnalysis {
  move: Pos;
  /** Average value per candidate move, from the AI's perspective. */
  values: Map<Pos, number>;
  worldsExamined: number;
}

export function analyse(view: PlayerView, level: AiLevel, rng: Rng, now: () => number = () => performance.now()): MoveAnalysis {
  const moves = legalClaims(view);
  if (moves.length === 0) throw new Error("no legal claims: game is over");
  if (moves.length === 1) return { move: moves[0], values: new Map([[moves[0], 0]]), worldsExamined: 0 };

  const start = now();
  const totals = new Map<Pos, number>(moves.map((m) => [m, 0]));
  let examined = 0;
  for (const lay of possibleWorlds(view, level.worlds, rng)) {
    if (examined >= level.minWorlds && level.timeBudgetMs > 0 && now() - start > level.timeBudgetMs) break;
    const solver = new Solver(lay, view.rules);
    let p1 = 0, p2 = 0;
    for (const p of view.claims[0]) p1 |= 1 << lay[p];
    for (const p of view.claims[1]) p2 |= 1 << lay[p];
    for (const m of moves) totals.set(m, totals.get(m)! + solver.moveValue(view.occupied, p1, p2, m));
    examined++;
  }

  const values = new Map<Pos, number>();
  for (const [m, t] of totals) values.set(m, t / examined);
  const best = Math.max(...values.values());
  const near = moves.filter((m) => values.get(m)! >= best - level.tolerance - 1e-9);
  return { move: near[rng.int(near.length)], values, worldsExamined: examined };
}

export function chooseMove(view: PlayerView, level: AiLevel, rng: Rng): Pos {
  return analyse(view, level, rng).move;
}
