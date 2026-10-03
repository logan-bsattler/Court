/**
 * Cards are ints 0..15: card = rank * 4 + suit.
 *   rank: 0=Jack 1=Queen 2=King 3=Ace
 *   suit: 0=spades 1=hearts 2=diamonds 3=clubs
 *
 * This matches reference/court.py exactly so masks can be compared directly.
 *
 * Two bitmask spaces are used and must not be confused:
 *   - hand masks are indexed by CARD id
 *   - occupancy / position masks are indexed by GRID POSITION (row * 4 + col)
 */

export type Card = number;
export type Pos = number;

export const JACK = 0;
export const QUEEN = 1;
export const KING = 2;
export const ACE = 3;

export const RANK_LETTERS = "JQKA";
export const SUIT_LETTERS = "shdc";
export const SUIT_SYMBOLS = ["♠", "♥", "♦", "♣"];
export const RANK_NAMES = ["Jack", "Queen", "King", "Ace"];
export const SUIT_NAMES = ["Spades", "Hearts", "Diamonds", "Clubs"];

export const card = (rank: number, suit: number): Card => rank * 4 + suit;
export const rankOf = (c: Card): number => c >> 2;
export const suitOf = (c: Card): number => c & 3;
export const isRed = (c: Card): boolean => suitOf(c) === 1 || suitOf(c) === 2;

/** Short ASCII name, e.g. "Ks" — same format as court.py. */
export const cardName = (c: Card): string => RANK_LETTERS[rankOf(c)] + SUIT_LETTERS[suitOf(c)];

/** Display name, e.g. "K♠". */
export const cardLabel = (c: Card): string => RANK_LETTERS[rankOf(c)] + SUIT_SYMBOLS[suitOf(c)];

/** Parse "Ks" / "K♠" style names. */
export function parseCard(name: string): Card {
  const r = RANK_LETTERS.indexOf(name[0].toUpperCase());
  let s = SUIT_LETTERS.indexOf(name.slice(1).toLowerCase());
  if (s < 0) s = SUIT_SYMBOLS.indexOf(name.slice(1));
  if (r < 0 || s < 0) throw new Error(`bad card name: ${name}`);
  return card(r, s);
}

export function popcount(x: number): number {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

/** Bits set in a mask, ascending. */
export function bits(mask: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 16; i++) if ((mask >> i) & 1) out.push(i);
  return out;
}

export const handMask = (cards: Iterable<Card>): number => {
  let m = 0;
  for (const c of cards) m |= 1 << c;
  return m;
};

export const handFromNames = (names: string): number =>
  handMask(names.trim().split(/\s+/).filter(Boolean).map(parseCard));

export const handName = (mask: number): string => bits(mask).map(cardName).join(" ");

export const SUIT_MASKS = [0, 1, 2, 3].map((s) => handMask([0, 1, 2, 3].map((r) => card(r, s))));
export const RANK_MASKS = [0, 1, 2, 3].map((r) => handMask([0, 1, 2, 3].map((s) => card(r, s))));
export const MARRIAGE_MASKS = [0, 1, 2, 3].map((s) => handMask([card(KING, s), card(QUEEN, s)]));
export const SERVICE_MASKS = [0, 1, 2, 3].map((s) => handMask([card(JACK, s), card(ACE, s)]));
export const ACE_CARDS = [0, 1, 2, 3].map((s) => card(ACE, s));
export const QUEEN_CARDS = [0, 1, 2, 3].map((s) => card(QUEEN, s));
