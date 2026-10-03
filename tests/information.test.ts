import { describe, expect, it } from "vitest";
import { LEVELS, analyse, possibleWorlds } from "../src/ai/agent";
import { type GameState, applyClaim, deal, legalClaims, viewFor } from "../src/engine/game";
import { makeRng } from "../src/engine/rng";
import { DEFAULT_RULES } from "../src/engine/rules";

const positionsOf = (mask: number) => Array.from({ length: 16 }, (_, p) => p).filter((p) => (mask >> p) & 1);

/** Same deal with the face-down cards rotated among their cells. */
function rotateHidden(s: GameState): GameState {
  const fd = positionsOf(s.faceDown);
  const layout = [...s.layout];
  fd.forEach((p, i) => { layout[p] = s.layout[fd[(i + 1) % fd.length]]; });
  return { ...s, layout };
}

describe("information hiding", () => {
  it("a view contains no unseen face-down card identities", () => {
    const s = deal(5, DEFAULT_RULES);
    const v = viewFor(s, 1);
    for (const p of positionsOf(s.faceDown)) expect(v.cells[p]).toBeNull();
    expect([...v.unseen]).toEqual(positionsOf(s.faceDown).map((p) => s.layout[p]).sort((a, b) => a - b));
    // the view object carries no reference to the full layout
    expect(Object.keys(v)).not.toContain("layout");
    expect(Object.keys(v)).not.toContain("hands");
  });

  it("the AI's view and choice are identical whatever the hidden cards are", () => {
    let a = deal(9, DEFAULT_RULES);
    let b = rotateHidden(a);
    expect(a.layout).not.toEqual(b.layout);

    // player 1 claims a face-down card; player 2 (the AI) must not learn which
    const fd = positionsOf(a.faceDown)[0];
    a = applyClaim(a, fd);
    b = applyClaim(b, fd);
    expect(a.hands[0]).not.toBe(b.hands[0]);

    const va = viewFor(a, 1);
    const vb = viewFor(b, 1);
    expect(va).toEqual(vb);

    const level = { ...LEVELS.medium, timeBudgetMs: 0 };
    const ra = analyse(va, level, makeRng(1));
    const rb = analyse(vb, level, makeRng(1));
    expect(ra.move).toBe(rb.move);
    expect([...ra.values]).toEqual([...rb.values]);
  });

  it("the claimer's own view does reveal the card they took", () => {
    const s = deal(9, DEFAULT_RULES);
    const fd = positionsOf(s.faceDown)[0];
    const t = applyClaim(s, fd);
    expect(viewFor(t, 0).cells[fd]).toBe(s.layout[fd]);
    expect(viewFor(t, 1).cells[fd]).toBeNull();
  });

  it("possible worlds are all consistent with the view and include the real one", () => {
    const s = deal(13, DEFAULT_RULES);
    const v = viewFor(s, 0);
    const worlds = possibleWorlds(v, 24, makeRng(2));
    expect(worlds.length).toBe(24); // 4! enumerated exactly
    const keys = new Set(worlds.map((w) => w.join(",")));
    expect(keys.size).toBe(24);
    expect(keys.has(s.layout.join(","))).toBe(true);
    for (const w of worlds) {
      v.cells.forEach((c, p) => { if (c !== null) expect(w[p]).toBe(c); });
    }
  });

  it("the AI only ever chooses legal claims", () => {
    const rng = makeRng(4);
    let s = deal(21, DEFAULT_RULES);
    while (s.occupied) {
      const v = viewFor(s, (16 - positionsOf(s.occupied).length) % 2 as 0 | 1);
      const m = analyse(v, { ...LEVELS.easy, timeBudgetMs: 0 }, rng).move;
      expect(legalClaims(s)).toContain(m);
      s = applyClaim(s, m);
    }
  });
});
