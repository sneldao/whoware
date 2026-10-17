# WhoWare — Anna App

Daily history guessing game as a schema-2 Anna App (static SPA bundle). One
historical figure per day; you step into a room, inspect what's in it, read
what the figure in the room says about it, and name who changed history from
there.

Strategy, funding model and the path that led to this architecture live in
[`../../ANNA.md`](../../ANNA.md). This file is the build.

## Commands

```bash
anna-app validate --strict            # schema + host_api ACL coverage
anna-app dev --no-llm                 # local harness, offline, :5180 (llm calls return null → curated quote)
anna-app dev --mock-llm fixtures/voice.jsonl  # canned llm.complete, exercises the live-voice path
anna-app dev --storage aps            # real APS (needs `anna-app login`)
anna-app apps push                    # upsert the working draft
anna-app apps submit-review           # DRAFT -> PENDING_REVIEW

bun run tools/build-fixture-episode.ts # regenerate bundle/episode.json + panoramas
bun test tools/                        # 61 tests
```

## Layout

```
anna/whoware/
├── manifest.json          schema 2 — one view, storage+window grants, no executa
├── app.json               store listing metadata
├── bundle/
│   ├── index.html
│   ├── styles.css         scene palette arrives as CSS custom properties
│   ├── app.js             APS state, view lifecycle, DOM
│   ├── game.js            PURE rules — scoring, streak, guess eval, share text
│   ├── motion.js          cancellable typewriter, dust motes, crossfade
│   ├── episode.json       generated — the day's episode
│   └── panorama/          generated — scene backdrops
└── tools/
    ├── build-fixture-episode.ts
    ├── game.test.js
    └── motion.test.js
```

Three-way split, and the rule that keeps it honest: **`game.js` must stay
pure** — no DOM, no host SDK, no network. It is the only layer where a
mistake silently corrupts player history, and the only layer that can be
tested without a browser. `motion.js` is DOM-adjacent and cancellable.
`app.js` is wiring.

## Three constraints worth knowing before you change something

**1. The catalog is not yours to store.** The episode is global, read-only,
generated at curation time. APS holds only per-user state. See ANNA.md §3 for
the full split and why `aps.kv` cannot hold the catalog.

**2. Two keys, not one.** `whoware/profile` (streak, best, freezes, history)
survives days; `whoware/run/<episodeDay>` is one day's run. An earlier revision
kept the streak inside the run, and because a new episode resets the run, every
new day zeroed it. `game.test.js` pins this.

**3. The window is usually not focused.** An Anna app window spends most of
its life unfocused or collapsed while the user reads the conversation it was
summoned from. Two obvious animation implementations break there and only
there:

| approach | unfocused behaviour |
|---|---|
| chained `setTimeout` | background timers clamp to ~1 Hz → 1 char/sec crawl |
| bare `requestAnimationFrame` | paused outright when hidden → reveal never completes |
| **`motion.js` typewriter** | time-based progress + a safety timer that backstops rAF |

`motion.test.js` stubs the frame clock and covers the hidden-window path,
which is otherwise invisible in local dev. The same reasoning applies to
`startDust`, which stops on `visibilitychange` and yields entirely under
`prefers-reduced-motion`.

## Does a run count? — answered, and shipped

A Qualified App Run is what the grant is measured in, and the app was originally
built in a way that may not produce one.

`dora`, answering a builder with a manifest-schema-2 bundle-only app
([forum thread 351](https://forum.anna.partners/t/founding-builder-buidl-deadline-while-app-review-is-pending-and-mau-counting-for-bundle-only-apps/351)):

> **A `storage.set` call by itself would not be treated as a Qualified App Run**;
> it can be part of the workflow, but simply saving data is not enough on its
> own.

WhoWare's only host calls during a run *used to be* `window.set_title` and
`storage.set`. The AI work happened at curation time, off-platform. App Review
wants an "AI-Native Core" for the same reason: primary value should depend on
AI reasoning *at runtime*.

**The fix is in.** Each clue reveal calls `anna.llm.complete` for the figure's
line — billed to the player's own quota, no API key, and the documented default
over an Executa, so it does not undo the no-Executa decision. The deterministic
`figureVoice` engine stays as the offline fallback and as the unit-tested source
of the voice format, and a generated line that names the target is thrown away
rather than shown, so the model cannot end the puzzle.

Grant: `manifest.ui.host_api.llm: ["complete"]`. Nothing else changed. Verified
against the production host — see ANNA.md §1a for what was and was not observed.

## Rendering model

Views are built once and **patched**; they are not rebuilt per interaction.
`mountView` owns an `AbortController` and a dust teardown, so leaving a view
always cancels its motion. Clue reveals, hints and guesses call `patchRoom()`,
which re-renders only the changed nodes — the panorama layer, the dust
canvas and DOM focus all survive.

Backdrops ship as real files in `panorama/`, not inlined data URIs, so
`episode.json` stays 3.6 KB and panoramas are cacheable and lazily fetched.
A curated episode supplies `imageUrl` per scene, which takes precedence.

## Accessibility

Hotspots are real buttons labelled with what they actually are
(`Inspect: Enigma cipher chart`), not "Undisclosed clue 1". Keyboard:
`G` guess, `H` hint, `N` next scene, `1`–`9` jump to scene, `Esc` back.
Every animation has a `prefers-reduced-motion` path that removes it rather
than shortening it.
