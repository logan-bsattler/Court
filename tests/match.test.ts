import { describe, expect, it } from "vitest";
import { applyClaim, isOver, legalClaims } from "../src/engine/game";
import { DEFAULT_RULES } from "../src/engine/rules";
import { aiSeat, finishDeal, hasNextDeal, humanSeat, newMatch, outcome, startNextDeal, totals } from "../src/ui/match";

describe("match", () => {
  it("plays two deals with seats swapped and sums scores per side", () => {
    const m = newMatch(DEFAULT_RULES, [10, 20]);
    expect(humanSeat(0)).toBe(0);
    expect(humanSeat(1)).toBe(1);
    expect(aiSeat(1)).toBe(0);
    const expected = { human: 0, ai: 0 };
    for (let d = 0; d < 2; d++) {
      while (!isOver(m.state)) m.state = applyClaim(m.state, legalClaims(m.state)[0]);
      const r = finishDeal(m);
      expected.human += r.scores[humanSeat(d)];
      expected.ai += r.scores[aiSeat(d)];
      if (hasNextDeal(m)) startNextDeal(m);
    }
    expect(hasNextDeal(m)).toBe(false);
    expect(totals(m)).toEqual(expected);
    const o = outcome(m);
    expect(o).toBe(expected.human > expected.ai ? "win" : expected.human < expected.ai ? "loss" : "draw");
  });
});
