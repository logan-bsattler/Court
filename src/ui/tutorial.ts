import { bits, handFromNames, parseCard } from "../engine/cards";
import { type GameState, applyClaim, fromLayout, isFreeClaim, legalClaims, viewFor } from "../engine/game";
import type { RulesConfig } from "../engine/rules";
import { score } from "../engine/scoring";
import { renderGrid, renderHand } from "./board";
import { cardSvg } from "./cards";
import { button, el, sleep } from "./dom";
import { TIEBREAKS, TIEBREAK_LABELS } from "./match";
import { comboTable } from "./text";

/** Fixed demo layout: a shuffled-looking deck so the steps are repeatable. */
const DEMO = "Qh Js Ad Kc Ah Kd Jc Qs Jd Kh As Qc Ks Qd Jh Ac".split(" ").map(parseCard);

interface Step {
  title: string;
  text: string;
  /** Builds the demo area; call done() when an interactive step is completed. */
  demo?: (done: () => void, say: (msg: string, error?: boolean) => void) => HTMLElement;
  interactive?: boolean;
}

const minis = (names: string) =>
  el("div", { class: "mini-row" }, ...bits(handFromNames(names)).map((c) => el("div", { class: "mini", html: cardSvg(c) })));

export function runTutorial(root: HTMLElement, rules: RulesConfig, onDone: () => void): void {
  const plain = { ...rules, faceDown: 0 };
  let live = 0; // cancels async demo steps when the step changes

  /** Interactive grid where player 1 is the learner and player 2 replies by script. */
  function claimDemo(
    start: GameState,
    done: () => void,
    say: (msg: string, error?: boolean) => void,
    opts: { reply: boolean; illegalMsg: string },
  ): HTMLElement {
    const box = el("div", { class: "demo" });
    let s = start;
    const token = live;
    const draw = (interactive: boolean, flash?: number) => {
      const v = viewFor(s, 0);
      box.replaceChildren(
        renderGrid(v, {
          interactive,
          flash,
          onClaim: async (p) => {
            s = applyClaim(s, p);
            if (!opts.reply) {
              draw(false);
              done();
              return;
            }
            draw(false);
            say("Opponent is claiming from the row or column you left empty…");
            await sleep(900);
            if (token !== live) return;
            const reply = legalClaims(s)[0];
            s = applyClaim(s, reply);
            draw(false, reply);
            done();
          },
          onIllegal: () => say(opts.illegalMsg, true),
        }),
        renderHand(v, 0, 8),
      );
    };
    draw(true);
    return box;
  }

  const steps: Step[] = [
    {
      title: "The grid",
      text: "Court is played with 16 cards — Ace, King, Queen and Jack in four suits — dealt into a 4×4 grid. You and your opponent take turns claiming one card until the grid is empty, so each of you ends with eight.",
      demo: () => el("div", { class: "demo" }, renderGrid(viewFor(fromLayout(DEMO, 0, plain), 0), { interactive: false })),
    },
    {
      title: "The first claim",
      text: "The first claim of a deal can be any card. Tap one.",
      interactive: true,
      demo: (done, say) => claimDemo(fromLayout(DEMO, 0, plain), () => {
        say("Your opponent claimed a card in the row or column of the cell you emptied.");
        done();
      }, say, { reply: true, illegalMsg: "" }),
    },
    {
      title: "Row or column",
      text: "Every later claim must come from the same row or column as the cell the previous claim left empty — the highlighted lines. Gaps don't block. Tap a highlighted card.",
      interactive: true,
      demo: (done, say) => {
        let s = fromLayout(DEMO, 0, plain);
        s = applyClaim(s, 5);
        s = applyClaim(s, 6);
        return claimDemo(s, () => { say("Right. Every claim hands your opponent a row and a column — choose them carefully."); done(); }, say,
          { reply: false, illegalMsg: "That card isn't in the row or column of the empty cell." });
      },
    },
    {
      title: "Free Claim",
      text: "If the empty cell's row and column have no cards left, the restriction lifts: claim any card you like. Tap any card.",
      interactive: true,
      demo: (done, say) => {
        let s = fromLayout(DEMO, 0, plain);
        for (const p of [1, 2, 3, 15, 12, 8, 4, 0]) s = applyClaim(s, p);
        if (!isFreeClaim(s)) throw new Error("tutorial free-claim setup is wrong");
        return claimDemo(s, () => { say("Engineering a Free Claim for yourself — or denying one — often decides the late game."); done(); }, say,
          { reply: false, illegalMsg: "" });
      },
    },
    {
      title: "Face-down cards",
      text: `${rules.faceDown} cells are dealt face down. Claim one and you see it — your opponent doesn't until scoring. The badge marks cards only you have seen. Their face-down claims stay hidden from you the same way.`,
      demo: () => {
        const fd = (1 << 2) | (1 << 7) | (1 << 9) | (1 << 13);
        let s = fromLayout(DEMO, fd, rules);
        // you take face-down 9, the opponent face-down 13, you take 12
        for (const p of [9, 13, 12]) s = applyClaim(s, p);
        const v = viewFor(s, 0);
        return el("div", { class: "demo compact" },
          el("div", { class: "demo-caption", text: "Opponent" }), renderHand(v, 1),
          renderGrid(v, { interactive: false }),
          el("div", { class: "demo-caption", text: "You" }), renderHand(v, 0));
      },
    },
    {
      title: "Combinations",
      text: "At the end each hand is split into combinations. Every card counts once, and the best split is chosen for you automatically.",
      demo: () => {
        const examples = ["Ks Qs Js As", "Kh Ks Kd Kc", "Kd Qd", "Jc Ac", "Jh"];
        return el("div", { class: "demo combos" }, ...comboTable(rules).map(([name, desc, pts], i) =>
          el("div", { class: "combo-row" },
            el("div", {}, el("b", { text: name }), el("div", { class: "muted", text: desc })),
            minis(examples[i]),
            el("div", { class: "pts", text: `${pts}` }))));
      },
    },
    {
      title: "Counters",
      text: "Two counters punish the small combinations. They apply even if the countering card is part of your opponent's own combination, and never touch a Full Court.",
      demo: () => {
        const ex = (title: string, mine: string, theirs: string, why: string) =>
          el("div", { class: "counter-ex" },
            el("b", { text: title }),
            el("div", { class: "vs" }, el("div", {}, el("div", { class: "muted", text: "You" }), minis(mine)),
              el("div", { class: "vs-x", text: "vs" }),
              el("div", {}, el("div", { class: "muted", text: "Opponent holds" }), minis(theirs))),
            el("div", { text: `${score(handFromNames(mine), 0, rules)} → ${score(handFromNames(mine), handFromNames(theirs), rules)} points. ${why}` }));
        return el("div", { class: "demo" },
          ex("Deposition", "Kh Qh", "Ah", "The Ace of a suit deposes its Marriage; King and Queen fall back to Retainers."),
          ex("Service counter", "Jd Ad", "Qd", "The Queen of a suit counters its Service; Jack and Ace fall back to Retainers."));
      },
    },
    {
      title: "The match",
      text: `A match is two deals with seats swapped — you go first in one and second in the other — and scores are summed. Level totals go to a tiebreak: ${TIEBREAKS.map((tb) => `most ${TIEBREAK_LABELS[tb]}`).join(", then ")}. Aces and Queens attack; Kings and Jacks build. Good luck.`,
    },
  ];

  let i = 0;
  const render = () => {
    live++;
    const step = steps[i];
    let completed = !step.interactive;
    const msg = el("div", { class: "status", attrs: { role: "status", "aria-live": "polite" } });
    const say = (text: string, error = false) => {
      msg.textContent = text;
      msg.classList.toggle("error", error);
      if (error) { msg.classList.remove("shake"); void msg.offsetWidth; msg.classList.add("shake"); }
    };
    const next = button(i === steps.length - 1 ? "Finish" : "Next", () => {
      if (!completed) return;
      if (i === steps.length - 1) onDone();
      else { i++; render(); }
    }, "btn primary");
    next.disabled = !completed;
    const done = () => { completed = true; next.disabled = false; };
    const demo = step.demo?.(done, say);
    root.replaceChildren(
      el("main", { class: "screen tutorial" },
        el("header", { class: "topbar" },
          button("✕", onDone, "icon-btn"),
          el("div", { class: "dots" }, ...steps.map((_, k) => el("span", { class: `dot ${k === i ? "on" : k < i ? "past" : ""}` }))),
          el("span", { class: "icon-spacer" }),
        ),
        el("h2", { text: step.title }),
        el("p", { class: "tut-text", text: step.text }),
        msg,
        demo ?? el("div"),
        el("div", { class: "actions row" },
          i > 0 ? button("Back", () => { i--; render(); }, "btn") : el("span"),
          next),
      ),
    );
    window.scrollTo(0, 0);
  };
  render();
}
