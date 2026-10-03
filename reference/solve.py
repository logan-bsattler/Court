"""COURT — exact solver.

The game is two-player, zero-sum in margin, with complete information and
16 plies, so it can be solved outright rather than sampled.  negamax with
alpha-beta over the margin (player-to-move's score minus opponent's),
with a transposition table keyed on (occupied, p1_hand, reference cell).

Turn is not part of the key: it is determined by the parity of the number
of cards still on the grid.
"""

from court import (
    Scoring, score, legal_moves, FULL_GRID, rank_of, ACE, KING, QUEEN,
)

# static move-ordering hint: try the politically important cards first,
# which makes alpha-beta cut far more often
ORDER_HINT = [0] * 16
for _c in range(16):
    _r = rank_of(_c)
    ORDER_HINT[_c] = {ACE: 4, KING: 3, QUEEN: 3}.get(_r, 1)

EXACT, LOWER, UPPER = 0, 1, 2


class Solver:
    def __init__(self, layout, scoring=Scoring()):
        self.layout = layout
        self.sc = scoring
        self.tt = {}
        self.nodes = 0

    def solve(self):
        """Returns (margin for player 1 under perfect play, principal variation)."""
        value = self._negamax(FULL_GRID, 0, 0, -1, -999, 999)
        return value, self._pv()

    def _negamax(self, occupied, p1, p2, ref, alpha, beta):
        if occupied == 0:
            margin = score(p1, p2, self.sc) - score(p2, p1, self.sc)
            # popcount(occupied)==0 is even -> player 1 would be to move
            return margin

        self.nodes += 1
        key = (occupied, p1, ref)
        hit = self.tt.get(key)
        if hit is not None:
            val, flag = hit
            if flag == EXACT:
                return val
            if flag == LOWER and val > alpha:
                alpha = val
            elif flag == UPPER and val < beta:
                beta = val
            if alpha >= beta:
                return val

        # parity of remaining cards gives the side to move: 16 remaining -> p1
        p1_to_move = (bin(occupied).count("1") % 2) == 0

        moves = legal_moves(occupied, ref)
        moves = sorted(moves, key=lambda p: -ORDER_HINT[self.layout[p]])

        alpha0 = alpha
        best = -999
        for p in moves:
            c = self.layout[p]
            if p1_to_move:
                v = -self._negamax(occupied ^ (1 << p), p1 | (1 << c), p2, p,
                                   -beta, -alpha)
            else:
                v = -self._negamax(occupied ^ (1 << p), p1, p2 | (1 << c), p,
                                   -beta, -alpha)
            if v > best:
                best = v
            if best > alpha:
                alpha = best
            if alpha >= beta:
                break

        if best <= alpha0:
            flag = UPPER
        elif best >= beta:
            flag = LOWER
        else:
            flag = EXACT
        self.tt[key] = (best, flag)
        return best

    def _pv(self):
        """Walk the solved tree taking a best move at each step."""
        occupied, p1, p2, ref = FULL_GRID, 0, 0, -1
        line = []
        while occupied:
            p1_to_move = (bin(occupied).count("1") % 2) == 0
            best_p, best_v = None, -999
            for p in legal_moves(occupied, ref):
                c = self.layout[p]
                if p1_to_move:
                    v = -self._negamax(occupied ^ (1 << p), p1 | (1 << c), p2, p,
                                       -999, 999)
                else:
                    v = -self._negamax(occupied ^ (1 << p), p1, p2 | (1 << c), p,
                                       -999, 999)
                if v > best_v:
                    best_v, best_p = v, p
            line.append((1 if p1_to_move else 2, best_p, self.layout[best_p]))
            c = self.layout[best_p]
            if p1_to_move:
                p1 |= 1 << c
            else:
                p2 |= 1 << c
            occupied ^= 1 << best_p
            ref = best_p
        return line, p1, p2
