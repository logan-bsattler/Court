import { type Difficulty } from "../ai/agent";
import { AiClient } from "../ai/client";
import { cardSvg } from "./cards";
import { type Card, bits, cardLabel } from "../engine/cards";
import {
  type GameState, applyClaim, isFreeClaim, isOver, toMove, viewFor,
} from "../engine/game";
import { randomSeed } from "../engine/rng";
import { DEFAULT_RULES, type RulesConfig, depositionOn, serviceCounterOn } from "../engine/rules";
import { type Allocation, score } from "../engine/scoring";
import { renderGrid, renderHand } from "./board";
import { button, el, sleep } from "./dom";
import {
  DEALS_PER_MATCH, type Match, aiSeat, finishDeal, hasNextDeal, humanSeat, newMatch, outcome, startNextDeal, totals,
} from "./match";
import { load, save } from "./storage";
import { comboName, comboTable, counterText } from "./text";
import { runTutorial } from "./tutorial";

const AI_MIN_THINK_MS = 650;
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export class App {
  private readonly ai = new AiClient();
  private readonly rules: RulesConfig = DEFAULT_RULES;
  private difficulty: Difficulty = load<Difficulty>("difficulty", "medium");
  private match: Match | null = null;
  /** Bumped whenever the screen changes, so stale async AI turns stop. */
  private generation = 0;
  private flash: number | undefined;
  private hintsOn = load("hints", false);
  /** Suggested claim for the current position, if the player asked. */
  private hint: number | undefined;
  private hintPending = false;
  private status = "";
  private statusIsError = false;

  constructor(private readonly root: HTMLElement) {
    if (!DIFFICULTIES.includes(this.difficulty)) this.difficulty = "medium";
  }

  private show(...children: HTMLElement[]): void {
    this.root.replaceChildren(...children);
  }

  /** Switch to a new screen, cancelling any in-flight AI turn. */
  private navigate(...children: HTMLElement[]): void {
    this.generation++;
    this.show(...children);
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------- home

  home(): void {
    const seg = el("div", { class: "segmented", attrs: { role: "radiogroup", "aria-label": "Difficulty" } });
    for (const d of DIFFICULTIES) {
      const b = button(d[0].toUpperCase() + d.slice(1), () => {
        this.difficulty = d;
        save("difficulty", d);
        seg.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      }, `seg ${d === this.difficulty ? "on" : ""}`);
      b.setAttribute("role", "radio");
      seg.append(b);
    }
    const tutorialSeen = load("tutorialSeen", false);
    this.navigate(
      el("main", { class: "screen home" },
        el("div", { class: "logo-cards", html: [12, 9, 6].map((c) => `<div class="logo-card">${cardSvg(c)}</div>`).join("") }),
        el("h1", { class: "title", text: "Court" }),
        el("p", { class: "tagline", text: "A 16-card drafting duel" }),
        el("div", { class: "menu" },
          el("label", { class: "label", text: "Opponent" }),
          seg,
          this.hintSwitch(),
          button("Play match", () => this.startMatch(), "btn primary big"),
          button("How to play", () => this.tutorial(), `btn ${tutorialSeen ? "" : "pulse"}`),
          button("Rules", () => this.rulesSheet(), "btn ghost"),
        ),
        el("p", { class: "fineprint", text: `Two deals per match, seats swapped. ${this.rules.faceDown} cards dealt face down.` }),
      ),
    );
  }

  private tutorial(): void {
    this.generation++;
    runTutorial(this.root, this.rules, () => {
      save("tutorialSeen", true);
      this.home();
    });
  }

  // ---------------------------------------------------------------- match

  startMatch(): void {
    const param = Number(new URLSearchParams(location.search).get("seed"));
    const base = Number.isFinite(param) && param > 0 ? param >>> 0 : randomSeed();
    const seeds = Array.from({ length: DEALS_PER_MATCH }, (_, i) => (base + i) >>> 0);
    this.match = newMatch(this.rules, seeds);
    this.flash = undefined;
    this.hint = undefined;
    this.hintPending = false;
    void this.playTurns();
  }

  private get m(): Match {
    if (!this.match) throw new Error("no match in progress");
    return this.match;
  }

  private async playTurns(): Promise<void> {
    const m = this.m;
    const gen = ++this.generation;
    const live = () => gen === this.generation && this.match === m;
    const ai = aiSeat(m.dealIndex);
    while (!isOver(m.state)) {
      if (toMove(m.state) !== ai) {
        this.setStatusForHuman();
        this.renderGame(true);
        return; // wait for a tap
      }
      this.status = "Opponent is thinking…";
      this.statusIsError = false;
      this.renderGame(false);
      const started = performance.now();
      const move = await this.ai.choose(viewFor(m.state, ai), this.difficulty, aiMoveSeed(m.state));
      if (!live()) return; // left the screen
      await sleep(Math.max(0, AI_MIN_THINK_MS - (performance.now() - started)));
      if (!live()) return;
      m.state = applyClaim(m.state, move);
      this.flash = move;
    }
    this.status = "Grid empty — scoring…";
    this.renderGame(false);
    await sleep(900);
    if (!live()) return;
    finishDeal(m);
    this.dealResult();
  }

  private setStatusForHuman(): void {
    const s = this.m.state;
    this.statusIsError = false;
    if (s.ref < 0) this.status = "Your claim — take any card.";
    else if (isFreeClaim(s)) this.status = "Free Claim! The row and column are empty — take any card.";
    else this.status = "Your claim — same row or column as the empty cell.";
  }

  private onHumanClaim(pos: number): void {
    const m = this.m;
    if (toMove(m.state) !== humanSeat(m.dealIndex)) return;
    m.state = applyClaim(m.state, pos);
    this.flash = undefined;
    this.hint = undefined;
    this.hintPending = false;
    void this.playTurns();
  }

  private hintSwitch(): HTMLElement {
    const input = el("input", { attrs: { type: "checkbox", role: "switch" } });
    input.checked = this.hintsOn;
    input.addEventListener("change", () => {
      this.hintsOn = input.checked;
      save("hints", this.hintsOn);
    });
    return el("label", { class: "switch-row" },
      el("span", {}, el("b", { text: "Hints" }), el("span", { class: "muted", text: " — show the best pick on request" })),
      input);
  }

  /** Ask the hard-level AI for the best claim from the human's own view (it never sees unseen cards). */
  private async requestHint(): Promise<void> {
    const m = this.m;
    const me = humanSeat(m.dealIndex);
    if (this.hintPending || this.hint !== undefined || toMove(m.state) !== me) return;
    const before = m.state;
    this.hintPending = true;
    this.status = "Finding the best pick…";
    this.statusIsError = false;
    this.renderGame(true);
    const view = viewFor(before, me);
    const pos = await this.ai.choose(view, "hard", aiMoveSeed(before) ^ 0x68696e74);
    if (this.match !== m || m.state !== before) return; // moved on meanwhile
    this.hintPending = false;
    this.hint = pos;
    m.hintsUsed++;
    const c = view.cells[pos];
    this.status = `Hint: ${c === null ? "the face-down card" : cardLabel(c)} looks best.`;
    this.renderGame(true);
  }

  private renderGame(humanTurn: boolean): void {
    const m = this.m;
    const me = humanSeat(m.dealIndex);
    const opp = aiSeat(m.dealIndex);
    const view = viewFor(m.state, me);
    const t = totals(m);

    const myHand = handOf(view.claims[me], view.cells);
    const oppKnown = handOf(view.claims[opp], view.cells);
    const myScore = score(myHand, oppKnown, this.rules);
    const oppHidden = view.claims[opp].filter((p) => view.cells[p] === null).length;

    const header = el("header", { class: "topbar" },
      button("✕", () => this.confirmQuit(), "icon-btn"),
      el("div", { class: "topbar-mid" },
        el("div", { class: "deal-no", text: `Deal ${m.dealIndex + 1} of ${DEALS_PER_MATCH} · you play ${me === 0 ? "first" : "second"}` }),
        m.dealIndex > 0 ? el("div", { class: "match-score", text: `Match: You ${t.human} – ${t.ai} Opponent` }) : null,
      ),
      button("?", () => this.rulesSheet(true), "icon-btn"),
    );

    const status = el("div", {
      class: `status ${this.statusIsError ? "error" : ""} ${humanTurn ? "yours" : ""}`,
      text: this.status,
      attrs: { role: "status", "aria-live": "polite" },
    });

    const grid = renderGrid(view, {
      interactive: humanTurn,
      flash: this.flash,
      hint: humanTurn ? this.hint : undefined,
      onClaim: (p) => this.onHumanClaim(p),
      onIllegal: () => {
        this.status = "Not in the row or column of the empty cell.";
        this.statusIsError = true;
        status.textContent = this.status;
        status.classList.remove("shake");
        void status.offsetWidth;
        status.classList.add("error", "shake");
      },
    });

    this.show(
      el("main", { class: "screen game" },
        header,
        el("section", { class: "player opp" },
          el("div", { class: "player-label" },
            el("span", { text: `Opponent · ${this.difficulty}` }),
            el("span", { class: "muted", text: oppHidden ? `${oppHidden} unseen` : "" }),
          ),
          renderHand(view, opp, 8, this.flash !== undefined),
        ),
        status,
        grid,
        el("section", { class: "player me" },
          renderHand(view, me),
          el("div", { class: "player-label" },
            el("span", { text: "You" }),
            this.hintsOn && humanTurn
              ? button(this.hintPending ? "Thinking…" : "Hint", () => void this.requestHint(), "btn hint-btn")
              : null,
            el("span", { class: "muted", text: `${myScore} pts so far` }),
          ),
        ),
      ),
    );
  }

  private confirmQuit(): void {
    this.overlay("Leave this match?", el("p", { text: "The match in progress will be lost." }), [
      ["Keep playing", () => {}],
      ["Leave", () => { this.match = null; this.home(); }],
    ]);
  }

  // ---------------------------------------------------------------- results

  private dealResult(): void {
    const m = this.m;
    const r = m.results[m.dealIndex];
    const me = humanSeat(m.dealIndex);
    const opp = aiSeat(m.dealIndex);
    const diff = r.scores[me] - r.scores[opp];
    const headline = diff > 0 ? `You win the deal by ${diff}` : diff < 0 ? `Opponent wins the deal by ${-diff}` : "Deal drawn";
    const next = hasNextDeal(m);

    this.navigate(
      el("main", { class: "screen results" },
        el("h2", { text: `Deal ${m.dealIndex + 1}` }),
        el("p", { class: `headline ${diff > 0 ? "win" : diff < 0 ? "loss" : ""}`, text: headline }),
        this.scorePanel("You", m.state, r.allocations[me], "the opponent's"),
        this.scorePanel("Opponent", m.state, r.allocations[opp], "your"),
        m.state.faceDown ? el("p", { class: "legend", html: "<i></i>dealt face down" }) : null,
        el("div", { class: "actions" },
          next
            ? button(`Deal ${m.dealIndex + 2} — you play ${humanSeat(m.dealIndex + 1) === 0 ? "first" : "second"}`, () => {
                startNextDeal(m);
                this.flash = undefined;
                void this.playTurns();
              }, "btn primary big")
            : button("Match result", () => this.matchResult(), "btn primary big"),
        ),
        el("p", { class: "fineprint", text: `Deal seed ${m.seeds[m.dealIndex]}` }),
      ),
    );
  }

  private scorePanel(name: string, s: GameState, a: Allocation, oppPossessive: string): HTMLElement {
    const wasHidden = (c: Card) => ((s.faceDown >> s.layout.indexOf(c)) & 1) === 1;
    const cardsRow = (mask: number) =>
      el("div", { class: "mini-row" },
        ...bits(mask).map((c) => el("div", { class: `mini ${wasHidden(c) ? "revealed" : ""}`, html: cardSvg(c) })));
    const lines: HTMLElement[] = [];
    for (const c of a.combos) {
      lines.push(el("div", { class: `line-item ${c.countered ? "countered" : ""}` },
        el("div", { class: "li-head" }, el("span", { text: comboName(c) + (c.countered ? " (countered)" : "") }), el("b", { text: `${c.value}` })),
        cardsRow(c.mask)));
    }
    if (a.retainers.length) {
      lines.push(el("div", { class: "line-item" },
        el("div", { class: "li-head" },
          el("span", { text: `Retainers ×${a.retainers.length}` }), el("b", { text: `${a.retainerValue}` })),
        cardsRow(a.retainers.reduce((mk, c) => mk | (1 << c), 0))));
    }
    const counters = a.counters.map((c) => el("div", { class: "counter-note", text: `⚔ ${counterText(c, oppPossessive)}` }));
    return el("section", { class: "panel" },
      el("div", { class: "panel-head" }, el("h3", { text: name }), el("div", { class: "total", text: `${a.total}` })),
      ...lines,
      ...counters,
    );
  }

  private matchResult(): void {
    const m = this.m;
    const t = totals(m);
    const o = outcome(m);
    const headline = o === "win" ? "You win the match!" : o === "loss" ? "Opponent wins the match" : "Match drawn";
    const rows = m.results.map((r, i) =>
      el("tr", {}, el("td", { text: `Deal ${i + 1} (you ${humanSeat(i) === 0 ? "1st" : "2nd"})` }),
        el("td", { text: `${r.scores[humanSeat(i)]}` }), el("td", { text: `${r.scores[aiSeat(i)]}` })));
    this.navigate(
      el("main", { class: "screen results" },
        el("h2", { text: "Match over" }),
        el("p", { class: `headline big ${o}`, text: headline }),
        m.hintsUsed ? el("p", { class: "fineprint", text: `Hints used: ${m.hintsUsed}` }) : null,
        el("table", { class: "match-table" },
          el("thead", {}, el("tr", {}, el("th", { text: "" }), el("th", { text: "You" }), el("th", { text: "Opp." }))),
          el("tbody", {}, ...rows,
            el("tr", { class: "sum" }, el("td", { text: "Total" }), el("td", { text: `${t.human}` }), el("td", { text: `${t.ai}` })))),
        el("div", { class: "actions" },
          button("Play again", () => this.startMatch(), "btn primary big"),
          button("Home", () => this.home(), "btn"),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------- overlays

  rulesSheet(inGame = false): void {
    const r = this.rules;
    const body = el("div", { class: "rules" },
      el("h4", { text: "Claiming" }),
      el("p", { text: "Take turns claiming one card until the grid is empty — eight each. The first claim may be any card. Every later claim must come from the same row or column as the cell the previous claim left empty." }),
      el("p", { text: "Free Claim: if that row and column are both empty, claim any card." }),
      el("h4", { text: "Face-down cards" }),
      el("p", { text: `${r.faceDown} cells are dealt face down. Claim one and you see it; your opponent doesn't until scoring — and the same goes for theirs.` }),
      el("h4", { text: "Scoring" }),
      el("table", { class: "rules-table" },
        el("tbody", {}, ...comboTable(r).map(([n, d, v]) =>
          el("tr", {}, el("td", {}, el("b", { text: n }), el("div", { class: "muted", text: d })), el("td", { class: "pts", text: `${v}` }))))),
      el("p", { text: "Each card counts once. Your best allocation is chosen for you." }),
      depositionOn(r) ? el("p", {}, el("b", { text: "Deposition: " }), document.createTextNode(`a Marriage scores ${r.deposedMarriage} if your opponent holds that suit's Ace. Its King and Queen become Retainers.`)) : null,
      serviceCounterOn(r) ? el("p", {}, el("b", { text: "Service counter: " }), document.createTextNode(`a Service scores ${r.counteredService} if your opponent holds that suit's Queen. Its Jack and Ace become Retainers.`)) : null,
      el("p", { class: "muted", text: "Counters work even when the Ace or Queen is part of the opponent's own combination. They never affect a Full Court." }),
      el("h4", { text: "Match" }),
      el("p", { text: "Two deals with seats swapped; scores are summed. A tied match is a draw." }),
    );
    this.overlay("Rules", body, [[inGame ? "Back to game" : "Close", () => {}]]);
  }

  private overlay(title: string, body: HTMLElement, actions: [string, () => void][]): void {
    const close = () => backdrop.remove();
    const backdrop = el("div", { class: "backdrop", on: { click: (e) => { if (e.target === backdrop) close(); } } },
      el("div", { class: "sheet", attrs: { role: "dialog", "aria-modal": "true", "aria-label": title } },
        el("h3", { text: title }),
        body,
        el("div", { class: "actions" }, ...actions.map(([label, fn], i) =>
          button(label, () => { close(); fn(); }, i === actions.length - 1 ? "btn primary" : "btn"))),
      ),
    );
    document.body.append(backdrop);
  }
}

function handOf(claims: readonly number[], cells: readonly (Card | null)[]): number {
  let mask = 0;
  for (const p of claims) {
    const c = cells[p];
    if (c !== null) mask |= 1 << c;
  }
  return mask;
}

/** Per-move AI seed derived from the deal, so a replayed seed replays the AI too. */
function aiMoveSeed(s: GameState): number {
  const ply = s.claims[0].length + s.claims[1].length;
  return (Math.imul(s.seed ^ 0x5bd1e995, 31) + ply * 0x9e3779b1) >>> 0;
}
