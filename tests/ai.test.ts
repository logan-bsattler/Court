import { describe, expect, it } from "vitest";
import { LEVELS } from "../src/ai/agent";
import { summarise, versus } from "../src/ai/selfplay";
import { Solver } from "../src/ai/solver";
import { DEFAULT_RULES, rules } from "../src/engine/rules";

// Layouts solved by reference/solve.py. Values are player 1's perfect-play margin with:
// default rules, the Service counter off, and both counters off.
const SOLVED: [number[], number, number, number][] = [
  [[3, 9, 5, 7, 12, 1, 0, 8, 2, 13, 6, 4, 11, 14, 15, 10], 0, 0, 0],
  [[12, 6, 14, 0, 9, 1, 4, 13, 3, 5, 7, 2, 10, 11, 15, 8], 0, 2, 0],
  [[12, 6, 3, 9, 2, 13, 10, 11, 1, 8, 5, 15, 0, 14, 7, 4], 0, 2, 0],
  [[13, 11, 9, 15, 3, 5, 6, 14, 2, 8, 10, 1, 7, 0, 12, 4], 0, 0, 0],
];

describe("solver", () => {
  it("agrees with the Python exact solver", () => {
    for (const [layout, def, noCounter, neither] of SOLVED) {
      expect(new Solver(layout, DEFAULT_RULES).solve()).toBe(def);
      expect(new Solver(layout, rules({ counteredService: 4 })).solve()).toBe(noCounter);
      expect(new Solver(layout, rules({ counteredService: 4, deposedMarriage: 6 })).solve()).toBe(neither);
    }
  });
});

describe("AI strength", () => {
  it("medium beats a random player comfortably on a quick sample", () => {
    const s = summarise(versus(10, DEFAULT_RULES, { ...LEVELS.medium, timeBudgetMs: 0 }, "random"));
    expect(s.mean).toBeGreaterThanOrEqual(3);
  });

  // The full acceptance run (100 deals per level) takes a few minutes: `npm run bench`.
  it.runIf(process.env.COURT_BENCH === "1")("hard beats random by at least +3 over 100 seeded deals", () => {
    const s = summarise(versus(100, DEFAULT_RULES, { ...LEVELS.hard, timeBudgetMs: 0 }, "random"));
    expect(s.mean).toBeGreaterThanOrEqual(3);
  }, 900_000);
});
