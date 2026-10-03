# COURT
### A 16-card drafting game for 2 players
*Working title. Design spec v0.1 — August 2026*

---

## 1. Overview

**Players:** 2
**Playing time:** 10–15 minutes
**Components:** 16 cards — Ace, King, Queen, Jack in each of four suits

Court is a spatial draft with a set-collection payoff. All sixteen cards are dealt face-up into a 4×4 grid. Players alternate claiming cards, but each claim is constrained to the row or column vacated by the previous claim. You are therefore never choosing only *which card do I want* — you are choosing *which two lines of the grid do I hand my opponent*.

The deck is a 4×4 matrix in its own right (four ranks × four suits), and the scoring rewards completing lines through that matrix: all four of a suit, all four of a rank, or the smaller royal pairings inside a suit. The physical grid and the conceptual grid are deliberately not aligned — the layout is shuffled, so the shape you want in your hand has no relationship to the shape you can reach on the table.

**Design intent:** a game where every card is contested for two incompatible reasons, and where denial is frequently better play than acquisition.

---

## 2. Setup

1. Shuffle all 16 cards.
2. Deal them face-up into a 4×4 grid, filling left to right, top to bottom. Leave a little space between cards — the empty cells matter.
3. Determine a first player. See **§6.1 Reprieve** for the compensation rule.

There are no hidden components. Court is a game of complete information; the only thing either player does not know is what the other intends to do with it.

---

## 3. Turn structure

### 3.1 The first claim
The first player takes **any card** from the grid. The cell it occupied is now empty.

### 3.2 Subsequent claims
On your turn, you must take a card that lies in the **same row or the same column as the cell vacated by the previous claim**.

- The vacated cell is the reference point, not the card. Cards are never moved or slid.
- Rows and columns do not wrap around the edge of the grid.
- Empty cells between you and a target card do not block it. Any card in the line is reachable.

### 3.3 Free claim
If **no cards remain in either the row or the column** of the previously vacated cell, the constraint is lifted and you may take any card in the grid. Your claim then sets the new reference cell as normal.

### 3.4 No passing
You must claim a card if any legal claim exists. Combined with §3.3, a legal claim always exists while cards remain.

### 3.5 Cards taken
Place claimed cards face-up in front of you. Both players' holdings are public at all times.

### 3.6 End of the game
The game ends when the grid is empty. Each player holds exactly eight cards. Proceed to scoring.

---

## 4. Scoring

### 4.1 Allocation
At the end of the game, each player allocates their eight cards into scoring combinations. **A card may only count once.** You choose the allocation that scores best; a card that goes into a Coup cannot also serve a Marriage.

### 4.2 Combinations

| Combination | Definition | Cards | Value |
|---|---|---|---|
| **Full Court** | All four cards of one suit | 4 | 12 |
| **Coup** | All four cards of one rank | 4 | 12 |
| **Marriage** | King + Queen of the same suit | 2 | 6 |
| **Service** | Jack + Ace of the same suit | 2 | 4 |
| **Retainer** | Any card not in a combination above | 1 | 1 |

Full Court and Coup are deliberately equal. Both consume four cards for twelve points, so the two routes through the matrix — down a suit, across a rank — are worth the same, and the choice between them is made on what the grid will actually let you reach rather than on arithmetic.

### 4.3 Deposition
**A Marriage does not score if your opponent holds the Ace of that suit.** It is worth zero, and its King and Queen become Retainers (1 each).

Deposition is a check applied at scoring, not a combination. An Ace that is already committed to a Service or a Coup still deposes — the Ace does its political work regardless of what else it is doing.

Deposition does not affect a Full Court, since a Full Court contains its own Ace by definition.

### 4.4 Worked example

Player A holds: ♠K ♠Q ♠J ♠A ♥K ♥Q ♦K ♣J

- ♠K ♠Q ♠J ♠A → **Full Court** (12)
- ♥K ♥Q → **Marriage**. Player B holds ♥A, so this is **deposed** (0), and both cards become Retainers (2)
- ♦K → Retainer (1)
- ♣J → Retainer (1)

