import { describe, expect, it } from "vitest";
import parity from "./fixtures/parity.json";
import { cardName, handFromNames as h, parseCard } from "../src/engine/cards";
import { DEFAULT_RULES, type RulesConfig, rules } from "../src/engine/rules";
import { allocate, score } from "../src/engine/scoring";

const R = DEFAULT_RULES;

describe("scoring", () => {
  it("worked example from the spec scores 16", () => {
    const hand = h("Ks Qs Js As Kh Qh Kd Jc");
    const opp = h("Ah");
    expect(score(hand, opp, R)).toBe(16);

    const a = allocate(hand, opp, R);
    expect(a.total).toBe(16);
    expect(a.combos.map((c) => [c.kind, c.index, c.value])).toEqual([["fullCourt", 0, 12]]);
    expect(a.retainers.map(cardName).sort()).toEqual(["Jc", "Kd", "Kh", "Qh"]);
    expect(a.counters).toEqual([{ kind: "deposition", suit: 1, by: parseCard("Ah"), mask: h("Kh Qh") }]);
  });

  it("Marriage scores 6, or 2 as Retainers when deposed", () => {
    expect(score(h("Kh Qh"), 0, R)).toBe(6);
    expect(score(h("Kh Qh"), h("Ah"), R)).toBe(2);
    // a different suit's Ace does not depose
    expect(score(h("Kh Qh"), h("As Ad Ac"), R)).toBe(6);
  });

  it("Service scores 4, or 2 as Retainers when countered", () => {
    expect(score(h("Jd Ad"), 0, R)).toBe(4);
    expect(score(h("Jd Ad"), h("Qd"), R)).toBe(2);
    expect(score(h("Jd Ad"), h("Qs Qh Qc"), R)).toBe(4);
    const a = allocate(h("Jd Ad"), h("Qd"), R);
    expect(a.combos).toEqual([]);
    expect(a.counters.map((c) => c.kind)).toEqual(["serviceCounter"]);
  });

  it("a counter fires even when the countering card is in the opponent's own combination", () => {
    const opp = h("Jh Ah"); // opponent's own heart Service
    expect(score(opp, 0, R)).toBe(4);
    expect(score(h("Kh Qh"), opp, R)).toBe(2);
    // and an opponent's Queen inside their Marriage still counters a Service
    expect(score(h("Js As"), h("Ks Qs"), R)).toBe(2);
  });

  it("a counter switched off in the config neither scores nor reports as fired", () => {
    const off = rules({ deposedMarriage: 6, counteredService: 4 });
    const a = allocate(h("Kh Qh Jd Ad"), h("Ah Qd"), off);
    expect(a.total).toBe(10);
    expect(a.combos.every((c) => !c.countered)).toBe(true);
    expect(a.counters).toEqual([]);
  });

  it("overlapping options take the higher-scoring allocation", () => {
    // Coup of Kings (12) + 4 Retainers beats Marriage (6) + 6 Retainers
    const coup = h("Ks Kh Kd Kc Qs Jd Jc Ah");
    expect(score(coup, 0, R)).toBe(16);
    expect(allocate(coup, 0, R).combos.map((c) => c.kind)).toEqual(["coup"]);

    // three Marriages (18) + 2 Retainers beat Coup of Kings (12) + 4 Retainers
    const marriages = h("Ks Kh Kd Kc Qs Qh Qd Jd");
    expect(score(marriages, 0, R)).toBe(20);
    expect(allocate(marriages, 0, R).combos.map((c) => c.kind)).toEqual(["marriage", "marriage", "marriage"]);

    // ...but once two of them are deposed the Coup is better
    expect(score(marriages, h("As Ah"), R)).toBe(16);
  });

  it("allocation always accounts for every card exactly once", () => {
    const hand = h("Ks Qs Js As Kh Kd Kc Jh");
    const a = allocate(hand, 0, R);
    const used = a.combos.reduce((m, c) => m | c.mask, 0);
    const ret = a.retainers.reduce((m, c) => m | (1 << c), 0);
    expect(used & ret).toBe(0);
    expect(used | ret).toBe(hand);
    expect(a.combos.reduce((t, c) => t + c.value, 0) + a.retainerValue).toBe(a.total);
  });

  it("matches the Python reference engine on 1,200 hand pairs", () => {
    const configs = Object.fromEntries(
      Object.entries(parity.configs).map(([k, v]) => [k, rules(v as Partial<RulesConfig>)]),
    );
    let mismatches = 0;
    for (const c of parity.cases) {
      const r = configs[c.config];
      if (score(c.hand, c.opponent, r) !== c.score) mismatches++;
      // allocate must agree with score
      if (allocate(c.hand, c.opponent, r).total !== c.score) mismatches++;
    }
    expect(parity.cases.filter((c) => c.config === "default").length).toBe(1000);
    expect(mismatches).toBe(0);
  });
});
