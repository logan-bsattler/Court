# Court — Phase 3 engine results

*October 2026. Engine side of the Phase 3 gate in `court-mobile-plan.md`.
Human playtesting so far: "everything felt balanced".*

## Setup

- **Self-play batches:** 7 rule configs × 400 deals. Every config plays the
  same seeded deals, and face-down cells are nested (the 6-card set contains
  the 4-card set), so configs are compared deal by deal.
- **Agent:** the app's determinized AI on both seats, 8 sampled worlds per
  decision, best move, random tie-break. This is the setup of the August Python
  runs (`max_worlds=8`).
- **Skill test:** that agent against the app's easy level, 200 deals per
  face-down count, seats alternating.
- **Reproduce:** `scripts/experiments.ts`, `scripts/skill.ts`, `scripts/report.ts`.
  Raw records are in `experiments/`. Full tables, with confidence intervals and
  paired bootstrap differences, are in `experiments/summary.md`.

## 1. The hidden-card rule is what makes the game work

| Face-down | P1 wins | Draws | P2 wins | Margin SD |
|---|---|---|---|---|
| 0 (all face up) | 1.0% | **99.0%** | 0.0% | 0.20 |
| 4 (current) | 24.8% | 61.0% | 14.2% | 2.42 |

This confirms the August result at 33× the sample size. With both counters on,
the full-information game is a draw.

## 2. Both counters are required, but for seat balance, not spread

| Counters | P1 wins | Draws | P2 wins | Margin SD |
|---|---|---|---|---|
| Both (current) | 24.8% | 61.0% | 14.2% | 2.42 |
| No Service counter | 45.3% | 48.3% | 6.5% | 1.95 |
| No Deposition | 47.8% | 45.0% | 7.2% | 2.14 |
| Neither | 23.0% | 66.3% | 10.8% | 1.49 |

Removing either counter on its own roughly doubles player 1's win rate. The
paired 95% intervals are +14 to +27 points for player 1, so this is not noise.
Removing both restores the seat balance but gives the drawiest, narrowest game
of the four.

The August claim was that removing either counter collapses the margin range.
That held only weakly here: removing deposition alone actually *raised* the
share of 4+ point margins. The decision stands, but its real basis is that the
two counters offset each other's first-player bias.

**Keep both counters.** This was the least certain rule; it is now the
best-supported one.

## 3. The first-player lean is modest, and the two-deal match absorbs it

Current rules: P1 wins 24.8% of deals, P2 14.2%, mean margin +0.39. Among
decided deals, player 1 wins 64%. The two-deal seat-swapped match already in
the app is enough. **Reprieve is not needed.**

## 4. More face-down cards: more decisive, less skill

Self-play (same agent on both seats):

| Face-down | Deal draws | Match draws | Margin SD | P1 share of decided deals |
|---|---|---|---|---|
| 4 | 61.0% | 37.5% | 2.42 | 64% |
| 6 | 50.2% | 31.0% | 3.02 | 63% |
| 8 | 39.0% | 20.0% | 3.74 | 62% |

Skill test (strong agent vs the easy level):

| Face-down | Strong's mean margin | Deals W/D/L | Two-deal matches W/D/L |
|---|---|---|---|
| 0 | +2.07 ± 0.27 | 128 / 72 / 0 | 89 / 11 / 0 |
| 4 | +2.67 ± 0.40 | 130 / 64 / 6 | **85 / 13 / 2** |
| 6 | +2.30 ± 0.53 | 106 / 70 / 24 | 71 / 19 / 10 |
| 8 | +1.86 ± 0.52 | 104 / 67 / 29 | 69 / 13 / 18 |

The better player's average edge in points barely moves. The noise around it
grows, though, so the weaker player wins more often:

| Face-down | Weaker player wins (matches) |
|---|---|
| 4 | 2% |
| 6 | 10% |
| 8 | 18% |

Fewer drawn matches at 6 or 8 are mostly bought with upsets, not with more
decisions that skill settles.

**Keep 4.** It gives the best skill signal of any count that is not dead. If
drawn matches turn out to bother people, add a tiebreak (open decision 5)
before adding hidden cards. A 6-card "wilder" mode is a reasonable optional
variant: it stays clearly skill-dominated.

## 5. Full Court and Coup are still inert

Per hand, at every face-down count:

| Combination | Times scored per hand |
|---|---|
| Full Court | 0.10–0.13 |
| Coup | 0.10–0.13 |
| Marriage (scoring) | 0.21–0.24 |
| Service (scoring) | 0.23–0.25 |
| A counter firing (each kind) | about 0.5 |

The August hope that hidden information would make four-card sets reachable
did not hold. Hands are decided by Marriages, Services and the counters, so
the 12-point values are still close to irrelevant. This is not a balance
problem, but it is a design question. If the four-card sets should matter,
changing their values will not do it (August sweep); changing their
reachability might. That needs a new rule idea, not a parameter change.

## Recommendation for the gate

**Proceed.** The current ruleset — both counters, 4 face-down, two-deal
matches — is the best-supported configuration tested, and it matches what the
first human playtests reported. No rule changes are needed before Phase 4.

Open items, none of which block Phase 4:

1. **Match tiebreak (open decision 5).** About 37% of matches between equal
   players draw. Worth testing "most combinations scored" in human play.
2. **Four-card sets.** They are inert; this is a design question for later, not
   a blocker.
3. **Caveats.** Every result here comes from agents that never bluff, and the
   skill test's "weak player" is the easy AI, not a human. Human play is still
   the deciding evidence, and the plan's 20-match playtest should continue.
