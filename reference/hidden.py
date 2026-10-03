"""COURT — hidden information variant (spec §6.2, asymmetric version).

Four of the sixteen cells are dealt FACE DOWN.  A face-down card is claimed
blind; under the asymmetric rule the claimer sees what they took and the
opponent does not.  Under the symmetric rule nobody sees anything until
scoring.

The uncertainty here has a very convenient shape.  The deck is a known 16
cards and the face-down POSITIONS are public, so a player's ignorance is
never about which cards exist — it is only about which of a known handful of
cards sits in which of a known handful of cells.  With four face-down cards
that is at most 4! = 24 possible worlds, so determinizations can be
ENUMERATED rather than sampled, and the agent's belief is exact.

Agents are PIMC (perfect-information Monte Carlo): for each possible world,
solve exactly, then take the move with the best average value.  The known
weakness applies — inside each solved world the opponent is assumed to see
everything, so these agents never bluff and never play to conceal.  They
therefore UNDERSTATE the value of hidden information, which makes them a
conservative test: if hiding cards breaks the mirror even for players who
cannot exploit concealment, it breaks it.
"""

import itertools
import math
import random
from collections import Counter

from court import Scoring, random_layout, legal_moves, score, FULL_GRID
from solve import Solver


class Game:
    """One deal of the hidden-information variant."""

    def __init__(self, layout, face_down, reveal_to_claimer=True,
                 scoring=Scoring()):
        self.layout = layout
        self.face_down = frozenset(face_down)   # positions, public knowledge
        self.reveal = reveal_to_claimer
        self.sc = scoring
        self.occupied = FULL_GRID
        self.ref = -1
        self.claims = ([], [])   # positions claimed by p1, p2
        # what each player knows: positions whose card identity they have seen
        self.known = [set(p for p in range(16) if p not in self.face_down)
                      for _ in range(2)]

    # -- knowledge ---------------------------------------------------------

    def possible_worlds(self, player, cap=24, rng=None):
        """Layouts consistent with `player`'s knowledge.

        Enumerated exactly when the belief space is small (four face-down
        cards never exceed 4! = 24). Beyond the cap the space is factorial,
        so worlds are sampled and the belief becomes an approximation.
        """
        unknown_pos = [p for p in range(16) if p not in self.known[player]]
        if not unknown_pos:
            return [self.layout]
        unknown_cards = [self.layout[p] for p in unknown_pos]
        if math.factorial(len(unknown_pos)) > cap:
            rng = rng or random
            worlds = []
            for _ in range(cap):
                perm = unknown_cards[:]
                rng.shuffle(perm)
                lay = list(self.layout)
                for pos, c in zip(unknown_pos, perm):
                    lay[pos] = c
                worlds.append(tuple(lay))
            return worlds
        worlds = []
        for perm in itertools.permutations(unknown_cards):
            lay = list(self.layout)
            for pos, c in zip(unknown_pos, perm):
                lay[pos] = c
            worlds.append(tuple(lay))
        return worlds

    def hands_in(self, layout):
        h = [0, 0]
        for pl in (0, 1):
            for p in self.claims[pl]:
                h[pl] |= 1 << layout[p]
        return h[0], h[1]

    # -- play --------------------------------------------------------------

    def to_move(self):
        return 0 if bin(self.occupied).count("1") % 2 == 0 else 1

    def apply(self, pos):
        pl = self.to_move()
        self.claims[pl].append(pos)
        if self.reveal:
            self.known[pl].add(pos)
        self.occupied ^= 1 << pos
        self.ref = pos

    def result(self):
        p1, p2 = self.hands_in(self.layout)
        return score(p1, p2, self.sc) - score(p2, p1, self.sc)


def pimc_move(game, player, max_worlds=24, rng=None):
    """Average the exact solution over every world the player thinks possible."""
    worlds = game.possible_worlds(player, cap=max_worlds, rng=rng)
    if len(worlds) > max_worlds:
        worlds = (rng or random).sample(worlds, max_worlds)

    moves = legal_moves(game.occupied, game.ref)
    if len(moves) == 1:
        return moves[0]

    totals = {m: 0 for m in moves}
    for lay in worlds:
        s = Solver(lay, game.sc)
        p1, p2 = game.hands_in(lay)
        for m in moves:
            c = lay[m]
            np1 = p1 | (1 << c) if player == 0 else p1
            np2 = p2 if player == 0 else p2 | (1 << c)
            # value returned is from the perspective of the next player,
            # so negate to get it from this player's perspective
            v = -s._negamax(game.occupied ^ (1 << m), np1, np2, m, -999, 999)
            totals[m] += v

    best = max(totals.values())
    ties = [m for m in moves if totals[m] == best]
    return (rng or random).choice(ties)


def play_deal(layout, face_down, reveal=True, scoring=Scoring(),
              max_worlds=24, rng=None, agents=("pimc", "pimc")):
    """agents: per-player, 'pimc' or 'random'."""
    g = Game(layout, face_down, reveal, scoring)
    rng = rng or random
    while g.occupied:
        pl = g.to_move()
        if agents[pl] == "random":
            g.apply(rng.choice(legal_moves(g.occupied, g.ref)))
        else:
            g.apply(pimc_move(g, pl, max_worlds, rng))
    return g.result()


def run(n=10, reveal=True, n_face_down=4, seed=0, max_worlds=24, verbose=True,
        agents=("pimc", "pimc"), scoring=Scoring()):
    rng = random.Random(seed)
    margins = []
    for i in range(n):
        lay = random_layout(rng)
        fd = rng.sample(range(16), n_face_down)
        m = play_deal(lay, fd, reveal, scoring=scoring, max_worlds=max_worlds,
                      rng=rng, agents=agents)
        margins.append(m)
        if verbose:
            print(f"  deal {i+1}/{n}: margin {m:+d}", flush=True)
    return margins


def report(margins, label):
    n = len(margins)
    w = sum(1 for m in margins if m > 0)
    d = sum(1 for m in margins if m == 0)
    l = sum(1 for m in margins if m < 0)
    print(f"\n{label}  ({n} deals)")
    print(f"  P1 wins {w:3d} ({w/n:.0%})   draws {d:3d} ({d/n:.0%})   "
          f"P2 wins {l:3d} ({l/n:.0%})")
    print(f"  mean margin {sum(margins)/n:+.2f}   "
          f"range {min(margins)} to {max(margins)}")
    print("  " + "  ".join(f"{m:+d}:{c}" for m, c in sorted(Counter(margins).items())))


if __name__ == "__main__":
    import sys
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    fd = int(sys.argv[2]) if len(sys.argv) > 2 else 4
    mode = sys.argv[3] if len(sys.argv) > 3 else "both"

    if mode in ("both", "asym"):
        report(run(n, reveal=True, n_face_down=fd),
               f"ASYMMETRIC — claimer sees, opponent doesn't ({fd} face down)")
    if mode in ("both", "sym"):
        report(run(n, reveal=False, n_face_down=fd),
               f"SYMMETRIC — nobody sees until scoring ({fd} face down)")
