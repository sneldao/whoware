# Anna AI OS — Founding Builder Program: WhoWare Plan

> **Deadline: 2026-10-31 15:59** (extended from 09-30). Verify at
> [dorahacks.io/hackathon/2349/build](https://dorahacks.io/hackathon/2349/build).
> As of 2026-10-17: **14 days remain**, prize pool **$6,000**, 91 hackers, **1 build submitted**.
> Platform docs: [anna.partners/llms.txt](https://anna.partners/llms.txt)

---

## 1. The bet

WhoWare ships as an approved **Anna Marketplace App** and qualifies for the founding
builder grant. Grant-funded, not revenue-funded — the only metrics that matter are
**approved Marketplace App** and **MAU**.

**Verified (dorahacks.io):**

| Fact | Value |
|------|-------|
| Prize pool | $6,000 |
| Deadline | 2026-10-31 15:59 (extended from 09-30) |
| Hacker count | 91 |
| Builds submitted | 1 |

**From prior program notes — treat as unverified, re-check before relying on it:**

- Up to $6k Sep Boost, up to $5k/mo after, from 200 MAU (~$30/MAU at the threshold)
- $80k pool/mo, no leaderboard, qualify Sep 1 – Nov 30
- Portfolio dedup (Oct update): 1 grant/builder/mo
- Qualified Run = signed-in user completes the primary function
- Final gate = approved Marketplace App

> **Do not plan against the "Sep 1 – Nov 30" window.** The build deadline is Oct 31.
> Grant payout cadence after Oct 31 is a separate question and does not change
> what we must ship.

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
apply to a read-only pre-baked catalog + per-user KV.

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
  `#mention` or the App Store with no history.
- The "Remind me" push opt-in has no surface — Anna has no push.
- The "tomorrow's room: era · region" teaser is worth nothing to a first install.

**The hook has to be the verdict, not the ritual.** Assets that already work:

- **Share card + detective grade** — the payoff is a grade and a score worth posting
- **Prose proximity feedback** — "Hypatia lived around the same century" is quotable
- **The Witness Chamber reveal** — a genuinely surprising narrative beat

**Pairing with Brume** (another project of ours, not in this repo) to pool unique
users toward 200 MAU remains the growth strategy. There is no leaderboard to climb,
so this is about raw unique-user count across the portfolio.

---

## 5. Qualified Run — the decision nobody has made

**Definition:** signed-in user completes the primary function = **solves or exhausts
today's episode**.

But WhoWare's ceiling is 8 guesses, 2 hints, 3 scenes of deliberate clue-reading.
A user who opened the app from a chat mention **will not finish that in one
session.** The Qualified Run rate is the whole program, and current tuning is
hostile to it.

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
| 5 | Build room UI (panorama, hotspots, clue exhibit, quote-block) | ⬜ next |
| 6 | Wire APS for score / streak / guess log | ⬜ |
| 7 | Apply short-mode tuning from §5 | 🟡 tuning is in the bundle JSON, UI not wired |
| 8 | Verdict view + share card + `view.summary_template` | ⬜ |
| 9 | `anna-app login`, `account set-handle` | ⬜ |
| 10 | `anna-app apps push` → `apps submit-review` | ⬜ |

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
| Grants unverified against live terms | Re-confirm payout cadence with organizers via the hackathon Q&A before Oct 31. |