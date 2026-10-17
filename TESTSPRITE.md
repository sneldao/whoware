# WhoWare — TestSprite S4 Setup Runbook

> Season 4: One Week. One Loop. Every PR.
> Build Oct 16-22, judging Oct 23-27, winners Nov 6.
> Scoring 100: quality 40 + tests-that-run 40 + innovation 20.
> One submission per team. Public repo + live URL whole phase.

## State 2026-10-17 ~16:20 local — read this before you start

- Live https://whoware.vercel.app answers `200` in ~0.3s. It is up and will stay up.
- `main` is clean, pushed, and CI-green on its own head commit. Five build days
  left (window closes Oct 22).
- **CI is green and now runs on every PR** — `.github/workflows/test.yml`, workflow
  name `Test`, single job `suites`, ~20s. It runs the Anna bundle tools (61),
  backend (200 / 17 files) and frontend (63 / 8) suites. Uses no secrets and no
  provider keys, which is what the gates require.
- Nothing below needs a code change until step 4.
- Any push to `main` triggers a Vercel production deploy — even a docs-only one
  (`vercel.json` builds `apps/default` regardless). Same content comes back, but a
  deploy lands mid-run. Run the portal suite when no deploy is in flight.

## Do this in order

**1. Portal suite vs the live URL (~30 min) — needs your login.**
Sign in → create/select the TestSprite project → new web UI suite → target
`https://whoware.vercel.app` (not localhost — the gates say localhost is not
tested). Use the assertions in "Suite scope" below. Record the suite URL in
Evidence. Use the account you will also use for the GitHub App: the rules want
one account for suite + App.

**2. GitHub App (~10 min) — needs your login.**
`Workspace Settings → Connections → Integrations` → install the TestSprite GitHub
App with read/write on code, commits, deployments and pull requests, scoped to
`sneldao/whoware`. Install as the repo owner — the active `gh` account on this
machine is already `sneldao`.

**3. Link repo → project → trigger (~15 min).**
Link `sneldao/whoware` to the project from step 1. Trigger type **Pull Request**.
Click **Detect Events** — expect the `Test` workflow run and its `suites` check,
plus TestSprite's own bot comments. Set the Target URL pattern to
`https://whoware.vercel.app` **verbatim**; do not use a `{branch-slug}` placeholder,
because the suite must point at the same production URL from step 1, and preview
deploys are not the graded app. Then **Send a test event** and confirm it lands
before saving.

**4. Cut the PR — see "The PR" below (~45 min).**
One small real PR, Oct 16-22, with the TestSprite comment/check on it. Shape:
branch off `main` (`git checkout -b case-file-recap-reveal`), make the change, run
`bun run test` in `apps/default` (and `packages/backend` if anything moved), push
with `git push -u origin <branch>`, then `gh pr create`. Say the word and I'll do step 4 and fill the Evidence block — 1-3 and the
Discord/X posts in step 5 are the only parts that need your browser session.

**5. Evidence + post (~10 min).**
Fill the Evidence block, commit it, then post the PR + suite in the TestSprite
Discord channel and on X (engagement bonus).

**6. Freeze.**
After step 5, merge nothing to `main` until judging closes (Oct 27). The live URL
must not change under a running suite.

## The PR — do the recap, not the copy edit

Every path and line number below was opened and checked on 2026-10-17.

**Landmine first.** The wrong-guess prose is *not* in the web app: it is
`packages/backend/convex/scoring.ts:137-152` (`proximityMessage`), called at
`packages/backend/convex/runs.ts:292` and delivered to the client as
`proximityMessage`. Two tests pin literal substrings of it —
`packages/backend/convex/scoring.test.ts:141-158` (requires `"contemporary"`,
`"not the one"`) and `packages/backend/convex/runs.test.ts:380`. Rewording that
copy means editing pinned assertions for no player-visible gain. If you only want
a one-line diff, the *untested* client-side prose is
`apps/default/hooks/use-guessing.ts:523` and
`apps/default/app/practice/%5BepisodeId%5D.tsx:80` (the bracket is URL-encoded in
the filename — Expo's dynamic route on disk).

**Recommended: put the Case File recap on the reveal screens.**
- `apps/default/components/who-ware/case-file-recap.tsx:31` — the recap component
  already exists and is spoiler-safe; props at `:13-21` (includes `lastProximity`).
- It is mounted only mid-run: `apps/default/app/index.tsx:768-777`, gated at
  `:625-629`. It does **not** render on solve or exhaust.
- `apps/default/components/who-ware/views/solved-view.tsx:186-192` has a "Recap"
  tab that is just `href="/weekly"` — there is no in-screen summary. The other
  reveal surfaces are
  `apps/default/components/who-ware/views/exhausted-view.tsx:61`,
  `apps/default/components/who-ware/enhanced-identity-reveal.tsx` and
  `apps/default/components/who-ware/result-share-card.tsx`.
- Change: render the recap block on both reveal screens from `guessAttempts`
  (`apps/default/hooks/use-guessing.ts:57-63` type, `:150-157` state, rehydrated
  from the server at `:221`, returned at `:552`), with the closest call already
  derived at `apps/default/app/index.tsx:596-605`.

Tests to add with it: `apps/default/hooks/use-guessing.test.ts` is misnamed — it
only covers `evaluateHintRequest` from `apps/default/hooks/hint-gating.ts` and
asserts nothing about guess submission, so it will not catch a recap regression.
Add assertions that the recap row count equals clues opened, and that the answer's
name never appears in recap text (the spoiler guard the portal suite also checks).

Do not touch `MAX_GUESSES_PER_RUN` (8) or `GUESS_PENALTY` — pinned at
`apps/default/lib/scoring-tooltip.test.ts:52` and `:74`.

**Fallback PR (smaller).** A within-run streak flame. Note the naming trap:
`apps/default/hooks/use-streak.ts:12-25` is a UTC **day** streak and
`apps/default/components/who-ware/streak-banner.tsx:20-51` already draws a flame
(`Ionicons`, colors at `:23`) — there is no consecutive-correct/wrong concept
inside a run. Derive one from `guessAttempts` and surface it in
`apps/default/components/who-ware/deduction-board.tsx:23` (rows at `:35-46`).

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
- CI runs those three suites on every push to main and every PR
  (`.github/workflows/test.yml`, green in ~20s). The TestSprite check will land
  next to a repo check that can be seen failing.
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

## Evidence — fill as you go

- Portal suite URL:
- GitHub App install (org/repo, account):
- Trigger test event result:
- PR number + TestSprite comment/check link:
- Discord + X posts:

## Do not

- No camera/3D default, no paywall, no provider keys in CI.
- No second S4 entry — one per team.
- Do not point the trigger at a preview URL or `{branch-slug}`.

## Links

- Live https://whoware.vercel.app — Repo github.com/sneldao/whoware
- CI https://github.com/sneldao/whoware/actions/workflows/test.yml
- Portal setup https://docs.testsprite.com/web-portal/integrations/github-integration
