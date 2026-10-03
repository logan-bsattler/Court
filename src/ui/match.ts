import { type DealResult, type GameState, type Player, deal, result } from "../engine/game";
import type { RulesConfig } from "../engine/rules";

/**
 * A match is two deals with seats swapped and scores summed, to offset the
 * first-player lean. Each deal is a fresh layout: replaying the same layout
 * would leak the face-down cards to the human. A tied match is a draw.
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
}

/** The human is player 1 in the first deal and player 2 in the second. */
export const humanSeat = (dealIndex: number): Player => (dealIndex % 2) as Player;
export const aiSeat = (dealIndex: number): Player => (1 - humanSeat(dealIndex)) as Player;

export function newMatch(rules: RulesConfig, seeds: readonly number[]): Match {
  if (seeds.length !== DEALS_PER_MATCH) throw new Error(`need ${DEALS_PER_MATCH} seeds`);
  return { rules, seeds, dealIndex: 0, state: deal(seeds[0], rules), results: [] };
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

export function outcome(m: Match): MatchOutcome {
  const t = totals(m);
  return t.human > t.ai ? "win" : t.human < t.ai ? "loss" : "draw";
}
