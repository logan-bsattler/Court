import { describe, expect, it } from "vitest";
import {
  FULL_GRID, applyClaim, deal, fromLayout, isFreeClaim, isOver, legalClaims, result, toMove,
} from "../src/engine/game";
import { popcount } from "../src/engine/cards";
import { makeRng, pick } from "../src/engine/rng";
import { DEFAULT_RULES, rules } from "../src/engine/rules";

const identity = Array.from({ length: 16 }, (_, i) => i);
const R = rules({ faceDown: 0 });

/** Claim a sequence of positions from a fresh identity layout. */
const play = (...positions: number[]) =>
  positions.reduce((s, p) => applyClaim(s, p), fromLayout(identity, 0, R));

describe("claims", () => {
  it("the first claim may be any card", () => {
    expect(legalClaims(fromLayout(identity, 0, R))).toEqual(identity);
  });

  it("later claims follow the row and column of the vacated cell", () => {
    const s = play(5); // row 1, column 1
    expect(legalClaims(s)).toEqual([1, 4, 6, 7, 9, 13]);
    expect(isFreeClaim(s)).toBe(false);
    expect(() => applyClaim(s, 0)).toThrow(/illegal/);
  });

  it("empty cells between do not block, and the reference is the vacated cell", () => {
    const s = play(0, 1, 2); // row 0 now holds only position 3
    expect(legalClaims(s)).toEqual([3, 6, 10, 14]);
  });

  it("Free Claim triggers only when both the row and the column are empty", () => {
    // empty row 0 and column 0 except position 0, then claim 0 last
    let s = play(1, 2, 3, 15, 12, 8, 4);
    expect(legalClaims(s)).toEqual([0, 5, 6, 7]); // row 1 still has cards
    s = applyClaim(s, 0);
    expect(isFreeClaim(s)).toBe(true);
    expect(legalClaims(s)).toEqual([5, 6, 7, 9, 10, 11, 13, 14]);

    // row empty but column not: no Free Claim
    const t = play(1, 2, 3, 0);
    expect(isFreeClaim(t)).toBe(false);
    expect(legalClaims(t)).toEqual([4, 8, 12]);
  });

  it("a legal claim always exists until the grid is empty, and each player ends with eight", () => {
    const rng = makeRng(3);
    for (let g = 0; g < 50; g++) {
      let s = deal(g, DEFAULT_RULES);
      let turns = 0;
      while (!isOver(s)) {
        expect(toMove(s)).toBe(turns % 2);
        const moves = legalClaims(s);
        expect(moves.length).toBeGreaterThan(0);
        s = applyClaim(s, pick(moves, rng));
        turns++;
      }
      expect(turns).toBe(16);
      expect(popcount(s.hands[0])).toBe(8);
      expect(popcount(s.hands[1])).toBe(8);
      expect(s.hands[0] | s.hands[1]).toBe(FULL_GRID);
      const r = result(s);
      expect(r.margin).toBe(r.scores[0] - r.scores[1]);
    }
  });
});

describe("deal", () => {
  it("is reproducible from its seed", () => {
    expect(deal(42, DEFAULT_RULES)).toEqual(deal(42, DEFAULT_RULES));
    expect(deal(42, DEFAULT_RULES).layout).not.toEqual(deal(43, DEFAULT_RULES).layout);
  });

  it("deals a permutation of the deck with the configured number of face-down cells", () => {
    for (const n of [0, 4, 6, 8]) {
      const s = deal(7, rules({ faceDown: n }));
      expect([...s.layout].sort((a, b) => a - b)).toEqual(identity);
      expect(popcount(s.faceDown)).toBe(n);
      expect(s.known[0]).toBe(FULL_GRID & ~s.faceDown);
    }
  });

  it("a face-down card is revealed to its claimer only", () => {
    const s = deal(11, DEFAULT_RULES);
    const fd = identity.find((p) => (s.faceDown >> p) & 1)!;
    const t = applyClaim(s, fd);
    expect((t.known[0] >> fd) & 1).toBe(1);
    expect((t.known[1] >> fd) & 1).toBe(0);
  });
});
