import { type Card, RANK_LETTERS, SUIT_SYMBOLS, isRed, rankOf, suitOf } from "../engine/cards";

/**
 * Playing-card faces drawn as inline SVG. viewBox is 100×140 (5:7).
 * Court cards get a large rank letter under a simple crown; Aces a large pip.
 */

const RED = "#c62828";
const BLACK = "#1b1b1f";

const CROWN = "M30 50 L36 34 L44 44 L50 30 L56 44 L64 34 L70 50 Z";

export function cardSvg(c: Card): string {
  const r = rankOf(c);
  const color = isRed(c) ? RED : BLACK;
  const rank = RANK_LETTERS[r];
  const suit = SUIT_SYMBOLS[suitOf(c)];
  const corner = (rot: boolean) => `
    <g ${rot ? 'transform="rotate(180 50 70)"' : ""} fill="${color}" font-family="Georgia, 'Times New Roman', serif" text-anchor="middle">
      <text x="14" y="25" font-size="22" font-weight="700">${rank}</text>
      <text x="14" y="44" font-size="18">${suit}</text>
    </g>`;
  const centre =
    r === 3
      ? `<text x="50" y="92" font-size="58" text-anchor="middle" fill="${color}">${suit}</text>`
      : `<path d="${CROWN}" fill="${color}" opacity="0.18"/>
         <text x="50" y="86" font-size="46" font-weight="700" text-anchor="middle" fill="${color}"
               font-family="Georgia, 'Times New Roman', serif">${rank}</text>
         <text x="50" y="112" font-size="22" text-anchor="middle" fill="${color}">${suit}</text>`;
  return `<svg class="card-svg" viewBox="0 0 100 140" role="img" aria-label="${rank}${suit}">
    <rect x="1.5" y="1.5" width="97" height="137" rx="9" fill="#fffdf7" stroke="#cfc8b8" stroke-width="2"/>
    ${corner(false)}${centre}${corner(true)}
  </svg>`;
}

/** Card back. Drawn in CSS (see .card-back) so many copies need no shared SVG ids. */
export function backSvg(): string {
  return `<div class="card-back" role="img" aria-label="face-down card"></div>`;
}
