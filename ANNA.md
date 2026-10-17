# Anna AI OS — Founding Builder Program: WhoWare Plan

> **Deadline: 2026-10-31 15:59** (extended from 09-30). Verify at
> [dorahacks.io/hackathon/2349/build](https://dorahacks.io/hackathon/2349/build).
> As of 2026-10-17: **14 days remain**, prize pool **$6,000**, 91 hackers, **1 build submitted**.
> Platform docs: [anna.partners/llms.txt](https://anna.partners/llms.txt)

---

## 1. The bet

WhoWare ships as an approved **Anna Marketplace App** and qualifies for the founding
builder grant. Grant-funded, not revenue-funded — the only metrics that matter are
**approved Marketplace App** and **Qualified App MAU**.

> **The economics in this file were wrong until 2026-10-17 and have been corrected
> below.** The prior version claimed "$6k from 200 MAU" (~$30/MAU). That is off by
> two orders of magnitude. Treat any earlier copy of this file as unreliable.

### Actual grant tiers

Source: [forum.anna.partners thread 205](https://forum.anna.partners/t/turn-your-ai-agents-apps-into-recurring-monthly-grants-join-the-anna-ai-os-founding-builder-program-up-to-80k-month-pool/205)

| Tier | Required Monthly MAU | Sept Launch Boost | Standard Monthly |
|---|---|---|---|
| S — Galactic Sovereign | 20,000+ | $6,000 | $5,000 |
| A — Growth Titans | 10,000+ | $4,000 | $2,500 |
| B — Starship Commanders | 4,000+ | $1,600 | $1,000 |
| C — Orbit Pioneers | 1,000+ | $400 | $200 |
| D — Stratosphere Builders | 500+ | $200 | $100 |
| E — Genesis Spark | 200+ | $80 | $50 |

**What this means for us:**

- **200 MAU is $50/month, not $6,000.** The "$6,000" headline is Tier S and needs
  20,000 MAU. At the qualification floor we earn $0.25 per MAU.
- **The September Launch Boost is gone.** It applied only to the Sept 1–30 cycle.
  Anything first qualifying in October or November gets the **standard** grant
  only. Our realistic ceiling this cycle is Tier C ($200/mo at 1,000 MAU).
- **The real bar is known:** exactly **two** builders qualified in September, both
  at Tier D (500+ MAU). Low competition, real MAU bar.
- **One grant per builder per month, portfolio-wide** — see §1b.

**Second revenue path:** 70% of eligible usage profit when users run the app on
paid Anna credits, settled T+1, payable from a $50 balance. Separate from grants
and not counted in the tier math.

### Deadlines

| Milestone | Value |
|---|---|
| DoraHacks BUIDL deadline | **2026-10-31 15:59** (extended from 09-30) |
| Founding Builder qualification window | 2026-09-01 -> **2026-11-30** |
| App review turnaround | 3-5 business days (two-part review) |

Dora states the BUIDL deadline "will be extended again to the end of November" to
stay aligned with the Anna window. **Do not plan on that** — submit by Oct 27 and
treat any extension as upside. A BUIDL submitted while review is still pending is
accepted; approval follows the App.

Qualification needs 200 Qualified App MAU in a **single** calendar month during
Sept/Oct/Nov. Pushing Oct 27 puts review around Nov 3, leaving roughly four weeks
of the November cycle to accumulate MAU.

### 1b. Portfolio consolidation (effective 2026-10-01)

All apps owned by the same builder are measured as **one portfolio**: qualified
users are combined and **deduplicated** across apps, and the builder receives at
most **one grant per calendar month** at the tier their combined MAU reaches.

This makes the Brume pairing a policy requirement, not an optimisation. A user who
tries both apps counts once, so overlap is wasted reach; only *distinct* users add
up. Splitting into more apps does not multiply grants.

---

## 1a. The risk that would void everything: does a run even count?

**This is the highest-consequence unknown in the plan.**

From `dora` answering a builder with a manifest-schema-2 bundle-only app, in
[forum thread 351](https://forum.anna.partners/t/founding-builder-buidl-deadline-while-app-review-is-pending-and-mau-counting-for-bundle-only-apps/351):

> A Qualified App Run does not have to go through an Executa or an Agent session.
> A bundle-only App can count as long as [...] the App successfully completes its
> declared primary function [...] **A `storage.set` call by itself would not be
> treated as a Qualified App Run; it can be part of the workflow, but simply saving
> data is not enough on its own.**
>
> We do not use one universal Host API call as the completion marker for every App
> [...] The full successful execution is considered together with the App's
> declared function and server-side activity.

WhoWare is bundle-only, and during a run its **only** host calls are
`window.set_title` and `storage.set`. The AI work happened at curation time,
off-platform, and the run is otherwise client-side. On the stated rule, that is
unlikely to register as a Qualified App Run — and MAU we cannot count is MAU we do
not get paid for.

App Review makes the same point independently: *"AI-Native Core — Primary value
must depend on AI reasoning or workflows."* Our primary value currently does not
depend on AI at runtime.

**The fix is also the product improvement we were missing anyway.** Add a real
host-mediated `llm.complete` call to the primary function:

| Option | What it buys |
|---|---|
| Generate a bespoke figure-voice line for each clue the player opens | Genuinely AI-native, keeps the deterministic engine as the offline fallback, and the quotes get better every day instead of being templated forever |
| Generate scene/clue detail on entry | Endless episodes instead of one bundled `episode.json` |
| `llm.image` for the panorama | Also removes the generated-SVG placeholder, and finally gives every scene a real image |

`llm.complete` is billed to the **user's own** quota, needs no API key, and is the
documented default over an Executa. `manifest.ui.host_api.llm: ["complete"]` is the
whole grant. It also makes the app the thing it claims to be.

**Do this before submitting.** It is the difference between a shipped app and a
counted one.

---

## 2. Why WhoWare is a good fit

- **Daily episode, Wordle-like habit, streak-at-risk.** Proven loop; already
  playable at whoware.vercel.app with a live Convex backend.
- **Primary function is trivially definable** for the Qualified Run metric:
  land in today's room, solve or exhaust, see the verdict.
- **2D default path is iframe-friendly.** The panorama room renders as a single
  high-resolution image — no WebGL, no heavy bundle. The 3D room stays opt-in.
- **No crypto in the v1 path.** Strip the Polygon paywall entirely. A USDC wall
  fights the MAU metric and has no place in a chat-first surface.

---

## 3. Architecture: App UI bundle, **not** chat tools

> **This section replaces the earlier "4 chat tools" plan.** That plan was written
> against a platform generation that only had Executa tools returning text.

The platform now supports **schema-2 App UI bundles** — a static SPA in a sandboxed
iframe with window lifecycle, dock, host-API grants, and the assistant summoning
or dismissing windows via LangChain tools + SSE.

WhoWare's entire value is the *room*: panorama, dust motes, drag-to-look, the
typewriter reveal, the quote-block. A chat tool returns text and cannot render
any of it. The iframe is exactly where this product belongs.

### v1 needs **no Executa at all**

| Layer | Choice | Why |
|---|---|---|
| UI | `bundle/` static SPA, `static-spa` format | The room is the product |
| Catalog | Pre-baked daily episode JSON, bundled or served read-only | Venice work already happens at curation time; the player path never needs a live model call |
| Per-user state | APS via `ui.host_api.storage` | Streak, score, guess log, investigator UUID |
| Executa | **none in v1** | See below |

Platform guidance is explicit that the Host API is the default and Executa is an
escape hatch for heavy CPU, long-lived session state, un-abstracted capabilities,
**developer-owned secrets**, and agent-orchestrable tools. None of the first four
apply here — so still **no Executa**.

But "no Executa" must not become "no AI at runtime". §1a: a bundle-only app whose
only host calls are `storage.set` is unlikely to register as a Qualified App Run,
and App Review wants an AI-native core. The answer is the **Host API**
(`manifest.ui.host_api.llm: ["complete"]`), not an Executa — user-quota billing,
no API key, and it is the documented default path.

**When an Executa earns its place — v2:** on-demand episode *generation*. "Build
me a room about someone I care about." That needs a developer-owned Venice key,
which is documented anti-pattern #4 territory — the key must never reach the
iframe. That is precisely the case an Executa exists for. Do not build it in v1.

### State split — the question `aps.kv` never answered

APS is **per-user durable KV**. The episode catalog is **global and read-only**.
Getting this backwards means either every user gets their own copy of the catalog,
or the daily episode has no shared source of truth. The split:

| Data | Mutability | Home |
|---|---|---|
| Figure, era, region, difficulty, tags | global, read-only | bundled episode JSON |
| Scene briefs, panorama URLs, hotspot positions | global, read-only | bundled episode JSON |
| Clue text, figure quote, room-figure relationship | global, read-only | bundled episode JSON |
| Answer (the target figure ID) | global, read-only | bundled episode JSON |
| Score, detective grade, streak | per-user | APS |
| Guess log (with proximity prose) | per-user | APS |
| Investigator UUID | per-user | APS |

### Manifest shape (schema 2, verified against `@anna-ai/app-schema` 0.27.0)

Scaffold at `anna/whoware/manifest.json`, already validating clean.

> **Correction to the old plan:** `host_capabilities: ["aps.kv"]` is the **legacy**
> form. Schema 3 replaces the `aps.*` capability strings with a structured
> `storage` declaration, and the two are **mutually exclusive and
> validator-enforced**. The scaffold's `ui.host_api.storage: ["get", "set"]` is
> the current shape. Using `aps.kv` would likely have failed validation.

```json
{
  "schema": 2,
  "ui": {
    "bundle": { "format": "static-spa", "entry": "index.html" },
    "views": [{
      "name": "room", "title": "WhoWare", "default": true,
      "default_size": { "w": 640, "h": 800 }, "min_size": { "w": 320, "h": 480 }
    }],
    "host_api": { "storage": ["get", "set"], "window": ["set_title", "ready"] }
  }
}
```

No `required_executas` in v1 — the scaffold ships one (`tool-dev-whoware`); we
strip it and drop `executas/`.

---

## 4. Growth: shareability, not retention

The daily-habit loop **does not survive contact with Anna.**

- "Streak-at-risk flame" assumes yesterday's player. An Anna user arrives from a
  `#mention` or the Marketplace with no history.
- There is no push surface on Anna, so the "Remind me" opt-in cannot fire.
- The "tomorrow's room: era · region" teaser is worth nothing to a first install.

So the hook is the **verdict**, not the ritual. Assets that already work: the share
card, the detective grade, the prose proximity ("Hypatia lived around the same
century — close, but not the one"), and the Witness Chamber reveal.

### How the 500-MAU builders actually got there

[forum thread 367](https://forum.anna.partners/t/how-i-reached-500-mau-for-my-apps-using-direct-outreach-college-communities-hackathons-and-tech-communities-instead-of-a-big-marketing-budget/367)
is a builder's honest retrospective and it is the most actionable thing found in
this research:

- **Direct outreach beat posting links**, decisively. Explaining the app, showing
  it, letting people try it, collecting feedback, asking happy users to share.
- **College, hackathons, tech communities, WhatsApp groups, existing network.**
- **Sponsor something small at a hackathon** (they bought a Codex subscription as
  a prize) to buy a relevant audience rather than buying ads.
- **X / social posting underperformed for them.** Treat it as a secondary channel.
- "Don't just drop a link in a community" — say what problem it solves first.

This maps onto what we already built: the share card is the "ask a happy user to
share" lever, and the Witness Chamber reveal is the thing worth talking about.

### Competitive landscape

The concept is proven and already copied. Everyone found is **tile/attribute
based**:

| Competitor | What it is |
|---|---|
| **Historydle** (historydle.com, on Google Play) | The direct one. Free daily Wordle-style history guessing, **199+ figures**, four modes (Classic, Quote, Portrait, Places) |
| Whodle (timedle.com) | Countryle-style attribute comparison, not free-text |
| Past Puzzle (App Store) | Daily "guess the year" quiz |
| Ravel daily challenge, various figure-quiz apps | Single daily figure, 7 tries |

**The gap is us.** None of them are embodied, and none of them are relational:

- You are *in a room*, not filling in a grid. Inspecting props is the mechanic.
- The Witness Chamber makes the answer **someone who is not in the room** — the
  figure present is a witness who knew the target and speaks about them in first
  person. No tile game can express that.

Historydle competes on breadth (199 figures, four modes). We compete on depth of a
single experience. **Lead with the room and the witness in review, in the store
listing, and in the share card** — "the only history game where you are in the room
with someone who remembers them." Breadth is the thing we cannot win, and should
not pretend to.

---

## 5. Qualified Run — the decision nobody has made

**Definition:** signed-in user completes the primary function = **solves or exhausts
today's episode**.

But WhoWare's ceiling is 8 guesses, 2 hints, 3 scenes of deliberate clue-reading.
A user who opened the app from a chat mention **will not finish that in one
session.** The Qualified Run rate is the whole program, and current tuning is
hostile to it.

The measured definition is stricter than "opens the app": a run must be started
by a signed-in user, **successfully execute the declared primary function**, and
return a meaningful non-trivial result. Opening or installing does not count, and
developer/QA accounts are excluded entirely — so local testing does nothing for
us here.

**Required change: a short-mode path.**

- Default view opens on **scene 0, hint 1 pre-revealed**
- Reduce the guess ceiling from 8 to **5**
- "Quick solve" completes on any correct guess at any point
- Full 8-guess mode available but not the default

Decide this before writing UI, not after. It changes the room layout.

---

## 6. Build slice — 14 days

| # | Task | Status |
|---|---|---|
| 1 | Install `@anna-ai/cli`, `anna-app doctor` | ✅ done |
| 2 | `anna-app init anna/whoware`, validate manifest | ✅ done |
| 3 | Rewrite this plan around the App UI path | ✅ done |
| 4 | Episode generator → `bundle/episode.json` (Witness Chamber fixture) | ✅ done (fixture) · ⚠️ live Convex query still pending — this machine has no Convex access |
| 5 | Build room UI (panorama, hotspots, clue exhibit, quote-block) | ✅ done |
| 6 | Wire APS for score / streak / guess log | ✅ done (code) · ⚠️ **unverified against real APS** — needs `anna-app login` |
| 7 | Apply short-mode tuning from §5 | ✅ done |
| 8 | Verdict view + share card + `view.summary_template` | ✅ done |
| 8b | Entry gate, return recap, keyboard, affordances, dust, declassification beat | ✅ done |
| 8c | **Add host `llm.complete` to the primary function** (§1a) | ⬜ **blocking — without it a run may not count toward MAU** |
| 9 | `anna-app login`, `account set-handle` | ⬜ **blocking — needs a human PAT** |
| 10 | `anna-app apps push` → `apps submit-review` | ⬜ |

### APS state layout

Two keys, deliberately separated:

| Key | Contents | Lifetime |
|---|---|---|
| `whoware/profile` | streak, best, freezes, lastSolvedDay, day history (capped at 60) | across days |
| `whoware/run/<episodeDay>` | in-flight run: guesses left, hints, clues found, guess log, score, scene index | one day |

An earlier revision kept `streak` inside the run record. Since a new episode
resets the run, **every new day silently zeroed the streak** — the one
mechanic the daily loop rests on. `tools/game.test.js` pins the fix.

`bundle/game.js` holds the pure rules (scoring, grading, guess evaluation,
streak transitions, share text) with no DOM or host dependency, so the streak
logic is unit-tested rather than only reachable by clicking through a room:

```bash
bun test anna/whoware/tools/game.test.js   # 29 pass
```

### Share

Growth in Anna is shareability, not retention (§4), so the pasted result is
the artefact that travels. `buildShareText` mirrors
`apps/default/components/who-ware/result-share-card.tsx` so a result pasted
from Anna and from the native app read as the same thing, with grade and
streak added — the native card dropped those in v0.2 cut #6, but here the
streak *is* the growth mechanic. Native share sheet where available,
clipboard otherwise, with the text always shown in a selectable block so a
blocked clipboard is a soft failure.

### Cold path

The first version dropped a returning player straight into a room with two
mystery dots and no framing. Three things now stand between a chat mention
and play, and the middle one only appears for a run already in progress:

1. **Entry gate** — episode number, tier, who is in the room, current streak,
   and one Enter. Witness Chamber episodes say so on the kicker.
2. **Return recap** — "Where you left off": clues opened, guesses spent,
   guesses left, and the proximity prose from the last one. Resume restarts
   the run, never the profile.
3. **The room**, which states its own objective ("2 objects in this room are
   unopened") and labels every hotspot with what it actually is
   (`Inspect: Enigma cipher chart`, not "Undisclosed clue 1").

### Environment: the window is rarely focused

An Anna app window spends most of its life unfocused or collapsed while the
user reads the conversation it was summoned from. Two obvious animation
implementations break there and only there — a chained-`setTimeout`
typewriter crawls at ~1 char/sec because background timers clamp to 1 Hz, and
a bare `requestAnimationFrame` typewriter never completes at all because rAF
is paused outright when hidden, leaving a blank verdict. `motion.js` derives
progress from elapsed wall-clock and backstops rAF with a timer, so the
reveal always lands. `startDust` stops on `visibilitychange`. Both paths are
pinned by `tools/motion.test.js`, which stubs the frame clock because the
failure is invisible in local dev.

### Rendering: patch, never rebuild

Views are built once and patched. Clue reveals, hints and guesses update only
the changed nodes, so the panorama layer, the dust canvas and DOM focus
survive. `mountView` owns an `AbortController` plus a dust teardown, so
leaving a view always cancels its motion — the previous version's
`app.innerHTML = ""` tore down the whole subtree on every reveal.

Backdrops ship as real files in `bundle/panorama/`, not inlined data URIs:
`episode.json` went 12.4 KB → **3.6 KB**, and panoramas became cacheable and
lazily fetched. A curated episode's `imageUrl` takes precedence.

### What is still unverified

- **Real APS backend.** Everything here was exercised against the harness's
  in-memory `legacy` backend, which shares the dispatcher and the ACL but not
  Postgres/Redis quota, etags, or TTLs. Run `anna-app dev --storage aps`
  after `anna-app login` before trusting quota behaviour.
- **Live episode images.** `episode.json` uses a generated SVG backdrop;
  `scene.imageUrl` takes precedence and is wired but untested against a real
  Venice URL.

**Strip from the scaffold before shipping:** `executas/`,
`required_executas`, `host_api.tools`.

### Episode generation

`anna/whoware/tools/build-fixture-episode.ts` emits `bundle/episode.json` by
calling the **real** `quoteForClue` engine, so the bundle's Witness Chamber
voice is identical to the live app. Figure metadata is read from
`seedCatalogData`, never copied — copying tags is how the generator silently
drifted behind a `figures.ts` fix.

Current fixture: Churchill in the room, Turing as the absent target.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Review cycle eats the buffer | Push by **Oct 27** at the latest. Assume ~4 days for review. |
| App is approved but has no MAU | Grant needs both. Ship share card in v1, not v2. |
| Qualified Run rate too low | §5 short-mode is the lever. Decide before UI. |
| `aps.*` vs `storage` validator rejection | Already resolved — use schema-2 `ui.host_api.storage`. |
| Grants unverified against live terms | **Resolved 2026-10-17** — see §1 for the real tier table. |
| **A run does not register as a Qualified App Run** | **Highest risk in the plan.** Bundle-only app whose only host call is `storage.set`. Fix: host `llm.complete` in the primary function (§1a). |
| **Maintenance requirement missed** | At least one meaningful improvement per calendar month to stay eligible. The commit log counts; keep shipping. |
| November MAU is thin | Review lands ~Nov 3, leaving ~4 weeks. Tier E (200) is the realistic target, Tier D (500) the stretch. Outreach playbook in §4, not ad spend. |
| Brume overlap wastes reach | Portfolio MAU is deduplicated — a user in both apps counts once. Only distinct users add up. |