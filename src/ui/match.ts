import { ACE_CARDS, popcount } from "../engine/cards";
import { type DealResult, type GameState, type Player, deal, result } from "../engine/game";
import type { RulesConfig } from "../engine/rules";

/**
 * Match formats. Seats alternate every deal, starting with the human as
 * player 1, to offset the first-player lean. Each deal is a fresh layout:
 * replaying one would leak the face-down cards to the human.
 *
 * - classic: two deals, scores summed. A level match goes to the tiebreaks
 *   in TIEBREAKS; only if those are level too is it a draw.
 * - firstTo2: first to win two deals. Drawn deals do not count. If nobody
 *   has two wins after LONG_MATCH_CAP deals, summed score (then the
 *   tiebreaks) decides.
 * - continuous: deals until the player ends the session; a running tally.
 */
export type MatchMode = "classic" | "firstTo2" | "continuous";
export const MATCH_MODES: readonly MatchMode[] = ["classic", "firstTo2", "continuous"];
export const MODE_LABELS: Record<MatchMode, string> = { classic: "Classic", firstTo2: "First to 2", continuous: "Continuous" };

export const DEALS_PER_MATCH = 2;
export const DEAL_WINS_NEEDED = 2;
export const LONG_MATCH_CAP = 9;

export interface Match {
  readonly rules: RulesConfig;
  readonly mode: MatchMode;
  /** Deal seeds. Fixed for classic; extended on demand for the other modes. */
  readonly seeds: number[];
  /** Index of the deal in progress (or last played). */
  dealIndex: number;
  state: GameState;
  /** Results of finished deals, by deal index. */
  readonly results: DealResult[];
  /** Number of hints the human asked for. */
  hintsUsed: number;
  /** UTC date when this is the daily match. */
  daily?: string;
  /** Set once the result has been written to stats. */
  recorded?: boolean;
}

/** The human is player 1 in the first deal and player 2 in the second. */
export const humanSeat = (dealIndex: number): Player => (dealIndex % 2) as Player;
export const aiSeat = (dealIndex: number): Player => (1 - humanSeat(dealIndex)) as Player;

export function newMatch(rules: RulesConfig, seeds: readonly number[], mode: MatchMode = "classic"): Match {
  if (mode === "classic" && seeds.length !== DEALS_PER_MATCH) throw new Error(`need ${DEALS_PER_MATCH} seeds`);
  if (seeds.length === 0) throw new Error("need at least one seed");
  return { rules, mode, seeds: [...seeds], dealIndex: 0, state: deal(seeds[0], rules), results: [], hintsUsed: 0 };
}

/** Deals won by each side, and drawn deals, among finished deals. */
export function dealWins(m: Match): { human: number; ai: number; draws: number } {
  let human = 0, ai = 0, draws = 0;
  m.results.forEach((r, i) => {
    const d = r.scores[humanSeat(i)] - r.scores[aiSeat(i)];
    if (d > 0) human++; else if (d < 0) ai++; else draws++;
  });
  return { human, ai, draws };
}

/** Record the finished current deal. */
export function finishDeal(m: Match): DealResult {
  const r = result(m.state);
  m.results[m.dealIndex] = r;
  return r;
}

/** Whether the match goes on after the deals finished so far. Continuous always can. */
export function hasNextDeal(m: Match): boolean {
  const played = m.results.length;
  switch (m.mode) {
    case "classic": return played < DEALS_PER_MATCH;
    case "firstTo2": {
      const w = dealWins(m);
      return w.human < DEAL_WINS_NEEDED && w.ai < DEAL_WINS_NEEDED && played < LONG_MATCH_CAP;
    }
    case "continuous": return true;
  }
}

export function startNextDeal(m: Match): void {
  m.dealIndex++;
  // later seeds derive from the first, so a replayed first seed replays the whole match
  while (m.seeds.length <= m.dealIndex) m.seeds.push((m.seeds[0] + m.seeds.length) >>> 0);
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
  /** First to 2: true when deal wins decided it (false when the cap sent it to the score). */
  byDeals?: boolean;
}

export function verdict(m: Match): Verdict {
  if (m.mode !== "classic") {
    const w = dealWins(m);
    const decided = w.human >= DEAL_WINS_NEEDED || w.ai >= DEAL_WINS_NEEDED;
    // continuous sessions are judged on deals won; first to 2 normally is too
    if (m.mode === "continuous" || decided) {
      if (w.human !== w.ai) return { outcome: w.human > w.ai ? "win" : "loss", decidedBy: null, byDeals: true };
      if (m.mode === "continuous") return { outcome: "draw", decidedBy: null, byDeals: true };
    }
  }
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
