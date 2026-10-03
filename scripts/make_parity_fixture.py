"""Generate tests/fixtures/parity.json from the Python reference engine.

Scores 1,000 random hand pairs with reference/court.py under the default
ruleset, plus 200 more under alternative configs, so the TypeScript scorer
can be checked against it without Python installed.

    python3 scripts/make_parity_fixture.py
"""
import json
import os
import random
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "reference"))

from court import Scoring, score  # noqa: E402

CONFIGS = {
    "default": Scoring(),
    "counters_off": Scoring(deposed_marriage=6, countered_service=4),
    "soft_values": Scoring(full_court=16, coup=14, deposed_marriage=2, countered_service=3, retainer=1),
}


def to_rules(sc):
    return {
        "fullCourt": sc.full_court, "coup": sc.coup, "marriage": sc.marriage,
        "service": sc.service, "retainer": sc.retainer,
        "deposedMarriage": sc.deposed_marriage, "counteredService": sc.countered_service,
    }


def random_pair(rng):
    cards = list(range(16))
    rng.shuffle(cards)
    # mostly full 8/8 end-of-game splits, some partial hands mid-game
    if rng.random() < 0.8:
        a, b = cards[:8], cards[8:]
    else:
        k = rng.randint(0, 8)
        a, b = cards[:k], cards[k:k + rng.randint(0, 8)]
    return sum(1 << c for c in a), sum(1 << c for c in b)


def main():
    rng = random.Random(20260801)
    cases = []
    for name, n in (("default", 1000), ("counters_off", 100), ("soft_values", 100)):
        sc = CONFIGS[name]
        for _ in range(n):
            h, o = random_pair(rng)
            cases.append({"config": name, "hand": h, "opponent": o, "score": score(h, o, sc)})
    out = {"configs": {k: to_rules(v) for k, v in CONFIGS.items()}, "cases": cases}
    path = os.path.join(ROOT, "tests", "fixtures", "parity.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {len(cases)} cases to {path}")


if __name__ == "__main__":
    main()
