/**
 * Phase 3 AI-vs-AI batches. Every config plays the SAME seeded deals
 * (face-down cells are nested: the 6-card set contains the 4-card set), so
 * configs can be compared deal by deal.
 *
 *   npx tsx scripts/experiments.ts <config> <deals> <out.json> [startDeal]
 *
 * Both seats use the same determinized agent: 8 worlds per decision, no time
 * budget, best move with random tie-break — the setup of the August Python
 * runs (max_worlds=8).
 */
import { writeFileSync } from "node:fs";
import { type AiLevel, chooseMove } from "../src/ai/agent";
import { applyClaim, deal, isOver, result, toMove, viewFor } from "../src/engine/game";
import { makeRng } from "../src/engine/rng";
import { type RulesConfig, rules } from "../src/engine/rules";

export const CONFIGS: Record<string, Partial<RulesConfig>> = {
  baseline: {},
  "no-service-counter": { counteredService: 4 },
  "no-deposition": { deposedMarriage: 6 },
  "no-counters": { counteredService: 4, deposedMarriage: 6 },
  "facedown-6": { faceDown: 6 },
  "facedown-8": { faceDown: 8 },
  "facedown-0": { faceDown: 0 },
};

const AGENT: AiLevel = { worlds: 8, minWorlds: 8, timeBudgetMs: 0, tolerance: 0 };

export interface DealRecord {
  i: number;
  seed: number;
  margin: number;
  scores: [number, number];
  /** Per player: combos scored, e.g. "fullCourt", "marriage!" (! = countered). */
  combos: [string[], string[]];
  /** Per player: counters that cost them points. */
  countered: [string[], string[]];
}

const [name, nArg, out, startArg] = process.argv.slice(2);
if (!(name in CONFIGS)) throw new Error(`unknown config ${name}; one of ${Object.keys(CONFIGS)}`);
const r = rules(CONFIGS[name]);
const n = Number(nArg);
const start = Number(startArg ?? 0);
const records: DealRecord[] = [];
const t0 = performance.now();
for (let i = start; i < start + n; i++) {
  const seed = (20261004 * 7 + i * 7919) >>> 0;
  const rng = makeRng(seed ^ 0xa5a5a5a5);
  let s = deal(seed, r);
  while (!isOver(s)) s = applyClaim(s, chooseMove(viewFor(s, toMove(s)), AGENT, rng));
  const res = result(s);
  records.push({
    i, seed, margin: res.margin, scores: res.scores,
    combos: [0, 1].map((p) => res.allocations[p].combos.map((c) => c.kind + (c.countered ? "!" : ""))) as [string[], string[]],
    countered: [0, 1].map((p) => res.allocations[p].counters.map((c) => c.kind)) as [string[], string[]],
  });
  if ((i - start + 1) % 10 === 0) {
    writeFileSync(out, JSON.stringify({ config: name, rules: r, records }));
    const secs = (performance.now() - t0) / 1000;
    console.log(`${name}: ${i - start + 1}/${n}  ${(secs / (i - start + 1)).toFixed(1)}s/deal`);
  }
}
writeFileSync(out, JSON.stringify({ config: name, rules: r, records }));
console.log(`${name}: done in ${((performance.now() - t0) / 1000).toFixed(0)}s`);
