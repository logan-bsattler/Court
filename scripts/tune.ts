/**
 * Try a candidate difficulty level against random, easy and hard.
 *   npx tsx scripts/tune.ts <worlds> <tolerance> <deals>
 */
import { LEVELS } from "../src/ai/agent";
import { summarise, versus } from "../src/ai/selfplay";
import { DEFAULT_RULES } from "../src/engine/rules";

const [w, tol, n] = process.argv.slice(2).map(Number);
const cand = { worlds: w, minWorlds: Math.min(2, w), timeBudgetMs: 0, tolerance: tol };
const nb = (l: keyof typeof LEVELS) => ({ ...LEVELS[l], timeBudgetMs: 0 });
const fmt = (m: number[]) => { const s = summarise(m); return `${s.mean >= 0 ? "+" : ""}${s.mean.toFixed(2)} (W/D/L ${s.wins}/${s.draws}/${s.losses})`; };
console.log(`worlds=${w} tol=${tol}: vs random ${fmt(versus(n, DEFAULT_RULES, cand, "random", 5))}` +
  ` | vs easy ${fmt(versus(n, DEFAULT_RULES, cand, nb("easy"), 6))}` +
  ` | hard vs it ${fmt(versus(n, DEFAULT_RULES, nb("hard"), cand, 7))}`);
