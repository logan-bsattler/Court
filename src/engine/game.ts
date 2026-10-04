import { Card, Pos, popcount } from "./cards";
import { makeRng, shuffle } from "./rng";
import type { RulesConfig } from "./rules";
import { Allocation, allocate } from "./scoring";

export type Player = 0 | 1;

export const FULL_GRID = 0xffff;
export const ROW_MASKS = [0, 1, 2, 3].map((r) => 0xf << (r * 4));
export const COL_MASKS = [0, 1, 2, 3].map((c) => 0x1111 << c);
/** Row ∪ column of each position, as a position mask. */
export const LINE_MASKS = Array.from({ length: 16 }, (_, p) => ROW_MASKS[p >> 2] | COL_MASKS[p & 3]);

/**
 * Full game state. Holds every card, including face-down ones, so it must
 * never be handed to an AI directly — use `viewFor`.
 */
export interface GameState {
  readonly rules: RulesConfig;
  readonly seed: number;
  /** layout[pos] = card at that grid position. */
  readonly layout: readonly Card[];
  /** Position mask of cells dealt face down. Public knowledge. */
  readonly faceDown: number;
  /** Position mask of cells still holding a card. */
  readonly occupied: number;
  /** Cell vacated by the previous claim; -1 before the first claim. */
  readonly ref: Pos;
  /** Positions claimed by each player, in claim order. */
  readonly claims: readonly [readonly Pos[], readonly Pos[]];
  /** Card-id masks of each player's holdings. */
  readonly hands: readonly [number, number];
  /** Position masks of cells whose card each player has seen. */
  readonly known: readonly [number, number];
}

/**
 * What one player is allowed to know. Cards they have not seen are `null`;
 * `unseen` lists the cards that could be in those cells, in sorted order so
 * it reveals nothing about placement.
 */
export interface PlayerView {
  readonly player: Player;
  readonly toMove: Player;
  readonly rules: RulesConfig;
  readonly faceDown: number;
  readonly occupied: number;
  readonly ref: Pos;
  readonly claims: readonly [readonly Pos[], readonly Pos[]];
  /** cells[pos] = card if this player has seen it, else null. Covers claimed cells too. */
  readonly cells: readonly (Card | null)[];
  readonly unseen: readonly Card[];
}

/** Deal a new game. The same seed and rules always give the same deal. */
export function deal(seed: number, rules: RulesConfig): GameState {
  const rng = makeRng(seed);
  const layout = shuffle(Array.from({ length: 16 }, (_, i) => i), rng);
  const positions = shuffle(Array.from({ length: 16 }, (_, i) => i), rng);
  let faceDown = 0;
  for (const p of positions.slice(0, Math.max(0, Math.min(16, rules.faceDown)))) faceDown |= 1 << p;
  const visible = FULL_GRID & ~faceDown;
  return {
    rules, seed, layout, faceDown,
    occupied: FULL_GRID, ref: -1,
    claims: [[], []], hands: [0, 0], known: [visible, visible],
  };
}

/** Build a state from an explicit layout (tests, tutorial). */
export function fromLayout(layout: readonly Card[], faceDown: number, rules: RulesConfig): GameState {
  const visible = FULL_GRID & ~faceDown;
  return {
    rules, seed: 0, layout: [...layout], faceDown,
    occupied: FULL_GRID, ref: -1,
    claims: [[], []], hands: [0, 0], known: [visible, visible],
  };
}

export const playerToMove = (occupied: number): Player => ((16 - popcount(occupied)) % 2) as Player;
export const toMove = (s: { occupied: number }): Player => playerToMove(s.occupied);
export const isOver = (s: { occupied: number }): boolean => s.occupied === 0;

/** Position mask of legal claims. Rule 3.3: an empty row and column lifts the constraint. */
export function legalMask(occupied: number, ref: Pos): number {
  if (ref < 0) return occupied;
  const reach = occupied & LINE_MASKS[ref];
  return reach === 0 ? occupied : reach;
}

export function legalClaims(s: { occupied: number; ref: Pos }): Pos[] {
  const m = legalMask(s.occupied, s.ref);
  const out: Pos[] = [];
  for (let p = 0; p < 16; p++) if ((m >> p) & 1) out.push(p);
  return out;
}

/** True when the current claim is a Free Claim triggered by an empty row and column (not the opening claim). */
export function isFreeClaim(s: { occupied: number; ref: Pos }): boolean {
  return s.ref >= 0 && s.occupied !== 0 && (s.occupied & LINE_MASKS[s.ref]) === 0;
}

export function applyClaim(s: GameState, pos: Pos): GameState {
  if (!((legalMask(s.occupied, s.ref) >> pos) & 1)) {
    throw new Error(`illegal claim at position ${pos}`);
  }
  const pl = toMove(s);
  const claims: [Pos[], Pos[]] = [[...s.claims[0]], [...s.claims[1]]];
  claims[pl].push(pos);
  const hands: [number, number] = [s.hands[0], s.hands[1]];
  hands[pl] |= 1 << s.layout[pos];
  const known: [number, number] = [s.known[0], s.known[1]];
  known[pl] |= 1 << pos; // the claimer sees what they took; the opponent does not
  return { ...s, occupied: s.occupied & ~(1 << pos), ref: pos, claims, hands, known };
}

export function viewFor(s: GameState, player: Player): PlayerView {
  const known = s.known[player];
  const cells: (Card | null)[] = [];
  const unseen: Card[] = [];
  for (let p = 0; p < 16; p++) {
    if ((known >> p) & 1) cells.push(s.layout[p]);
    else {
      cells.push(null);
      unseen.push(s.layout[p]);
    }
  }
  unseen.sort((a, b) => a - b);
  return {
    player, toMove: toMove(s), rules: s.rules, faceDown: s.faceDown,
    occupied: s.occupied, ref: s.ref,
    claims: [[...s.claims[0]], [...s.claims[1]]],
    cells, unseen,
  };
}

export interface DealResult {
  scores: [number, number];
  allocations: [Allocation, Allocation];
  /** Player 1 score minus player 2 score. */
  margin: number;
  /** Final hands (card-id masks), for match tiebreaks. */
  hands: [number, number];
}

export function result(s: GameState): DealResult {
  const a0 = allocate(s.hands[0], s.hands[1], s.rules);
  const a1 = allocate(s.hands[1], s.hands[0], s.rules);
  return { scores: [a0.total, a1.total], allocations: [a0, a1], margin: a0.total - a1.total, hands: [s.hands[0], s.hands[1]] };
}
