# Court

A 16-card, two-player drafting game, played on a phone browser against an AI
opponent. Designed August 2026; this is the first playable build (Phases 1–2 of
[`docs/court-mobile-plan.md`](docs/court-mobile-plan.md)).

## Play

Deployed to GitHub Pages from `main`. Append `?seed=<n>` to the URL to replay a
specific match. The deal seed is shown on each score screen.

## Develop

```
npm install
npm run dev        # local dev server
npm test           # unit tests (engine, AI, information hiding, Python parity)
npm run build      # typecheck + production build into dist/
npm run bench      # AI vs random, 100 seeded deals per level (several minutes)
```

## Layout

| Path | What |
|---|---|
| `src/engine/` | Pure rules engine, no DOM. Cards, grid, claims, scoring, seeded RNG. |
| `src/engine/rules.ts` | `RulesConfig`: every point value, both counters and the face-down count. Change rules here only. |
| `src/ai/solver.ts` | Exact negamax solver for one fully known layout (port of `reference/solve.py`). |
| `src/ai/agent.ts` | Determinized (PIMC) opponent and the three difficulty levels. Gets a `PlayerView` only. |
| `src/ai/worker.ts` | Runs the AI in a Web Worker. |
| `src/ui/` | DOM UI: board, match flow, score screens, tutorial, styles. |
| `tests/` | Vitest suites. `fixtures/parity.json` comes from the Python engine. |
| `reference/` | The August Python engine (reference for scoring parity). |
| `docs/` | Design spec, solver findings, and the mobile build plan. |

## Rules implemented

The hidden-information variant with both counters, per the build plan (which
takes precedence over `docs/court-spec.md`):

- 4×4 grid, four cells face down (`RulesConfig.faceDown`). A face-down card is
  seen by whoever claims it; the opponent sees it only at scoring.
- First claim anywhere. Each later claim comes from the row or column of the
  cell the previous claim vacated. Free Claim when both are empty.
- Full Court 12, Coup 12, Marriage 6, Service 4, Retainer 1. Best allocation.
- Deposition: opponent's Ace of the suit voids a Marriage.
  Service counter: opponent's Queen of the suit voids a Service.
- Match: two deals, seats swapped, scores summed. A tied match is a draw.

## Regenerating the parity fixture

```
npm run parity:fixture   # needs python3; runs reference/court.py
```
