"""COURT — engine.

Cards are ints 0..15.  card = rank * 4 + suit.
  rank: 0=Jack 1=Queen 2=King 3=Ace
  suit: 0=spades 1=hearts 2=diamonds 3=clubs

A layout is a tuple of 16 card ids; index = grid position, row = pos // 4,
col = pos % 4.

Hands and grid occupancy are bitmasks.  Note the two mask spaces are
different: hand masks are indexed by CARD id, occupancy masks by POSITION.
"""

from dataclasses import dataclass, field
from functools import lru_cache
import random

RANKS = "JQKA"
SUITS = "shdc"
JACK, QUEEN, KING, ACE = 0, 1, 2, 3


def card(rank: int, suit: int) -> int:
    return rank * 4 + suit


def rank_of(c: int) -> int:
    return c >> 2


def suit_of(c: int) -> int:
    return c & 3


def card_name(c: int) -> str:
    return RANKS[rank_of(c)] + SUITS[suit_of(c)]


def hand_name(mask: int) -> str:
    return " ".join(card_name(c) for c in range(16) if mask >> c & 1)


# --------------------------------------------------------------------------
# scoring
# --------------------------------------------------------------------------

@dataclass(frozen=True)
class Scoring:
    """Point values.  Tweak these to answer the balance questions."""
    full_court: int = 12       # all four cards of one suit
    coup: int = 12             # all four cards of one rank
    marriage: int = 6          # King + Queen of a suit
    service: int = 4           # Jack + Ace of a suit
    retainer: int = 1          # any card in no combination
    deposed_marriage: int = 0  # marriage value when opponent holds the Ace
    triple: int = 0            # PARTIAL CREDIT: any three of a suit or rank.
                               # 0 disables it. Rejected in testing.
    countered_service: int = 0  # service value when opponent holds the Queen
                                # of that suit. 0 = counter on (current rules);
                                # set equal to `service` to disable.


def _suit_mask(s: int) -> int:
    return sum(1 << card(r, s) for r in range(4))


def _rank_mask(r: int) -> int:
    return sum(1 << card(r, s) for s in range(4))


SUIT_MASKS = [_suit_mask(s) for s in range(4)]
RANK_MASKS = [_rank_mask(r) for r in range(4)]
MARRIAGE_MASKS = [(1 << card(KING, s)) | (1 << card(QUEEN, s)) for s in range(4)]
SERVICE_MASKS = [(1 << card(JACK, s)) | (1 << card(ACE, s)) for s in range(4)]
ACE_CARDS = [card(ACE, s) for s in range(4)]
QUEEN_CARDS = [card(QUEEN, s) for s in range(4)]

# every three-card subset of a suit, and of a rank, for partial credit
TRIPLES = []
for _s in range(4):
    for _drop in range(4):
        _m = SUIT_MASKS[_s] & ~(1 << card(_drop, _s))
        TRIPLES.append((_m, f"Triple {SUITS[_s]}"))
for _r in range(4):
    for _drop in range(4):
        _m = RANK_MASKS[_r] & ~(1 << card(_r, _drop))
        TRIPLES.append((_m, f"Triple {RANKS[_r]}"))


def _popcount(x: int) -> int:
    return bin(x).count("1")


ACE_MASK = sum(1 << c for c in ACE_CARDS)
QUEEN_MASK = sum(1 << c for c in QUEEN_CARDS)
RELEVANT_MASK = ACE_MASK | QUEEN_MASK


def score(hand: int, opponent: int, sc: Scoring = Scoring()) -> int:
    """Best legal allocation of `hand` into combinations.

    Every card counts exactly once, so this is a weighted exact-cover
    maximisation.  Baseline is retainer value for all cards; each combination
    is then worth its *gain* over the retainers it consumes.  A combination
    with a non-positive gain is never worth taking, which is exactly how a
    deposed marriage falls back to two retainers.

    Only the opponent's Aces can affect the result (via deposition), so the
    cache key discards the rest of their hand.
    """
    return _score(hand, opponent & RELEVANT_MASK, sc)


@lru_cache(maxsize=None)
def _score(hand: int, opponent: int, sc: Scoring) -> int:
    combos = []  # (mask, gain)

    for s in range(4):
        if hand & SUIT_MASKS[s] == SUIT_MASKS[s]:
            combos.append((SUIT_MASKS[s], sc.full_court - 4 * sc.retainer))
    for r in range(4):
        if hand & RANK_MASKS[r] == RANK_MASKS[r]:
            combos.append((RANK_MASKS[r], sc.coup - 4 * sc.retainer))
    for s in range(4):
        if hand & MARRIAGE_MASKS[s] == MARRIAGE_MASKS[s]:
            # deposition: opponent holding the Ace of this suit voids it
            deposed = opponent >> ACE_CARDS[s] & 1
            value = sc.deposed_marriage if deposed else sc.marriage
            combos.append((MARRIAGE_MASKS[s], value - 2 * sc.retainer))
    for s in range(4):
        if hand & SERVICE_MASKS[s] == SERVICE_MASKS[s]:
            countered = opponent >> QUEEN_CARDS[s] & 1
            value = sc.countered_service if countered else sc.service
            combos.append((SERVICE_MASKS[s], value - 2 * sc.retainer))

    if sc.triple > 0:
        for m, _label in TRIPLES:
            if hand & m == m:
                combos.append((m, sc.triple - 3 * sc.retainer))

    combos = [c for c in combos if c[1] > 0]

    best_gain = _best_cover(tuple(combos), 0)
    return _popcount(hand) * sc.retainer + best_gain


