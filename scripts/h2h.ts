/**
 * Head-to-head between two app difficulty levels, seats alternating.
 *   npx tsx scripts/h2h.ts <levelA> <levelB> <deals> <seed> [budgetScale]
 * budgetScale multiplies both levels' time budgets (0 = no budget). A scale
 * below 1 roughly imitates a slower device.
 */
import { type Difficulty, LEVELS } from "../src/ai/agent";
import { summarise, versus } from "../src/ai/selfplay";
import { DEFAULT_RULES } from "../src/engine/rules";

const [a, b, n, seed, scaleArg] = process.argv.slice(2);
const scale = Number(scaleArg ?? 0);
const level = (d: string) => ({ ...LEVELS[d as Difficulty], timeBudgetMs: LEVELS[d as Difficulty].timeBudgetMs * scale });
const margins = versus(Number(n), DEFAULT_RULES, level(a), level(b), Number(seed));
console.log(JSON.stringify({ a, b, scale, seed: Number(seed), margins, ...summarise(margins) }));
