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
  /** Position to mark as the suggested claim. */
  hint?: number;
  /** Positions of cards the opponent needs to finish a Full Court or Coup. */
  warn?: number[];
  /** Show odds for an unseen card (via its % badge or a long press). */
  onOdds?: (pos: number) => void;
}

const LONG_PRESS_MS = 450;

/** Long press calls `fn` and swallows the click that follows it. */
function onLongPress(node: HTMLElement, fn: () => void): void {
  let timer = 0;
  let fired = false;
  const cancel = () => clearTimeout(timer);
  node.addEventListener("pointerdown", () => {
    fired = false;
    timer = window.setTimeout(() => { fired = true; fn(); }, LONG_PRESS_MS);
  });
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) node.addEventListener(ev, cancel);
  node.addEventListener("click", (e) => { if (fired) { e.stopImmediatePropagation(); e.preventDefault(); fired = false; } }, true);
  node.addEventListener("contextmenu", (e) => e.preventDefault());
}

function oddsBadge(pos: number, onOdds: (pos: number) => void): HTMLElement {
  return el("span", {
    class: "odds-badge", text: "%",
    attrs: { role: "button", "aria-label": "What could this card be?", tabindex: "0" },
    on: { click: (e) => { e.stopPropagation(); onOdds(pos); } },
  });
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
    if (p === opts.hint) classes.push("hint");
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
    if (opts.warn?.includes(p)) {
      btn.classList.add("warned");
      btn.append(el("span", { class: "warn-badge", text: "⚠", attrs: { title: "Your opponent needs this card" } }));
    }
    if (card === null && opts.onOdds) {
      btn.append(oddsBadge(p, opts.onOdds));
      onLongPress(btn, () => opts.onOdds!(p));
    }
    grid.append(btn);
  }
  return grid;
}

/**
 * One player's claimed cards in claim order, as the viewing player sees them.
 * Face-down cards the viewer took are marked as hidden from the opponent.
 */
export function renderHand(
  view: PlayerView, owner: 0 | 1, size = 8, highlightLast = false, onOdds?: (pos: number) => void,
): HTMLElement {
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
    if (card !== null) node.dataset.card = String(card);
    if (card === null && onOdds) {
      node.classList.add("tappable");
      node.setAttribute("role", "button");
      node.setAttribute("aria-label", "Opponent's face-down card: what could it be?");
      node.addEventListener("click", () => onOdds(p));
    }
    if (secret) node.append(el("span", { class: "badge", text: "hidden", attrs: { title: "Your opponent has not seen this card" } }));
    row.append(node);
  }
  return row;
}
