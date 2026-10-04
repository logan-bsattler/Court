import { ACE_CARDS, popcount } from "../engine/cards";
import { type DealResult, type GameState, type Player, deal, result } from "../engine/game";
import type { RulesConfig } from "../engine/rules";

/**
 * A match is two deals with seats swapped and scores summed, to offset the
 * first-player lean. Each deal is a fresh layout: replaying the same layout
 * would leak the face-down cards to the human. A level match goes to the
 * tiebreaks in TIEBREAKS; only if those are level too is it a draw.
 */
export const DEALS_PER_MATCH = 2;

export interface Match {
  readonly rules: RulesConfig;
  readonly seeds: readonly number[];
  /** Index of the deal in progress (or last played). */
  dealIndex: number;
  state: GameState;
  /** Results of finished deals, by deal index. */
  readonly results: DealResult[];
  /** Number of hints the human asked for. */
  hintsUsed: number;
}

/** The human is player 1 in the first deal and player 2 in the second. */
export const humanSeat = (dealIndex: number): Player => (dealIndex % 2) as Player;
export const aiSeat = (dealIndex: number): Player => (1 - humanSeat(dealIndex)) as Player;

export function newMatch(rules: RulesConfig, seeds: readonly number[]): Match {
  if (seeds.length !== DEALS_PER_MATCH) throw new Error(`need ${DEALS_PER_MATCH} seeds`);
  return { rules, seeds, dealIndex: 0, state: deal(seeds[0], rules), results: [], hintsUsed: 0 };
}

/** Record the finished current deal. */
export function finishDeal(m: Match): DealResult {
  const r = result(m.state);
  m.results[m.dealIndex] = r;
  return r;
}

export function hasNextDeal(m: Match): boolean {
  return m.dealIndex + 1 < DEALS_PER_MATCH;
}

export function startNextDeal(m: Match): void {
  m.dealIndex++;
  m.state = deal(m.seeds[m.dealIndex], m.rules);
}

/** Summed scores so far, from the human's and the AI's side. */
export function totals(m: Match): { human: number; ai: number } {
  let human = 0, ai = 0;
  m.results.forEach((r, i) => {
    human += r.scores[humanSeat(i)];
    ai += r.scores[aiSeat(i)];
  });
  return { human, ai };
}

export type MatchOutcome = "win" | "loss" | "draw";

/**
 * Tiebreaks for a match whose summed scores are level, tried in order.
 * Each is summed over both deals; higher is better.
 */
export type Tiebreak = "combos" | "aces";
export const TIEBREAKS: readonly Tiebreak[] = ["combos", "aces"];

export const TIEBREAK_LABELS: Record<Tiebreak, string> = {
  combos: "combinations scored",
  aces: "Aces held",
};

const ACE_MASK = ACE_CARDS.reduce((mk, c) => mk | (1 << c), 0);

function dealStat(r: DealResult, seat: Player, t: Tiebreak): number {
  switch (t) {
    // a countered combination scored nothing extra, so it does not count
    case "combos": return r.allocations[seat].combos.filter((c) => !c.countered).length;
    case "aces": return popcount(r.hands[seat] & ACE_MASK);
  }
}

/** A tiebreak statistic summed over the finished deals, per side. */
export function tiebreakTotals(m: Match, t: Tiebreak): { human: number; ai: number } {
  let human = 0, ai = 0;
  m.results.forEach((r, i) => {
    human += dealStat(r, humanSeat(i), t);
    ai += dealStat(r, aiSeat(i), t);
  });
  return { human, ai };
}

export interface Verdict {
  outcome: MatchOutcome;
  /** The tiebreak that settled a level match; null if the score did, or nothing did. */
  decidedBy: Tiebreak | null;
}

export function verdict(m: Match): Verdict {
  const t = totals(m);
  if (t.human !== t.ai) return { outcome: t.human > t.ai ? "win" : "loss", decidedBy: null };
  for (const tb of TIEBREAKS) {
    const v = tiebreakTotals(m, tb);
    if (v.human !== v.ai) return { outcome: v.human > v.ai ? "win" : "loss", decidedBy: tb };
  }
  return { outcome: "draw", decidedBy: null };
}

export function outcome(m: Match): MatchOutcome {
  return verdict(m).outcome;
}
