# WhoWare — TestSprite S4 Plan

> Season 4: One Week. One Loop. Every PR.
> Build Oct 16-22, judging Oct 23-27, winners Nov 6.
> Scoring 100: quality 40 + tests-that-run 40 + innovation 20.
> One submission per team. Public repo + live URL whole phase.

## Why WhoWare
- Live: https://whoware.vercel.app — 2D default, no wallet/keys.
- Loop: Enter -> scene -> clue -> guess x8 -> solve/exhaust -> reveal+score.
- Deterministic asserts: ceiling bleed, hints 2, deduction log, Witness Chamber.
- Existing 16 backend + 7 frontend suites + answer-leak guards.

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
