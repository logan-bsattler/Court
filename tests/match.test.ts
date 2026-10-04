import { describe, expect, it } from "vitest";
import { handFromNames } from "../src/engine/cards";
import { type DealResult, applyClaim, isOver, legalClaims } from "../src/engine/game";
import { allocate } from "../src/engine/scoring";
import { DEFAULT_RULES } from "../src/engine/rules";
import {
  TIEBREAKS, aiSeat, finishDeal, hasNextDeal, humanSeat, newMatch, outcome, startNextDeal, tiebreakTotals, totals, verdict,
} from "../src/ui/match";

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
    if (expected.human !== expected.ai) expect(outcome(m)).toBe(expected.human > expected.ai ? "win" : "loss");
  });
});

describe("match tiebreak", () => {
  const R = DEFAULT_RULES;
  const dealOf = (p1: string, p2: string): DealResult => {
    const h: [number, number] = [handFromNames(p1), handFromNames(p2)];
    const a0 = allocate(h[0], h[1], R), a1 = allocate(h[1], h[0], R);
    return { scores: [a0.total, a1.total], allocations: [a0, a1], margin: a0.total - a1.total, hands: h };
  };
  /** Human is player 1 in deal 1 and player 2 in deal 2. */
  const matchOf = (d1: [string, string], d2: [string, string]) => {
    const m = newMatch(R, [1, 2]);
    m.results.push(dealOf(...d1), dealOf(...d2));
    return m;
  };

  it("a decided score needs no tiebreak", () => {
    const m = matchOf(["Ks Qs", "Jc"], ["Jd", "Jh"]);
    expect(verdict(m)).toEqual({ outcome: "win", decidedBy: null });
  });

  it("level scores go to the tiebreaks, in order", () => {
    expect(TIEBREAKS[0]).toBe("combos");
    // 7–7; human scored a Marriage, the opponent only Retainers
    const byCombos = matchOf(["Ks Qs", "Jh Jd Jc Qc Kd Qh"], ["Jc", "Js"]);
    expect(totals(byCombos)).toEqual({ human: 7, ai: 7 });
    expect(verdict(byCombos)).toEqual({ outcome: "win", decidedBy: "combos" });

    // 2–2, no combinations either side; the opponent held more Aces
    const byAces = matchOf(["Jc", "As"], ["Ad", "Kc"]);
    expect(totals(byAces)).toEqual({ human: 2, ai: 2 });
    expect(verdict(byAces)).toEqual({ outcome: "loss", decidedBy: "aces" });
  });

  it("a countered combination does not count for the tiebreak", () => {
    // human's Service is countered by the opponent's Queen: 2 points, no combination
    const m = matchOf(["Jd Ad", "Qd Jc"], ["Kc", "Kh"]);
    expect(totals(m)).toEqual({ human: 3, ai: 3 });
    expect(tiebreakTotals(m, "combos")).toEqual({ human: 0, ai: 0 });
  });

  it("only a match level on every tiebreak is drawn", () => {
    const m = matchOf(["Jc", "Jd"], ["Kc", "Kd"]);
    expect(verdict(m)).toEqual({ outcome: "draw", decidedBy: null });
  });
});
