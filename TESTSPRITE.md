# WhoWare — TestSprite S4 Plan

> Season 4: One Week. One Loop. Every PR.
> Build Oct 16-22, judging Oct 23-27, winners Nov 6.
> Scoring 100: quality 40 + tests-that-run 40 + innovation 20.
> One submission per team. Public repo + live URL whole phase.

## Why WhoWare
- Live: https://whoware.vercel.app — 2D default, no wallet/keys.
- Loop: Enter -> scene -> clue -> guess x8 -> solve/exhaust -> reveal+score.
- Deterministic asserts: ceiling bleed, hints 2, deduction log, Witness Chamber.
- Existing 17 backend + 8 frontend suites + answer-leak guards (README §4 lists
  them by name), plus 61 bun tests for the Anna bundle's rules, motion and voice.
- Suite state 2026-10-17: backend 200 tests / 17 files green, frontend 63 / 8
  green, Anna bundle 61 green. The catalog parse error that had silenced 18
  suites (including the answer-leak guard) since 2026-09-22 is fixed, and the
  three assertions left behind by the 5→8 guess bump are resolved.
- CI now runs those three suites on every push to main and every PR
  (`.github/workflows/test.yml`, green in 25s on first run). The TestSprite
  check will land next to a repo check that can be seen failing.
- Not green, and not in scope: the 8 `WhoWareConfidentialGuess` specs need Inco's
  Hardhat cheatcodes, so they fail on a plain local run — which is consistent
  with the chain-free suite scope below anyway.

## Gates
- Portal suite FIRST vs live URL, then GitHub App on sneldao/whoware.
- >=1 PR Oct 16-22 with TestSprite comment/check. Blocking PRs optional +score.
- Same TestSprite account for suite + App. README must cover app + URL + suite.
- No secrets. localhost not tested. App must stay up.

## Suite scope
- today-drop loads, clue open as CLUE 01, guess commit two-tap, wrong prose.
- hint spend, ceiling ticks, solve reveal + grade/share, exhaust salvage.
- reload survives via runs.getRunGuesses. Answer never leaks pre-solve.
- Keep Polygon/Tiun/Inco/Mantle out of suite — free 2D path only.

## PR plan
- Small real PR: guess-feedback copy + streak flame, or Case File recap.
- Let check run, fix from failure bundle, rerun. PR is proof.
- Post in Discord channel + X for engagement bonus.

## Do not
- No camera/3D default, no paywall, no provider keys in CI.
- No second S4 entry — one per team.

## Links
- Live https://whoware.vercel.app — Repo github.com/sneldao/whoware
- Portal setup https://docs.testsprite.com/web-portal/integrations/github-integration
