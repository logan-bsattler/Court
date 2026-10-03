# COURT — solver findings

*Run August 2026 against spec v0.1. Every deal below is solved exactly: perfect
play by both sides, no sampling except over which deals were examined.
~2s per deal single-threaded, ~650k nodes.*

---

## The headline: the game is nearly a draw by construction

40 deals, both sides perfect:

| Result | Deals |
|---|---|
| P1 wins | 19 (47.5%) |
| Draw | 21 (52.5%) |
| **P2 wins** | **0 (0%)** |

Margin never left the range **0 to +2**. Not "P1 has an edge" — P1 *cannot lose*,
and when P1 wins it is always by exactly one Service's worth of points.

This is the finding that matters, and it is not the problem the spec predicted.
Court as written is a solved-looking game: two competent players will draw or
lose by two, every time, on any layout. Reprieve (§6.1) is not needed — there is
no meaningful first-player advantage to compensate. There is no meaningful
anything.

## Why: denial beats construction, so both hands end up mirrored

What perfect play actually collects, across 80 solved hands:

| Combination | Per hand |
|---|---|
| Service (J+A) | 0.64 |
| Marriage (K+Q) | 0.23 |
| Coup (4 of a rank) | 0.12 |
| Full Court (4 of a suit) | 0.09 |
| Retainers | every hand |

The cheapest combination in the game is the only one anyone reliably builds.
Four-card sets are essentially unreachable against an opponent who is paying
attention — and when they do land, they land **symmetrically**: of 25 deals, 4
had *both* players complete a four-card set, 1 had only one player, 20 had
neither. Perfect play converges on the two players carving the grid into
matching shapes.

## Consequence: the four-card scoring values are inert

Sweeping the two headline numbers, 25 deals each:

| full_court | coup | mean margin | P1 win% |
|---|---|---|---|
| 12 | 12 | +0.96 | 48% |
| 12 | 14 | +0.96 | 48% |
| 12 | 16 | +0.96 | 48% |
| 14 | 12 | +0.96 | 48% |
| 16 | 12 | +0.96 | 48% |

Identical. Raising Full Court to 16 changes nothing, because when a four-set
completes the opponent has completed one too and the values cancel. **§7's worry
that Full Court's premium is too thin was the wrong question** — the premium is
irrelevant at any value.

## Deposition is the only thing keeping the game alive

| Deposed marriage worth | Mean margin | P1 win% | Draws |
|---|---|---|---|
| 0 (as written) | +0.96 | 48% | 52% |
| 2 (softened) | +0.96 | 48% | 52% |
| 6 (deposition off) | +0.24 | 12% | **88%** |

Remove deposition and the game is a draw 88% of the time. So the rule is
load-bearing — but note it never actually *fires* under perfect play: no
deposed marriage appeared in any solved hand. It works purely as a deterrent
that suppresses marriage-building. Softening it to 2 changes literally nothing,
so §7's "deposition may be too punishing" also turns out to be a non-issue at
this level of play.

## The endgame worry was overstated

Measuring the last ply at which the legal moves lead to different values
(30 deals): mean **13.4 of 16**, so **2.6 dead plies** at the end, not the four
or so §7 assumed. Distribution ran from ply 10 to ply 15. This is a minor
blemish, and the least of the game's problems.

---

## What this implies for the design

The engine says the trouble is structural, not numerical. No value on the table
fixes a game where both players can mirror each other's shape. Three directions,
roughly in order of how much they change:

1. **Break the symmetry of goals.** Give the two players different scoring
   objectives — e.g. one scores suits, the other ranks, alternating each round.
   Mirroring stops being available.
2. **Break the symmetry of information.** Variant 6.2 (four cards face-down)
   is now the most promising idea in the spec, because it prevents the precise
   denial that flattens everything. Worth solving as an expectimax next.
3. **Break the symmetry of tempo.** Let a player claim two cards in one turn at
   a cost, so the sequence of takes stops being strictly alternating.