@lru_cache(maxsize=None)
def _best_cover(combos: tuple, used: int) -> int:
    """Max total gain from a card-disjoint subset of `combos`."""
    if not combos:
        return 0
    (mask, gain), rest = combos[0], combos[1:]
    skip = _best_cover(rest, used)
    if mask & used:
        return skip
    return max(skip, gain + _best_cover(rest, used | mask))


def allocate(hand: int, opponent: int, sc: Scoring = Scoring()):
    """Returns (total, [(label, value), ...]) for the optimal allocation.

    Ties are broken arbitrarily but deterministically; when two allocations
    score the same the first found is reported.
    """
    target = score(hand, opponent, sc)
    combos = []
    for s in range(4):
        if hand & SUIT_MASKS[s] == SUIT_MASKS[s]:
            combos.append((SUIT_MASKS[s], sc.full_court, f"Full Court {SUITS[s]}"))
    for r in range(4):
        if hand & RANK_MASKS[r] == RANK_MASKS[r]:
            combos.append((RANK_MASKS[r], sc.coup, f"Coup {RANKS[r]}"))
    for s in range(4):
        if hand & MARRIAGE_MASKS[s] == MARRIAGE_MASKS[s]:
            deposed = opponent >> ACE_CARDS[s] & 1
            v = sc.deposed_marriage if deposed else sc.marriage
            tag = f"Marriage {SUITS[s]}" + (" (DEPOSED)" if deposed else "")
            combos.append((MARRIAGE_MASKS[s], v, tag))
    for s in range(4):
        if hand & SERVICE_MASKS[s] == SERVICE_MASKS[s]:
            countered = opponent >> QUEEN_CARDS[s] & 1
            v = sc.countered_service if countered else sc.service
            tag = f"Service {SUITS[s]}" + (" (COUNTERED)" if countered else "")
            combos.append((SERVICE_MASKS[s], v, tag))
    if sc.triple > 0:
        for m, label in TRIPLES:
            if hand & m == m:
                combos.append((m, sc.triple, label))

    chosen, used = [], 0
    # exhaustive: pick the subset matching the optimum
    def rec(i, used, acc, picked):
        if i == len(combos):
            total = acc + _popcount(hand & ~used) * sc.retainer
            return (total, picked) if total == target else None
        m, v, t = combos[i]
        if not (m & used) and v - _popcount(m) * sc.retainer > 0:
            r = rec(i + 1, used | m, acc + v, picked + [(t, v)])
            if r:
                return r
        return rec(i + 1, used, acc, picked)

    result = rec(0, 0, 0, [])
    chosen, used = [], 0
    if result:
        _, chosen = result
        for t, v in chosen:
            for m, vv, tt in combos:
                if tt == t:
                    used |= m
                    break

    leftover = _popcount(hand & ~used)
    if leftover:
        chosen = chosen + [(f"Retainers x{leftover}", leftover * sc.retainer)]
    return target, chosen


def explain(hand: int, opponent: int, sc: Scoring = Scoring()) -> str:
    total, chosen = allocate(hand, opponent, sc)
    lines = [f"  {t}: {v}" for t, v in chosen]
    lines.append(f"  TOTAL: {total}")
    return "\n".join(lines)


# --------------------------------------------------------------------------
# layout and movement
# --------------------------------------------------------------------------

def random_layout(rng: random.Random) -> tuple:
    cards = list(range(16))
    rng.shuffle(cards)
    return tuple(cards)


ROW_MASKS = [sum(1 << p for p in range(16) if p // 4 == r) for r in range(4)]
COL_MASKS = [sum(1 << p for p in range(16) if p % 4 == c) for c in range(4)]
LINE_MASK = [ROW_MASKS[p // 4] | COL_MASKS[p % 4] for p in range(16)]

FULL_GRID = (1 << 16) - 1


def legal_moves(occupied: int, ref: int) -> tuple:
    """Positions claimable. ref = -1 for a free claim (first turn).

    Rule 3.3: if the reference cell's row and column are both empty of cards,
    the constraint lifts and any card may be claimed.
    """
    if ref < 0:
        reachable = occupied
    else:
        reachable = occupied & LINE_MASK[ref]
        if reachable == 0:
            reachable = occupied
    return tuple(p for p in range(16) if reachable >> p & 1)


def render(layout: tuple, occupied: int, ref: int = -1) -> str:
    out = []
    for r in range(4):
        cells = []
        for c in range(4):
            p = r * 4 + c
            if occupied >> p & 1:
                cells.append(card_name(layout[p]))
            else:
                cells.append(" ." if p != ref else " *")
        out.append(" ".join(f"{x:>2}" for x in cells))
    return "\n".join(out)
