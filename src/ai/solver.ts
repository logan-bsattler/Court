import { ACE, Card, KING, QUEEN, rankOf } from "../engine/cards";
import { legalMask, playerToMove } from "../engine/game";
import type { RulesConfig } from "../engine/rules";
import { score } from "../engine/scoring";

/**
 * Exact solver for one fully known layout (a "world"). Ported from solve.py:
 * negamax with alpha-beta over the margin, transposition table keyed on
 * (occupied, player-1 hand, reference cell). Player 2's hand is implied by
 * the layout and the other two, and the side to move by the parity of
 * cards remaining.
 */

const EXACT = 0, LOWER = 1, UPPER = 2;
const INF = 999;

/** Try the politically important cards first: far more alpha-beta cutoffs. */
const orderHint = (c: Card): number => {
  const r = rankOf(c);
  return r === ACE ? 4 : r === KING || r === QUEEN ? 3 : 1;
};

export class Solver {
  nodes = 0;
  private readonly tt = new Map<number, number>();
  private readonly order: number[];

  constructor(private readonly layout: readonly Card[], private readonly rules: RulesConfig) {
    this.order = Array.from({ length: 16 }, (_, p) => p).sort(
      (a, b) => orderHint(layout[b]) - orderHint(layout[a]) || a - b,
    );
  }

  /**
   * Value of the position for the side to move (their score minus the
   * other's) under perfect play by both.
   */
  negamax(occupied: number, p1: number, p2: number, ref: number, alpha = -INF, beta = INF): number {
    if (occupied === 0) {
      // zero cards left is "player 1 to move", so return player 1's margin
      return score(p1, p2, this.rules) - score(p2, p1, this.rules);
    }
    this.nodes++;
    const key = occupied * 2097152 + p1 * 32 + (ref + 1);
    const hit = this.tt.get(key);
    if (hit !== undefined) {
      const flag = hit & 3;
      const val = (hit >> 2) - INF;
      if (flag === EXACT) return val;
      if (flag === LOWER && val > alpha) alpha = val;
      else if (flag === UPPER && val < beta) beta = val;
      if (alpha >= beta) return val;
    }

    const p1ToMove = playerToMove(occupied) === 0;
    const legal = legalMask(occupied, ref);
    const alpha0 = alpha;
    let best = -INF;
    for (let i = 0; i < 16; i++) {
      const p = this.order[i];
      if (!((legal >> p) & 1)) continue;
      const bit = 1 << this.layout[p];
      const v = p1ToMove
        ? -this.negamax(occupied & ~(1 << p), p1 | bit, p2, p, -beta, -alpha)
        : -this.negamax(occupied & ~(1 << p), p1, p2 | bit, p, -beta, -alpha);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    const flag = best <= alpha0 ? UPPER : best >= beta ? LOWER : EXACT;
    this.tt.set(key, ((best + INF) << 2) | flag);
    return best;
  }

  /** Value of claiming `pos` from the given position, for the player making the claim. */
  moveValue(occupied: number, p1: number, p2: number, pos: number): number {
    const bit = 1 << this.layout[pos];
    const p1ToMove = playerToMove(occupied) === 0;
    return p1ToMove
      ? -this.negamax(occupied & ~(1 << pos), p1 | bit, p2, pos)
      : -this.negamax(occupied & ~(1 << pos), p1, p2 | bit, pos);
  }

  /** Player 1's margin from the start of the game under perfect play. */
  solve(): number {
    return this.negamax(0xffff, 0, 0, -1);
  }
}
