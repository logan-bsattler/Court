import { LINE_MASKS, type PlayerView, isFreeClaim, legalMask } from "../engine/game";
import { backSvg, cardSvg } from "./cards";
import { el } from "./dom";

export interface BoardOptions {
  /** Whether the viewing player may tap a card now. */
  interactive: boolean;
  onClaim?: (pos: number) => void;
  /** Called when a non-legal card is tapped while interactive. */
  onIllegal?: (pos: number) => void;
  /** Position to pulse, e.g. the cell the opponent just vacated. */
  flash?: number;
}

/** The 4×4 grid as the viewing player sees it. */
export function renderGrid(view: PlayerView, opts: BoardOptions): HTMLElement {
  const legal = view.occupied ? legalMask(view.occupied, view.ref) : 0;
  const line = view.ref >= 0 && !isFreeClaim(view) ? LINE_MASKS[view.ref] : 0;
  const grid = el("div", { class: "grid", attrs: { role: "grid", "aria-label": "Court grid" } });
  for (let p = 0; p < 16; p++) {
    const occupied = ((view.occupied >> p) & 1) === 1;
    const isLegal = ((legal >> p) & 1) === 1;
    const classes = ["cell"];
    if ((line >> p) & 1) classes.push("line");
    if (p === view.ref) classes.push("ref");
    if (p === opts.flash) classes.push("flash");
    if (!occupied) {
      classes.push("empty");
      grid.append(el("div", { class: classes.join(" "), attrs: { "aria-hidden": "true" } }));
      continue;
    }
    if (opts.interactive) classes.push(isLegal ? "legal" : "dim");
    const card = view.cells[p];
    const btn = el("button", {
      class: classes.join(" "),
      html: card === null ? backSvg() : cardSvg(card),
      attrs: {
        type: "button",
        "aria-label": card === null ? "face-down card" : `card ${p + 1}`,
        ...(opts.interactive && !isLegal ? { "aria-disabled": "true" } : {}),
      },
      on: {
        click: () => {
          if (!opts.interactive) return;
          if (isLegal) opts.onClaim?.(p);
          else opts.onIllegal?.(p);
        },
      },
    });
    grid.append(btn);
  }
  return grid;
}

/**
 * One player's claimed cards in claim order, as the viewing player sees them.
 * Face-down cards the viewer took are marked as hidden from the opponent.
 */
export function renderHand(view: PlayerView, owner: 0 | 1, size = 8, highlightLast = false): HTMLElement {
  const claims = view.claims[owner];
  const row = el("div", { class: "hand" });
  for (let i = 0; i < size; i++) {
    const p = claims[i];
    if (p === undefined) {
      row.append(el("div", { class: "hand-slot" }));
      continue;
    }
    const card = view.cells[p];
    const secret = owner === view.player && ((view.faceDown >> p) & 1) === 1;
    const cls = ["hand-card", secret ? "secret" : "", highlightLast && i === claims.length - 1 ? "new" : ""].join(" ");
    const node = el("div", { class: cls, html: card === null ? backSvg() : cardSvg(card) });
    if (secret) node.append(el("span", { class: "badge", text: "hidden", attrs: { title: "Your opponent has not seen this card" } }));
    row.append(node);
  }
  return row;
}
