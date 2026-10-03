import { applyClaim, deal, isOver, legalClaims, result, toMove, viewFor } from "../engine/game";
import { makeRng, pick } from "../engine/rng";
import type { RulesConfig } from "../engine/rules";
import { type AiLevel, chooseMove } from "./agent";

export type Agent = AiLevel | "random";

/** Play one deal between two agents. Returns player 1's margin. */
export function playDeal(seed: number, rules: RulesConfig, agents: [Agent, Agent], agentSeed = seed ^ 0x9e3779b9): number {
  const rng = makeRng(agentSeed);
  let s = deal(seed, rules);
  while (!isOver(s)) {
    const pl = toMove(s);
    const a = agents[pl];
    const move = a === "random" ? pick(legalClaims(s), rng) : chooseMove(viewFor(s, pl), a, rng);
    s = applyClaim(s, move);
  }
  return result(s).margin;
}

/**
 * `n` seeded deals of `agent` against `opponent`, alternating seats.
 * Returns margins from `agent`'s point of view.
 */
export function versus(n: number, rules: RulesConfig, agent: Agent, opponent: Agent, seed = 1): number[] {
  const margins: number[] = [];
  for (let i = 0; i < n; i++) {
    const dealSeed = (seed * 100_003 + i) >>> 0;
    const asP1 = i % 2 === 0;
    const m = playDeal(dealSeed, rules, asP1 ? [agent, opponent] : [opponent, agent]);
    margins.push(asP1 ? m : -m);
  }
  return margins;
}

export function summarise(margins: number[]) {
  const n = margins.length;
  return {
    n,
    mean: margins.reduce((a, b) => a + b, 0) / n,
    wins: margins.filter((m) => m > 0).length,
    draws: margins.filter((m) => m === 0).length,
    losses: margins.filter((m) => m < 0).length,
    min: Math.min(...margins),
    max: Math.max(...margins),
  };
}