Direction 2 is cheapest to test and the engine already almost supports it.

## Running it

```
python3 experiments.py balance    40    # first-player advantage
python3 experiments.py combos     40    # what perfect play collects
python3 experiments.py decisions  30    # where the game stops mattering
python3 experiments.py sweep      25    # four-card value sweep
python3 experiments.py deposition 25    # deposition on / softened / off
```

`Scoring` in `court.py` is a frozen dataclass — change values there or pass a
custom instance to `Solver(layout, scoring)` to test any other configuration.

---

# Addendum — the hidden-information variant (§6.2)

Four cells dealt face down. Two rules tested: **asymmetric** (the claimer sees
what they took, the opponent does not) and **symmetric** (nobody sees until
scoring). Agents are PIMC over enumerated possible worlds — see the docstring
in `hidden.py` for why the belief space here is only 24 worlds and why these
agents *understate* the value of hidden information.

## Baseline to beat

Player 2 had never won a game: **0 wins in 40 exactly-solved deals**, and
**0 in 20** with the PIMC harness run at zero face-down cards (a control that
also confirms the harness reproduces the exact solver's result shape).
Every margin in all 60 was either 0 or +2.

## Asymmetric — the mirror breaks

Pooled across four batches (36 deals at 8 sampled worlds, 5 at full 24-world
enumeration):

| | asymmetric (41) | baseline (60) |
|---|---|---|
| P2 wins | 5 (12%) | 0 (0%) |
| Draws | 23 (56%) | 52% |
| Margin range | −4 to +6 | 0 to +2 |
| Margins outside {0,+2} | 9 (22%) | 0 (0%) |

Fisher exact, one-sided, against the baseline:

- P2 ever winning: **p = 0.0095**
- Margin escaping {0, +2}: **p = 0.00017**

The second test is the more sensitive one and the more meaningful. The
baseline game had a two-value outcome space; the asymmetric variant does not.
That is the mirror breaking.

## Symmetric — no effect on the mirror

10 deals: P1 wins 5, draws 5, **P2 wins 0**. Margins 0 to +6 — wider than
baseline, but strictly one-sided. Hiding cards from *both* players adds
variance to how much P1 wins by without ever letting P2 win. This confirms
the prediction that symmetric noise leaves both sides optimising against the
same distribution.

**So the face-down rule works, but only in the asymmetric form.** Spec §6.2
as written is the version that does not help.

## What is not established

- **Batch variance is high.** One 13-deal batch (seed 2) came back with 0 P2
  wins and margins confined to {0,+2} — indistinguishable from baseline. The
  pooled result is significant; individual batches are not reliable.
- **41 deals is not many**, and 36 of them sampled 8 of 24 worlds rather than
  enumerating. Notably the 5 fully-enumerated deals were the *most* volatile
  (2 P2 wins, range −2 to +6), hinting that sampling dampens the effect
  rather than manufacturing it — but n=5 proves nothing.
- **PIMC never bluffs.** These agents cannot play to conceal or to exploit
  what the opponent doesn't know. Real players can. The measured effect is
  a floor.
- **Nothing here says the game is now good** — only that it is no longer
  determined. Whether 4 is the right number of face-down cards, and whether
  the four-card combinations become reachable once precise denial is
  impossible, are both untested.

## Suggested next run

Re-run `combos` under the asymmetric variant. The original finding was that
Full Court and Coup were inert because perfect denial kept them unreachable
and mirrored. If hidden information makes them land asymmetrically, those two
scoring values stop being dead numbers and the sweep becomes worth repeating.

---

# Addendum 2 — scoring changes must be tested under hidden information

Two candidate fixes for the inert four-card routes: **partial credit**
(any three of a suit or rank scores 5) and a **Service counter** (a Service
does not score if the opponent holds the Queen of that suit).

## Under the exact full-information solver, everything is dead

20 deals each:

| Config | Mean margin | Draws |
|---|---|---|
| baseline | +1.10 | 45% |
| partial credit | 0.00 | **100%** |
| service counter | 0.00 | **100%** |
| both | 0.00 | **100%** |

Every scoring change makes the full-information game *more* drawn, including
ones that work. **The full-information solver can only detect a lever's
downside.** It was the wrong instrument for this question and should not be
used to judge scoring changes again.

## Under the hidden rule they separate

Same 12 deals, seed 31, asymmetric face-down, 4 hidden:

| Config | P2 wins | Draws | Margin range |
|---|---|---|---|
| baseline | 1 (8%) | 42% | −2 to +4 |
| partial credit | 1 (8%) | **75%** | −2 to +4 |
| service counter | 1 (8%) | 50% | **−6 to +10** |
| service counter, deposition OFF | 1 (8%) | 42% | −2 to +4 |

**Partial credit is harmful.** Draws rise to 75%. A route that pays out even
when interfered with is a route that does not care what the opponent knows,
so it absorbs exactly the volatility hidden information creates.

**The Service counter works.** Same draw rate as baseline, margin range more
than tripled. Suppressing the cheap safe route forces play onto the long
ones, and long routes under uncertainty are where the swings are.

**Deposition is still load-bearing.** With the Service counter in place but
deposition removed, the range collapses straight back to −2..+4 — the entire
widening disappears. The two counters are not redundant; the swings come from
having both.

### Caveats
- 12 deals per config, one seed. P2's win count is identical (1) in all four,
  so nothing here addresses the P1 lean — only the spread.
- The deposition-off run was executed in two halves after a timeout; the
  deals are identical but the agents' RNG stream is not continuous with a
  single-pass run.
- One specific counter design (Queen blocks Service), not the concept.

---

# Reproducing these results

**Defaults changed after these experiments ran.** `Scoring()` in `court.py`
now defaults to the mobile plan's ruleset: deposition on **and the Service
counter on** (`countered_service=0`). Every number in this document *before*
Addendum 2 was produced with the Service counter **off**. To reproduce them,
pass `Scoring(countered_service=4)` explicitly. The `experiments.py` commands
in "Running it" use the default, so they will not match the tables as written.

## Hidden-information runs (Addenda 1 and 2)

The August session ran these through a helper script, `compare.py`, which was
lost in a container reset and is not in this package. Everything it did is a
call to `hidden.run()` and `hidden.report()`:

```python
from hidden import run, report
from court import Scoring

OFF = dict(countered_service=4)   # pre-Addendum-2 baseline

# Addendum 1: asymmetric vs symmetric, 4 face down
report(run(20, reveal=True,  n_face_down=4, max_worlds=8, scoring=Scoring(**OFF)), "asym")
report(run(20, reveal=False, n_face_down=4, max_worlds=8, scoring=Scoring(**OFF)), "sym")

# Addendum 2: matched-seed comparison (seed 31)
for name, sc in {
    "baseline":            Scoring(**OFF),
    "partial credit":      Scoring(triple=5, **OFF),
    "service counter":     Scoring(),                          # current default
    "counter, no deposition": Scoring(deposed_marriage=6),
}.items():
    report(run(12, reveal=True, n_face_down=4, max_worlds=8, seed=31,
               verbose=False, scoring=sc), name)

# Skill vs face-down count: thinking player against random
run(6, n_face_down=8, max_worlds=8, seed=11, agents=("pimc", "random"))
```

Expect close but not identical numbers. The PIMC agents break ties with an
RNG, and several original runs were split across timeouts.

## Cost

About 2 seconds per exactly solved deal and 30–60 seconds per hidden-information
deal, single-threaded Python. A 12-deal hidden comparison takes several minutes.
Run long batches in the background with `python3 -u` and a log file, and check
the process with `ps`, not `pgrep -f` (which matches its own command line).
