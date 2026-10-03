# Court — mobile build plan

Plan for a Claude Code session. Court is a 16-card, two-player drafting game designed in August 2026. The goal is a published mobile game. This plan covers the first playable build and the path to a store release.

## Goal of this session

A playable web build of Court, one human against an AI opponent, hosted on GitHub Pages so it can be played on a phone browser.

Done means:

- A full match can be played start to finish on a phone, with correct rules and scoring.
- The rules engine has passing unit tests, including the regression cases below.
- The AI plays legal moves and beats a random player by a mean margin of at least +3 over 100 seeded deals. (The Python PIMC agent managed +4.3 at four face-down cards.)
- The build deploys to GitHub Pages from `main` through GitHub Actions.

Store packaging, monetization and polish are later phases. Do not start them in this session.

## Decisions already made

| Decision | Choice | Why |
|---|---|---|
| Ruleset | Hidden-information variant with both counters (below) | The full-information game is close to solved: across 60 exactly solved deals the second player never won and margins were only 0 or +2. Hiding four cards broke that. |
| Stack | TypeScript, Vite, plain DOM/CSS or a light canvas layer. No game engine. | Sixteen cards on a grid does not need one. Web first gives instant phone playtests, and Capacitor wraps the same build for the stores later. |
| Build | GitHub Actions only. No local Android Studio. | Matches the existing Deal Checker and Game Night workflows. |
| Opponent | AI, single device. No online play. | Online multiplayer roughly doubles the project. |
| Art | Standard playing-card faces drawn in SVG | No external art dependency for the first build. |
| Rules as config | Point values, both counters, and the face-down count live in one `RulesConfig` object, never hard-coded | The ruleset rests on 12-deal tests and will change after Phase 3. Rule changes must not touch UI or AI code. |

## Open decisions (owner: Ben)

These do not block Phase 1 or 2.

1. **Title.** "Court" is the working title. Check store and trademark collisions before Phase 4.
2. **First-player lean.** In the hidden-variant tests the second player won 1 of 12 deals. The plan's default fix is a two-deal match with seats swapped and scores summed. The alternative is the Reprieve rule (second player may once ignore the row/column constraint).
5. **Match tiebreak.** AI self-play drew about half of all deals, so summed two-deal matches will still tie often. Default for the first build: a tied match is shown as a draw. Candidate tiebreaks to try in Phase 3: most Aces held, or most combinations scored.
3. **Monetization.** Paid app, or free with a one-time unlock. Decide after the fun check in Phase 3.
4. **Platforms.** Android first is the default. iOS needs a macOS runner and a $99/year account.

## Rules to implement

### Setup

- 16 cards: Ace, King, Queen, Jack in four suits.
- Shuffle and deal into a 4×4 grid. Twelve cards are face-up. Four cells, chosen at random, are face-down. The face-down count is a config value: testing found 4 to 8 viable, while 12 or more turns the game mostly into luck.

### Turn structure

- Players alternate claiming one card. Each ends with eight.
- The first claim may be any card.
- Every later claim must come from the same row or column as the cell vacated by the previous claim.
- **Free Claim** (spec §3.3): if no cards remain in either the row or the column of the previously vacated cell, the constraint is lifted and the player may claim any card in the grid. That claim sets the new reference cell as normal. A legal claim therefore always exists while cards remain, and there is no passing.
- A face-down card can be claimed like any other. The claimer sees it. The opponent does not see it until scoring.

### Scoring

Each card counts in exactly one combination. A hand scores its best legal allocation.

| Combination | Cards | Points |
|---|---|---|
| Full Court | All four cards of one suit | 12 |
| Coup | All four cards of one rank | 12 |
| Marriage | King + Queen of one suit | 6 |
| Service | Jack + Ace of one suit | 4 |
| Retainer | Any card in no combination | 1 |

Two counters, both required:

- **Deposition:** a Marriage scores 0 if the opponent holds the Ace of that suit. Its King and Queen become Retainers.
- **Service counter:** a Service scores 0 if the opponent holds the Queen of that suit. Its Jack and Ace become Retainers.

An Ace or Queen counters even when it is already used in another combination. Neither counter affects a Full Court.

Testing showed the counters work as a pair. Removing either one collapsed the margin range from −6..+10 back to −2..+4.

### Rejected, do not implement

- Partial credit for three of a suit or rank. It raised the draw rate from 42% to 75%.
- The fully face-up game as the default mode.

## Prior work to reuse

