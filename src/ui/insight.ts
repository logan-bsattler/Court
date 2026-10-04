import { ACE, type Card, QUEEN, RANK_MASKS, SUIT_MASKS, bits, popcount, rankOf, suitOf } from "../engine/cards";
import type { Player, PlayerView } from "../engine/game";
import { type Allocation, type Combo, type CounterFired, allocate } from "../engine/scoring";

/**
 * What a player can infer from their own view: combinations on the table,
 * changes between two views (for animations), and odds for unseen cards.
 * Everything here works from a PlayerView only, so it can never reveal a
 * card the viewer has not seen.
 */

/** Card-id mask of `owner`'s claims that the viewer has seen. */
export function knownHand(view: PlayerView, owner: Player): number {
  let mask = 0;
  for (const p of view.claims[owner]) {
    const c = view.cells[p];
    if (c !== null) mask |= 1 << c;
  }
  return mask;
}

/** `owner`'s allocation as far as the viewer can see, against the other side's visible cards. */
export function visibleAllocation(view: PlayerView, owner: Player): Allocation {
  return allocate(knownHand(view, owner), knownHand(view, (1 - owner) as Player), view.rules);
}

/** A player one card short of a Full Court or Coup, as far as the viewer can see. */
export interface Threat {
  kind: "fullCourt" | "coup";
  /** Suit for fullCourt, rank for coup. */
  index: number;
  /** The one card still needed. */
  needs: Card;
  /** Grid position of that card if the viewer can see it on the grid, else null (unseen). */
  pos: number | null;
}

/**
 * Four-card sets `owner` is one card from completing. Only `owner`'s visible
 * cards count, and a set is not a threat if the viewer holds the missing card.
 */
export function threats(view: PlayerView, owner: Player): Threat[] {
  const hand = knownHand(view, owner);
  const blockers = owner === view.player ? 0 : knownHand(view, view.player);
  const taken = knownHand(view, 0) | knownHand(view, 1);
  const out: Threat[] = [];
  const check = (kind: Threat["kind"], index: number, set: number) => {
    if (popcount(hand & set) !== 3) return;
    const needs = bits(set & ~hand)[0];
    if ((blockers >> needs) & 1) return;
    // the other player's visible claim already took it
    if (((taken & ~hand) >> needs) & 1) return;
    const p = view.cells.findIndex((c, i) => c === needs && ((view.occupied >> i) & 1) === 1);
    out.push({ kind, index, needs, pos: p >= 0 ? p : null });
  };
  for (let s = 0; s < 4; s++) check("fullCourt", s, SUIT_MASKS[s]);
  for (let r = 0; r < 4; r++) check("coup", r, RANK_MASKS[r]);
  return out;
}

export type InsightEvent =
  | { type: "combo"; owner: Player; combo: Combo }
  | { type: "countered"; victim: Player; counter: CounterFired }
  | { type: "threat"; owner: Player; threat: Threat };

const comboKey = (c: Combo) => `${c.kind}:${c.index}`;
const counterKey = (c: CounterFired) => `${c.kind}:${c.suit}`;

/** Combinations completed and counters fired between two views of the same deal. */
export function eventsBetween(before: PlayerView, after: PlayerView): InsightEvent[] {
  const out: InsightEvent[] = [];
  for (const owner of [0, 1] as Player[]) {
    const was = visibleAllocation(before, owner);
    const now = visibleAllocation(after, owner);
    const had = new Set(was.combos.filter((c) => !c.countered).map(comboKey));
    for (const c of now.combos) if (!c.countered && !had.has(comboKey(c))) out.push({ type: "combo", owner, combo: c });
    const hit = new Set(was.counters.map(counterKey));
    for (const k of now.counters) if (!hit.has(counterKey(k))) out.push({ type: "countered", victim: owner, counter: k });
    // warnings are about the opponent only
    if (owner !== after.player) {
      const known = new Set(threats(before, owner).map((t) => `${t.kind}:${t.index}`));
      for (const t of threats(after, owner)) if (!known.has(`${t.kind}:${t.index}`)) out.push({ type: "threat", owner, threat: t });
    }
  }
  return out;
}

export interface CardOdds {
  card: Card;
  /** Chance this unseen cell holds `card`. */
  p: number;
  /** Combinations of the viewer's this card would complete if they claimed it. */
  completes: Combo[];
  /** Viewer's combinations this card would counter if the opponent held it. */
  counters: Combo[];
}

/**
 * Odds for one unseen cell. Every card the viewer has not seen is equally
 * likely to be in each unseen cell, so the chances are uniform; what varies
 * is what each candidate would mean for the viewer.
 */
export function hiddenOdds(view: PlayerView): CardOdds[] {
  const me = view.player;
  const mine = knownHand(view, me);
  const theirs = knownHand(view, (1 - me) as Player);
  const current = allocate(mine, theirs, view.rules);
  const formed = new Set(current.combos.map(comboKey));
  const n = view.unseen.length;
  return view.unseen.map((card) => {
    const withCard = allocate(mine | (1 << card), theirs, view.rules);
    const completes = withCard.combos.filter((c) => !c.countered && !formed.has(comboKey(c)) && ((c.mask >> card) & 1) === 1);
    const counters = current.combos.filter((c) => !c.countered && suitOf(card) === c.index && (
      (c.kind === "marriage" && rankOf(card) === ACE) || (c.kind === "service" && rankOf(card) === QUEEN)));
    return { card, p: n ? 1 / n : 0, completes, counters };
  });
}