**Total: 16.**

Note what Player A got wrong: they secured the spades they already controlled and then chased a heart Marriage without ever contesting ♥A. Three Kings sitting in a hand is not a position, it is an unconverted one — ♦K and ♣J are doing nothing. Had they taken ♥A over ♠J, the spade Full Court collapses to a Marriage + Retainer (7) but the heart Marriage stands (6) and the ♥A joins nothing — 7 + 6 + 1 + 1 + 1 = 16. Identical. That symmetry is intentional and should be verified in playtesting; if the two lines are always equal the decision is hollow.

---

## 5. Strategy notes

**Denial is often correct.** Taking a King you cannot marry costs your opponent six points and gains you one. Because the row/column constraint limits reach, the moment when a card is takeable may not come around again.

**The Aces are the tempo cards.** Every Ace does three jobs: it completes a Full Court, it pairs into a Service, and it deposes an enemy Marriage. An Ace claimed early is rarely wasted.

**Watch the line you leave.** The strongest claims are ones where the vacated cell's row and column contain nothing your opponent wants. Late in the game, engineering a **Free Claim** (§3.3) for yourself — or avoiding giving one away — is usually the whole decision.

**The Jacks are the weak cards, by design.** They are the currency of the consolation game. See §7.

---

## 6. Variants and open rules

### 6.1 Reprieve *(recommended, needs testing)*
The second player receives one **Reprieve** per game: once, they may ignore the row/column constraint and claim any card. This compensates for first-player advantage, which is real but unmeasured. Alternative if Reprieve overcorrects: the second player claims the final two cards consecutively.

### 6.2 The Twelve *(recommended for a shorter, sharper game)*
During setup, deal four cards face-down into the grid instead of face-up. They are claimed normally but not revealed until the end. Each player ends with eight cards, of which up to four are unknown until scoring. This addresses the endgame flatness described in §7.

### 6.3 Three players
Deal 15 cards into a 4×4 grid with one cell left empty; the empty cell is the starting reference for the first claim, which is therefore constrained rather than free. Each player takes five cards. Untested and likely worse than the two-player game — Court's tension depends on knowing exactly who benefits from what you leave behind.

---

## 7. Known problems

**The endgame is forced.** The last claim of the game is never a decision — one card remains, and §3.3 guarantees it is takeable. The second-to-last is usually near-forced too. Roughly the final quarter of the game is bookkeeping. Variant 6.2 hides the consequences rather than fixing the structure; a real fix might be ending the game with two cards still on the table.

**The Jacks are close to chaff.** A Jack is worth 1 unpaired and 4 in Service, and it cannot depose anything. A quarter of the deck may be functionally inert. Two candidate fixes, neither tested:
- *Regency* — a Jack may substitute for the King of its own suit in a Marriage, scoring 3 instead of 6.
- *Sedition* — an unpaired Jack scores 0, but three or more Jacks score 8 as a Coup-like set, making them a genuine alternative line.

**Full Court's premium is thin.** A Full Court (12) contains a Marriage (6) and a Service (4). Chasing all four of a suit therefore earns only two points over the pieces, for considerably more risk. It may need to be 14 or 15 — but raising it also makes the deliberate symmetry with Coup (§4.2) disappear, so this is a real trade rather than a fix.

**Deposition may be too punishing.** Losing six points to a card you never had a chance to reach is a bad feeling if the grid geometry, rather than any decision, is what put the Ace out of reach. Watch for games decided by a single unreachable Ace. A softer version: a deposed Marriage scores 2 rather than 0.

---

## 8. First playtest questions

1. Does the first player win substantially more than half the time, with and without Reprieve?
2. How many turns pass before the outcome is determined? If it is turn 10 of 16, the endgame problem is the priority.
3. Do players ever choose Coup over Full Court, or is the suit route always more reachable given the geometry?
4. Are the Jacks ever claimed for their own sake, or only as denial and filler?
5. Does a game ever end with both players holding deposed Marriages? That would suggest the Aces are being systematically undervalued in play, which is a teaching problem rather than a design one.
