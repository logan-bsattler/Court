import { RANK_NAMES, SUIT_SYMBOLS, bits, cardLabel } from "../engine/cards";
import type { RulesConfig } from "../engine/rules";
import type { Combo, CounterFired } from "../engine/scoring";

const plural = (rank: number) => (rank === 3 ? "Aces" : `${RANK_NAMES[rank]}s`);

export function comboName(c: Combo): string {
  switch (c.kind) {
    case "fullCourt": return `Full Court ${SUIT_SYMBOLS[c.index]}`;
    case "coup": return `Coup of ${plural(c.index)}`;
    case "marriage": return `Marriage ${SUIT_SYMBOLS[c.index]}`;
    case "service": return `Service ${SUIT_SYMBOLS[c.index]}`;
  }
}

/** Name of a four-card set, e.g. "Full Court ♠" or "Coup of Kings". */
export function setName(kind: "fullCourt" | "coup", index: number): string {
  return kind === "fullCourt" ? `Full Court ${SUIT_SYMBOLS[index]}` : `Coup of ${plural(index)}`;
}

export function counterText(c: CounterFired, opponentName: string): string {
  const pair = bits(c.mask).map(cardLabel).join(" ");
  return c.kind === "deposition"
    ? `Marriage ${pair} deposed by ${opponentName} ${cardLabel(c.by)}`
    : `Service ${pair} countered by ${opponentName} ${cardLabel(c.by)}`;
}

/** Rule summary lines, always built from the live config. */
export function comboTable(r: RulesConfig): [string, string, number][] {
  return [
    ["Full Court", "All four cards of one suit", r.fullCourt],
    ["Coup", "All four cards of one rank", r.coup],
    ["Marriage", "King + Queen of one suit", r.marriage],
    ["Service", "Jack + Ace of one suit", r.service],
    ["Retainer", "Any card in no combination", r.retainer],
  ];
}
