/**
 * Summarise experiments/results/*.json into a markdown table set.
 *   npx tsx scripts/report.ts > experiments/summary.md
 */
import { readFileSync, readdirSync } from "node:fs";
import { makeRng } from "../src/engine/rng";

interface Rec { i: number; margin: number; scores: [number, number]; combos: [string[], string[]]; countered: [string[], string[]] }
const dir = "experiments/results";
const ORDER = ["baseline", "no-service-counter", "no-deposition", "no-counters", "facedown-0", "facedown-6", "facedown-8"];
const data = new Map<string, Rec[]>();
for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const j = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
  // Runs recorded before the counter-reporting fix flagged pairs as countered
  // even with that counter switched off. Scores were right; normalise labels.
  const depOff = j.rules.deposedMarriage >= j.rules.marriage;
  const svcOff = j.rules.counteredService >= j.rules.service;
  for (const r of j.records as Rec[]) {
    for (const p of [0, 1]) {
      r.combos[p] = r.combos[p].map((c) => (c === "marriage!" && depOff) || (c === "service!" && svcOff) ? c.slice(0, -1) : c);
      r.countered[p] = r.countered[p].filter((k) => !(k === "deposition" && depOff) && !(k === "serviceCounter" && svcOff));
    }
  }
  data.set(j.config, j.records);
}
const names = ORDER.filter((n) => data.has(n));

const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
function wilson(k: number, n: number): string {
  const z = 1.96, p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return `${pct(c - h)}–${pct(c + h)}`;
}
/** Paired bootstrap CI of stat(config) - stat(baseline) over deal indices. */
function bootDiff(a: Rec[], b: Rec[], stat: (r: Rec[]) => number): string {
  const n = Math.min(a.length, b.length);
  const rng = makeRng(12345);
  const diffs: number[] = [];
  for (let k = 0; k < 2000; k++) {
    const idx = Array.from({ length: n }, () => rng.int(n));
    diffs.push(stat(idx.map((i) => a[i])) - stat(idx.map((i) => b[i])));
  }
  diffs.sort((x, y) => x - y);
  const point = stat(a.slice(0, n)) - stat(b.slice(0, n));
  return `${point >= 0 ? "+" : ""}${point.toFixed(3)} [${diffs[50].toFixed(3)}, ${diffs[1949].toFixed(3)}]`;
}
const drawRate = (r: Rec[]) => r.filter((x) => x.margin === 0).length / r.length;
const p1Rate = (r: Rec[]) => r.filter((x) => x.margin > 0).length / r.length;
const sdOf = (r: Rec[]) => sd(r.map((x) => x.margin));
const wideRate = (r: Rec[]) => r.filter((x) => Math.abs(x.margin) >= 4).length / r.length;

const out: string[] = [];
out.push("## Outcomes (per deal, player 1's margin)\n");
out.push("| Config | n | P1 wins | Draws | P2 wins | P1 win 95% CI | Mean margin | SD | Range | abs(margin) >= 4 |");
out.push("|---|---|---|---|---|---|---|---|---|---|");
for (const n of names) {
  const r = data.get(n)!, m = r.map((x) => x.margin), N = r.length;
  const w = m.filter((x) => x > 0).length, d = m.filter((x) => x === 0).length, l = N - w - d;
  out.push(`| ${n} | ${N} | ${pct(w / N)} | ${pct(d / N)} | ${pct(l / N)} | ${wilson(w, N)} | ${mean(m) >= 0 ? "+" : ""}${mean(m).toFixed(2)} | ${sd(m).toFixed(2)} | ${Math.min(...m)}..${Math.max(...m)} | ${pct(wideRate(r))} |`);
}

out.push("\n## Two-deal matches (consecutive deals paired, seats swapped, scores summed)\n");
out.push("| Config | matches | Decided | Drawn | SD of match margin |");
out.push("|---|---|---|---|---|");
for (const n of names) {
  const r = data.get(n)!;
  const mm: number[] = [];
  for (let k = 0; k + 1 < r.length; k += 2) mm.push(r[k].margin - r[k + 1].margin);
  const dr = mm.filter((x) => x === 0).length / mm.length;
  out.push(`| ${n} | ${mm.length} | ${pct(1 - dr)} | ${pct(dr)} | ${sd(mm).toFixed(2)} |`);
}

out.push("\n## What hands score (per hand, both seats pooled)\n");
out.push("| Config | Full Court | Coup | Marriage | Service | Deposed (fired) | Service countered (fired) | Mean hand score |");
out.push("|---|---|---|---|---|---|---|---|");
for (const n of names) {
  const r = data.get(n)!, H = r.length * 2;
  const count = (f: (c: string) => boolean) => r.reduce((s, x) => s + x.combos[0].filter(f).length + x.combos[1].filter(f).length, 0) / H;
  const fired = (k: string) => r.reduce((s, x) => s + x.countered[0].filter((c) => c === k).length + x.countered[1].filter((c) => c === k).length, 0) / H;
  const ms = mean(r.flatMap((x) => x.scores));
  out.push(`| ${n} | ${count((c) => c === "fullCourt").toFixed(3)} | ${count((c) => c === "coup").toFixed(3)} | ${count((c) => c === "marriage").toFixed(3)} | ${count((c) => c === "service").toFixed(3)} | ${fired("deposition").toFixed(3)} | ${fired("serviceCounter").toFixed(3)} | ${ms.toFixed(2)} |`);
}

const base = data.get("baseline");
if (base) {
  out.push("\n## Paired differences vs baseline (same deals; point estimate [95% bootstrap CI])\n");
  out.push("| Config | Draw rate | P1 win rate | Margin SD | abs(margin) >= 4 |");
  out.push("|---|---|---|---|---|");
  for (const n of names.filter((x) => x !== "baseline")) {
    const r = data.get(n)!;
    out.push(`| ${n} | ${bootDiff(r, base, drawRate)} | ${bootDiff(r, base, p1Rate)} | ${bootDiff(r, base, sdOf)} | ${bootDiff(r, base, wideRate)} |`);
  }
}
console.log(out.join("\n"));
