import {
  ACE_CARDS, Card, MARRIAGE_MASKS, QUEEN_CARDS, RANK_MASKS, SERVICE_MASKS, SUIT_MASKS, bits, popcount,
} from "./cards";
import type { RulesConfig } from "./rules";

/**
 * Scoring is a weighted exact-cover maximisation, ported from court.py.
 *
 * Every card starts as a Retainer. Each available combination is worth its
 * *gain* over the Retainers it consumes, and the best card-disjoint subset of
 * combinations wins. A combination with non-positive gain is never taken,
 * which is exactly how a deposed Marriage falls back to two Retainers.
 */

export type ComboKind = "fullCourt" | "coup" | "marriage" | "service";

export interface Combo {
  kind: ComboKind;
  /** Suit for fullCourt / marriage / service, rank for coup. */
  index: number;
  /** Hand mask (card ids) of the cards used. */
  mask: number;
  value: number;
  /** True when a counter (Deposition or Service counter) reduced its value. */
  countered: boolean;
}

export interface CounterFired {
  kind: "deposition" | "serviceCounter";
  suit: number;
  /** The opponent's card that triggered the counter. */
  by: Card;
  /** The pair in this hand that lost its value. */
  mask: number;
}

export interface Allocation {
  total: number;
  /** Combinations taken, in a stable display order. */
  combos: Combo[];
  /** Cards scoring as Retainers. */
  retainers: Card[];
  retainerValue: number;
  /** Counters that cost this hand points. */
  counters: CounterFired[];
}

const ACE_MASK = ACE_CARDS.reduce((m, c) => m | (1 << c), 0);
const QUEEN_MASK = QUEEN_CARDS.reduce((m, c) => m | (1 << c), 0);
/** Only the opponent's Aces and Queens can affect a hand's score. */
export const COUNTER_MASK = ACE_MASK | QUEEN_MASK;

/** All combinations present in `hand`, valued against `opponent`. */
export function availableCombos(hand: number, opponent: number, r: RulesConfig): Combo[] {
  const out: Combo[] = [];
  for (let s = 0; s < 4; s++) {
    if ((hand & SUIT_MASKS[s]) === SUIT_MASKS[s]) {
      out.push({ kind: "fullCourt", index: s, mask: SUIT_MASKS[s], value: r.fullCourt, countered: false });
    }
  }
  for (let k = 0; k < 4; k++) {
    if ((hand & RANK_MASKS[k]) === RANK_MASKS[k]) {
      out.push({ kind: "coup", index: k, mask: RANK_MASKS[k], value: r.coup, countered: false });
    }
  }
  for (let s = 0; s < 4; s++) {
    if ((hand & MARRIAGE_MASKS[s]) === MARRIAGE_MASKS[s]) {
      // a counter only "fires" when it actually lowers the value (it can be switched off in RulesConfig)
      const deposed = ((opponent >> ACE_CARDS[s]) & 1) === 1 && r.deposedMarriage < r.marriage;
      out.push({
        kind: "marriage", index: s, mask: MARRIAGE_MASKS[s],
        value: deposed ? r.deposedMarriage : r.marriage, countered: deposed,
      });
    }
  }
  for (let s = 0; s < 4; s++) {
    if ((hand & SERVICE_MASKS[s]) === SERVICE_MASKS[s]) {
      const countered = ((opponent >> QUEEN_CARDS[s]) & 1) === 1 && r.counteredService < r.service;
      out.push({
        kind: "service", index: s, mask: SERVICE_MASKS[s],
        value: countered ? r.counteredService : r.service, countered,
      });
    }
  }
  return out;
}

const gainOf = (c: Combo, r: RulesConfig): number => c.value - popcount(c.mask) * r.retainer;

/** Best card-disjoint subset. Returns [gain, chosen indices]; first-found wins ties. */
function bestCover(combos: Combo[], gains: number[], i: number, used: number): [number, number[]] {
  if (i === combos.length) return [0, []];
  const skip = bestCover(combos, gains, i + 1, used);
  if (combos[i].mask & used) return skip;
  const [g, picked] = bestCover(combos, gains, i + 1, used | combos[i].mask);
  const take = g + gains[i];
  return take > skip[0] ? [take, [i, ...picked]] : skip;
}

function bestGain(combos: Combo[], gains: number[], i: number, used: number): number {
  if (i === combos.length) return 0;
  const skip = bestGain(combos, gains, i + 1, used);
  if (combos[i].mask & used) return skip;
  return Math.max(skip, gains[i] + bestGain(combos, gains, i + 1, used | combos[i].mask));
}

const caches = new WeakMap<RulesConfig, Map<number, number>>();

/** Score of `hand` under its best allocation, given what the opponent holds. */
export function score(hand: number, opponent: number, r: RulesConfig): number {
  let cache = caches.get(r);
  if (!cache) {
    cache = new Map();
    caches.set(r, cache);
  }
  const key = hand + (opponent & COUNTER_MASK) * 65536;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const combos = availableCombos(hand, opponent, r).filter((c) => gainOf(c, r) > 0);
  const value = popcount(hand) * r.retainer + bestGain(combos, combos.map((c) => gainOf(c, r)), 0, 0);
  cache.set(key, value);
  return value;
}

/** The optimal allocation, for the score screen. */
export function allocate(hand: number, opponent: number, r: RulesConfig): Allocation {
  const all = availableCombos(hand, opponent, r);
  const combos = all.filter((c) => gainOf(c, r) > 0);
  const [gain, picked] = bestCover(combos, combos.map((c) => gainOf(c, r)), 0, 0);
  const chosen = picked.map((i) => combos[i]);
  const used = chosen.reduce((m, c) => m | c.mask, 0);
  const retainers = bits(hand & ~used);
  const total = popcount(hand) * r.retainer + gain;

  // A counter "fired" when it removed value from a pair that was not
  // absorbed into some other, uncountered combination.
  const counters: CounterFired[] = [];
  for (const c of all) {
    if (!c.countered) continue;
    const usedElsewhere = chosen.some((o) => o !== c && (o.mask & c.mask) !== 0);
    if (usedElsewhere) continue;
    counters.push({
      kind: c.kind === "marriage" ? "deposition" : "serviceCounter",
      suit: c.index,
      by: c.kind === "marriage" ? ACE_CARDS[c.index] : QUEEN_CARDS[c.index],
      mask: c.mask,
    });
  }

  return { total, combos: chosen, retainers, retainerValue: retainers.length * r.retainer, counters };
}
