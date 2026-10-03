/**
 * AI-vs-random acceptance check from the build plan: each level should beat a
 * random player by a mean margin of at least +3 over 100 seeded deals.
 *
 *   npm run bench -- [deals=100] [levels=easy,medium,hard]
 */
import { LEVELS, type Difficulty } from "../src/ai/agent";
import { summarise, versus } from "../src/ai/selfplay";
import { DEFAULT_RULES } from "../src/engine/rules";

const n = Number(process.argv[2] ?? 100);
const levels = (process.argv[3] ?? "easy,medium,hard").split(",") as Difficulty[];

for (const name of levels) {
  // no time budget: results must be reproducible regardless of machine speed
  const level = { ...LEVELS[name], timeBudgetMs: 0 };
  const t = performance.now();
  const s = summarise(versus(n, DEFAULT_RULES, level, "random"));
  const secs = ((performance.now() - t) / 1000).toFixed(1);
  console.log(
    `${name.padEnd(6)} vs random  n=${s.n}  mean ${s.mean >= 0 ? "+" : ""}${s.mean.toFixed(2)}  ` +
      `W/D/L ${s.wins}/${s.draws}/${s.losses}  range ${s.min}..${s.max}  ${secs}s`,
  );
}
