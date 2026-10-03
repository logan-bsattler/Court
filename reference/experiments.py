"""COURT — experiments.

Answers the playtest questions in §8 of the spec exactly rather than
statistically: every deal is solved under perfect play by both sides.
The only sampling is over which deals get looked at.

    python3 experiments.py balance   [n]      Q1 — first-player advantage
    python3 experiments.py decisions [n]      Q2 — where the game stops mattering
    python3 experiments.py combos    [n]      Q3/Q4 — what perfect play collects
    python3 experiments.py sweep     [n]      Full Court / Coup value sweep
    python3 experiments.py deposition [n]     Deposition on / softened / off
"""

import random
import sys
from collections import Counter

from court import Scoring, random_layout, legal_moves, allocate, FULL_GRID
from solve import Solver


def solve_deal(layout, sc, reprieve=False):
    s = Solver(layout, sc)
    if reprieve:
        s.reprieve = True
    return s.solve()


def deals(n, seed=0):
    rng = random.Random(seed)
    return [random_layout(rng) for _ in range(n)]


# --------------------------------------------------------------------------

def balance(n):
    """Q1: does the first player win substantially more than half the time?"""
    margins = []
    for i, lay in enumerate(deals(n)):
        v, _ = Solver(lay).solve()
        margins.append(v)
        if (i + 1) % 10 == 0:
            print(f"  ...{i+1}/{n}", flush=True)

    wins = sum(1 for m in margins if m > 0)
    draws = sum(1 for m in margins if m == 0)
    losses = sum(1 for m in margins if m < 0)
    print(f"\nDeals solved: {n}")
    print(f"  P1 wins   {wins:4d}  ({wins/n:.1%})")
    print(f"  Draws     {draws:4d}  ({draws/n:.1%})")
    print(f"  P2 wins   {losses:4d}  ({losses/n:.1%})")
    print(f"  Mean margin (P1): {sum(margins)/n:+.2f}")
    print(f"  Margin spread: {min(margins)} to {max(margins)}")
    print("  Distribution:")
    for m, c in sorted(Counter(margins).items()):
        print(f"    {m:+3d}: {'#' * c} {c}")


def decisions(n):
    """Q2: at what ply does the game stop being a decision?

    A ply is a 'real decision' if the legal moves do not all lead to the same
    solved value.  We report the last such ply per deal — everything after it
    is bookkeeping no matter what either player does.
    """
    last_real = []
    for i, lay in enumerate(deals(n)):
        s = Solver(lay)
        s.solve()  # fill the table
        occupied, p1, p2, ref = FULL_GRID, 0, 0, -1
        last = 0
        for ply in range(1, 17):
            p1_to_move = (bin(occupied).count("1") % 2) == 0
            vals = []
            best_p, best_v = None, -999
            for p in legal_moves(occupied, ref):
                c = lay[p]
                np1 = p1 | (1 << c) if p1_to_move else p1
                np2 = p2 if p1_to_move else p2 | (1 << c)
                v = -s._negamax(occupied ^ (1 << p), np1, np2, p, -999, 999)
                vals.append(v)
                if v > best_v:
                    best_v, best_p = v, p
            if len(set(vals)) > 1:
                last = ply
            c = lay[best_p]
            if p1_to_move:
                p1 |= 1 << c
            else:
                p2 |= 1 << c
            occupied ^= 1 << best_p
            ref = best_p
        last_real.append(last)
        if (i + 1) % 10 == 0:
            print(f"  ...{i+1}/{n}", flush=True)

    print(f"\nLast ply that was a real decision (of 16), over {n} deals:")
    for ply, c in sorted(Counter(last_real).items()):
        print(f"    ply {ply:2d}: {'#' * c} {c}")
    print(f"  Mean: {sum(last_real)/n:.1f}")
    dead = [16 - x for x in last_real]
    print(f"  Mean dead plies at the end: {sum(dead)/n:.1f}")


def combos(n):
    """Q3/Q4: what do perfectly played hands actually contain?"""
    tally = Counter()
    jack_use = Counter()
    for i, lay in enumerate(deals(n)):
        _, (_, p1, p2) = Solver(lay).solve()
        for hand, opp in ((p1, p2), (p2, p1)):
            _, chosen = allocate(hand, opp)
            for label, _v in chosen:
                kind = label.split()[0]
                tally[kind] += 1
                if "DEPOSED" in label:
                    tally["Deposed"] += 1
        if (i + 1) % 10 == 0:
            print(f"  ...{i+1}/{n}", flush=True)

    print(f"\nCombinations in optimally played hands ({2*n} hands):")
    for kind, c in tally.most_common():
        print(f"    {kind:12s} {c:4d}   {c/(2*n):.2f} per hand")


def sweep(n):
    """How does the Full Court / Coup value change what gets built?"""
    print(f"{'full_court':>10} {'coup':>5} {'mean margin':>12} {'P1 win%':>8}")
    for fc in (12, 14, 16):
        for coup in (12, 14, 16):
            if fc != 12 and coup != 12:
                continue
            sc = Scoring(full_court=fc, coup=coup)
            ms = [Solver(lay, sc).solve()[0] for lay in deals(n)]
            w = sum(1 for m in ms if m > 0) / n
            print(f"{fc:>10} {coup:>5} {sum(ms)/n:>+12.2f} {w:>8.1%}")


def deposition(n):
    """Is deposition too punishing?  Compare 0 / 2 / 6 (i.e. off)."""
    print(f"{'deposed value':>14} {'mean margin':>12} {'P1 win%':>8} {'draws':>7}")
    for dv in (0, 2, 6):
        sc = Scoring(deposed_marriage=dv)
        ms = [Solver(lay, sc).solve()[0] for lay in deals(n)]
        w = sum(1 for m in ms if m > 0) / n
        d = sum(1 for m in ms if m == 0) / n
        print(f"{dv:>14} {sum(ms)/n:>+12.2f} {w:>8.1%} {d:>7.1%}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "balance"
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 50
    {"balance": balance, "decisions": decisions, "combos": combos,
     "sweep": sweep, "deposition": deposition}[cmd](n)
