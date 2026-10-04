import type { Difficulty } from "../ai/agent";
import type { MatchOutcome } from "./match";
import { load, save } from "./storage";

/** Per-device match history. Stored locally only; nothing leaves the phone. */
export interface LevelStats {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  /** Matches won on a tiebreak (included in `won`). */
  tiebreakWins: number;
  bestDealScore: number;
  streak: number;
  bestStreak: number;
}

export interface Stats {
  levels: Record<Difficulty, LevelStats>;
  /** Daily match results by UTC date (YYYY-MM-DD). */
  daily: Record<string, { outcome: MatchOutcome; you: number; opp: number; difficulty: Difficulty; tiebreak?: boolean }>;
}

const emptyLevel = (): LevelStats => ({
  played: 0, won: 0, drawn: 0, lost: 0, tiebreakWins: 0, bestDealScore: 0, streak: 0, bestStreak: 0,
});

export const emptyStats = (): Stats => ({
  levels: { easy: emptyLevel(), medium: emptyLevel(), hard: emptyLevel() },
  daily: {},
});

export function loadStats(): Stats {
  const s = load<Stats | null>("stats", null);
  if (!s || typeof s !== "object" || !s.levels) return emptyStats();
  const base = emptyStats();
  for (const d of ["easy", "medium", "hard"] as Difficulty[]) base.levels[d] = { ...emptyLevel(), ...s.levels[d] };
  base.daily = s.daily ?? {};
  return base;
}

export interface MatchRecord {
  difficulty: Difficulty;
  outcome: MatchOutcome;
  onTiebreak: boolean;
  dealScores: number[];
  you: number;
  opp: number;
  /** UTC date if this was the daily match. */
  daily?: string;
}

/** Pure update, so it can be tested without storage. */
export function withMatch(s: Stats, r: MatchRecord): Stats {
  const next: Stats = { levels: { ...s.levels }, daily: { ...s.daily } };
  const l = { ...next.levels[r.difficulty] };
  l.played++;
  if (r.outcome === "win") { l.won++; l.streak++; if (r.onTiebreak) l.tiebreakWins++; }
  else { l.streak = 0; if (r.outcome === "draw") l.drawn++; else l.lost++; }
  l.bestStreak = Math.max(l.bestStreak, l.streak);
  l.bestDealScore = Math.max(l.bestDealScore, ...r.dealScores);
  next.levels[r.difficulty] = l;
  if (r.daily && !next.daily[r.daily]) {
    next.daily[r.daily] = { outcome: r.outcome, you: r.you, opp: r.opp, difficulty: r.difficulty, tiebreak: r.onTiebreak };
  }
  return next;
}

export function recordMatch(r: MatchRecord): Stats {
  const s = withMatch(loadStats(), r);
  save("stats", s);
  return s;
}

export function resetStats(): void {
  save("stats", emptyStats());
}
