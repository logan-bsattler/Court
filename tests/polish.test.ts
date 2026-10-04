import { describe, expect, it } from "vitest";
import { dailySeeds, utcDate } from "../src/ui/daily";
import { emptyStats, withMatch } from "../src/ui/stats";

describe("daily match", () => {
  it("gives the same seeds for the same day and different seeds on other days", () => {
    expect(dailySeeds("2026-10-04")).toEqual(dailySeeds("2026-10-04"));
    expect(dailySeeds("2026-10-04")).not.toEqual(dailySeeds("2026-10-05"));
    const [a, b] = dailySeeds("2026-10-04");
    expect(a).not.toBe(b);
  });

  it("uses the UTC date", () => {
    expect(utcDate(new Date("2026-10-04T23:30:00-05:00"))).toBe("2026-10-05");
  });
});

describe("stats", () => {
  const rec = (outcome: "win" | "loss" | "draw", extra = {}) => ({
    difficulty: "medium" as const, outcome, onTiebreak: false, dealScores: [10, 12], you: 22, opp: 20, ...extra,
  });

  it("counts results, streaks and best deal", () => {
    let s = emptyStats();
    s = withMatch(s, rec("win"));
    s = withMatch(s, rec("win", { onTiebreak: true, dealScores: [16, 9] }));
    s = withMatch(s, rec("loss"));
    s = withMatch(s, rec("draw"));
    s = withMatch(s, rec("win"));
    const m = s.levels.medium;
    expect([m.played, m.won, m.drawn, m.lost, m.tiebreakWins]).toEqual([5, 3, 1, 1, 1]);
    expect([m.streak, m.bestStreak, m.bestDealScore]).toEqual([1, 2, 16]);
    expect(s.levels.easy.played).toBe(0);
  });

  it("keeps the first daily result for a date", () => {
    let s = withMatch(emptyStats(), rec("win", { daily: "2026-10-04" }));
    s = withMatch(s, rec("loss", { daily: "2026-10-04" }));
    expect(s.daily["2026-10-04"].outcome).toBe("win");
    expect(s.levels.medium.played).toBe(2);
  });
});
