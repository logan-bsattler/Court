import { describe, expect, it } from "vitest";
import { cardName, parseCard } from "../src/engine/cards";
import { applyClaim, fromLayout, viewFor } from "../src/engine/game";
import { DEFAULT_RULES } from "../src/engine/rules";
import { eventsBetween, hiddenOdds, visibleAllocation } from "../src/ui/insight";

// row 0: Kh Qh Ah Jh   row 1: Ks Qs As Js   rows 2-3: diamonds, clubs
const LAYOUT = "Kh Qh Ah Jh Ks Qs As Js Kd Qd Ad Jd Kc Qc Ac Jc".split(" ").map(parseCard);
const R = DEFAULT_RULES;

describe("insight", () => {
  it("reports a combination when it is completed", () => {
    let s = fromLayout(LAYOUT, 0, R);
    s = applyClaim(s, 0); // P1 Kh
    s = applyClaim(s, 3); // P2 Jh
    const before = viewFor(s, 0);
    s = applyClaim(s, 1); // P1 Qh: heart Marriage
    const ev = eventsBetween(before, viewFor(s, 0));
    expect(ev).toEqual([{ type: "combo", owner: 0, combo: expect.objectContaining({ kind: "marriage", index: 1, value: 6 }) }]);
    expect(visibleAllocation(viewFor(s, 0), 0).total).toBe(6);
  });

  it("reports a counter when the opponent takes the Ace", () => {
    let s = fromLayout(LAYOUT, 0, R);
    for (const p of [0, 3, 1]) s = applyClaim(s, p); // P1 Kh, P2 Jh, P1 Qh
    const before = viewFor(s, 0);
    s = applyClaim(s, 2); // P2 Ah deposes P1's Marriage; P2's new Service is countered by P1's Qh
    const ev = eventsBetween(before, viewFor(s, 0));
    expect(ev).toHaveLength(2);
    expect(ev).toContainEqual({ type: "countered", victim: 0, counter: expect.objectContaining({ kind: "deposition", suit: 1 }) });
    expect(ev).toContainEqual({ type: "countered", victim: 1, counter: expect.objectContaining({ kind: "serviceCounter", suit: 1 }) });
  });

  it("an opponent's face-down claim triggers nothing the viewer could not see", () => {
    let s = fromLayout(LAYOUT, 1 << 2, R); // Ah face down
    for (const p of [0, 3, 1]) s = applyClaim(s, p);
    const before = viewFor(s, 0);
    s = applyClaim(s, 2); // P2 takes the face-down Ah
    expect(eventsBetween(before, viewFor(s, 0))).toEqual([]);
    // but P2 sees their own Service
    expect(eventsBetween(viewFor(applyClaim(fromLayout(LAYOUT, 1 << 2, R), 0), 1), viewFor(s, 1)).length).toBeGreaterThan(0);
  });

  it("hidden-card odds are uniform over unseen cards and flag what matters", () => {
    let s = fromLayout(LAYOUT, (1 << 2) | (1 << 6) | (1 << 10) | (1 << 15), R); // Ah As Ad Jc face down
    for (const p of [0, 3, 1]) s = applyClaim(s, p); // P1 Kh, P2 Jh, P1 Qh
    const odds = hiddenOdds(viewFor(s, 0));
    expect(odds.map((o) => cardName(o.card)).sort()).toEqual(["Ad", "Ah", "As", "Jc"]);
    for (const o of odds) expect(o.p).toBeCloseTo(0.25);
    const ah = odds.find((o) => cardName(o.card) === "Ah")!;
    expect(ah.counters.map((c) => c.kind)).toEqual(["marriage"]);
  });
});
