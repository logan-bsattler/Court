/**
 * Does skill still matter as more cards are hidden? Strong agent (8 worlds,
 * best move) against the app's easy level, seats alternating, same deals
 * at every face-down count.
 *
 *   npx tsx scripts/skill.ts <faceDown> <deals> <out.json>
 */
import { writeFileSync } from "node:fs";
import { LEVELS } from "../src/ai/agent";
import { summarise, versus } from "../src/ai/selfplay";
import { rules } from "../src/engine/rules";

const [fd, n, out] = process.argv.slice(2);
const strong = { worlds: 8, minWorlds: 8, timeBudgetMs: 0, tolerance: 0 };
const weak = { ...LEVELS.easy, timeBudgetMs: 0 };
const margins = versus(Number(n), rules({ faceDown: Number(fd) }), strong, weak, 77);
writeFileSync(out, JSON.stringify({ faceDown: Number(fd), margins }));
console.log(`facedown ${fd}:`, JSON.stringify(summarise(margins)));