The August chat produced `court-spec.md`, `FINDINGS.md`, and Python files `court.py`, `solve.py`, `hidden.py` and `experiments.py` (scoring, exact solver, hidden-information agents, batch experiments). Ask Ben for these at the start. If they are unavailable, this plan has enough to rebuild the engine.

- `court.py` defaults match this plan: both counters on, partial credit off.
- `court-spec.md` is out of date on scoring and on hidden cards. Its §6.2 describes the symmetric variant, where nobody sees face-down cards until scoring. Testing showed that version does not help. This plan's rules take precedence.

The Python scoring is a weighted exact-cover search over bitmasks: each combination is worth its gain over the Retainers it consumes, and the best card-disjoint subset wins. Port that approach directly.

## Phases

### Phase 1 — Rules engine (this session)

Pure TypeScript module with no UI dependencies.

- Card and grid representation (bitmasks, 16 bits per hand).
- `legalClaims(state)`, including first claim and Free Claim.
- `applyClaim(state, cell)`, tracking which player knows which face-down cards.
- `score(hand, opponentHand)` and `allocate(...)`, which returns the chosen combinations for the score screen.
- Seeded shuffle so any deal can be replayed.

Unit tests:

- Worked example from the spec. Hand ♠K ♠Q ♠J ♠A ♥K ♥Q ♦K ♣J against an opponent holding ♥A scores **16** (Full Court 12, deposed Marriage as two Retainers, two more Retainers).
- Marriage scores 6 when not deposed and 2 when deposed.
- Service scores 4 when not countered and 2 when countered.
- A counter fires even when the countering card is part of the opponent's own combination: an opponent holding ♥A inside their own ♥ Service still deposes a ♥ Marriage. (A Full Court can never be countered, since it holds its own Ace and Queen, so that case needs no test.)
- A hand with overlapping options (for example a Coup of Kings against a Marriage) takes the higher-scoring allocation.
- Legal claims follow the row/column rule and Free Claim triggers only when both lines are empty.
- Parity with the Python engine: score 1,000 random hand pairs in both and compare. `court.py` is the reference.
- Information hiding: the AI's move function receives only that player's view of the state, with unseen face-down cards absent. A test confirms the AI cannot read them.

### Phase 2 — AI opponent and playable UI (this session)

AI:

- Determinized search. Sample assignments of the cards the AI cannot see, solve each sampled world with minimax, and pick the move with the best average margin.
- The state space is small. The Python exact solver handles a full game in about 2 seconds (roughly 650,000 nodes with a transposition table), so a TypeScript port may be fast enough to search exactly from the start. Measure on a mid-range phone before adding depth-limited search. If depth limits are needed, the plan must also define an evaluation function for cut-off positions, which does not exist yet.
- Three difficulty levels by sample count and search depth. The easy level should make visible mistakes, for example by choosing randomly among moves within a few points of the best.
- Known limit: determinized agents never bluff or play to conceal, so they underuse the hidden cards. Fine for the first build. Note it for Phase 3.
- Run the AI in a Web Worker so the UI stays responsive.

UI:

- Portrait layout. The 4×4 grid fills the width, with each player's claimed cards above and below.
- Highlight the legal row and column. Dim cards that cannot be claimed.
- A face-down card the player has claimed shows its face to them only.
- Score screen that reveals hidden cards and lists each combination and each counter that fired, using `allocate`.
- Two-deal match with seats swapped, scores summed.
- A short interactive tutorial covering the claim rule, the five combinations and the two counters.

Deploy to GitHub Pages through Actions.

### Phase 3 — Fun check (gate)

Court has never been played by people. The solver work showed the hidden variant is not determined, which is not the same as fun.

- Ben plays at least 20 matches on the phone build and has a few other people try it.
- Use the engine to run large AI-vs-AI batches and report first-player win rate, draw rate and margin spread. The earlier tests were only 12 deals on one seed.
- Re-run the ablations at 200 or more deals each: counters on and off, and four, six and eight face-down cards. The "both counters required" decision rests on 12 deals and is the least certain rule in the game.
- Decide: proceed, change rules, or stop. Do not start Phase 4 until this gate passes.

### Phase 4 — Store release

- Wrap with Capacitor. Android App Bundle built and signed in Actions.
- Play Console account, listing, screenshots, privacy policy, content rating.
- Check Google's current closed-testing requirement for new personal developer accounts before planning a launch date.
- Local stats, settings, sound, haptics, daily seeded deal.
- Monetization per the open decision.
- iOS afterwards, if Android results justify it.

## Out of scope

- Online multiplayer, accounts, leaderboards.
- Three-player variant.
- Ads SDKs and analytics in the first build.
- Custom illustrated card art.
