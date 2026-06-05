# WhoWare Release Roadmap

## Status: in-progress

## Progress Log

### 2026-06-04 — Slice 1 (Scoring truth) landed
Closed the four security- and fairness-critical gaps identified against the vision:

- **Answer leak fixed.** `episodes.getActive` now returns a public shape that excludes `figureName`, `answerOptions`, and `figureId`. The figure identity is resolved server-side only on `submitGuess`, and returned to the client only on a correct solve.
- **Figure catalog added.** New `figures` table with curated 15-figure seed, `by_canonicalName` + `by_tier` indexes, and a `by_name` search index. `GuessPanel` is now sourced from `figures.search` (the pre-existing filter UI was preserved — enhancement over replacement).
- **Durable run model added.** New `playerRuns`, `playerSceneViews`, `playerHotspotViews` tables. New `runs.ts` module exposes `startRun`, `enterScene`, `openHotspot`, `submitGuess` — all server-authoritative. One run per `(episode, identity)`. Scene views and hotspot views are deduped on the server.
- **Scoring consolidated.** Single `scoring.ts` module owns the formula (`10000 / -1200 / -250 / -600 / time-bucket`), `MAX_GUESSES_PER_RUN = 5`, and the rank comparator. Client no longer estimates score.
- **Guess cap enforced server-side.** `runs.submitGuess` rejects further guesses once `guessesUsed >= 5` or once the run is solved/exhausted. The previous client-side `INITIAL_GUESSES = 3` is gone.
- **Stable identity.** New `useIdentity` hook stores a UUID in AsyncStorage via `expo-crypto`; identity-based leaderboard rank lookup added alongside the existing name-based path.
- **Tests.** `runs.test.ts` covers idempotent start, deduped scene/hotspot views, correct solve + score, exhaustion after five wrong guesses, answer never revealed, cap enforcement, public-shape leak guard, and identity-based rank.

### 2026-06-04 — Slice 2 (Daily drops + mercy flow) landed
Server-authoritative daily cadence and gated mercy scenes:

- **Daily drop module.** New `daily.ts` with `getCurrentDrop`, `getNextDrop`, `scheduleEpisode`, `openExpired`, `closeExpired`. Episodes carry `dropsAt`, `closesAt`, and `status` (draft/live/closed). A `by_status_and_dropsAt` index drives all queries.
- **Cron-driven lifecycle.** `crons.ts` registers two 5-minute intervals: `openExpired` transitions draft→live when `dropsAt <= now`, `closeExpired` transitions live→closed when `closesAt <= now`.
- **Mercy scenes modeled.** Churchill demo has 5 investigation + 2 mercy scenes (Chartwell garden 1930s, Downing Street annexe July 1945). `isMercy` flag on each scene.
- **Client mercy gating.** `index.tsx` filters mercy scenes from the visible rail and the "Unlock next memory" button unless the run is solved or exhausted. Wrong-guess auto-advance also skips mercy scenes.
- **Countdown wired to daily.** `IdentityCountdown` receives `dropsAt` from `daily.getNextDrop` (or `closesAt` from the current drop). Replaces the hardcoded `EPISODE_EPOCH_MS` midnight countdown.
- **Episode numbering.** Switched from `activeAt`-epoch day math to slug-derived episode number for the result share card.
- **Tests.** `daily.test.ts` covers getCurrentDrop, getNextDrop, openExpired, closeExpired, scheduleEpisode validation. `mercy.test.ts` covers mercy scene presence, investigation flag integrity, and backend scene-entry permissiveness.

**Remaining gaps to attack next:**
1. Full deletion pass: remove `episodes.figureName`, `episodes.answerOptions`, `episodes.isActive`, and `ensureDemoEpisode` once the catalog staging path exists.
2. GPT Image 2 generation/staging pipeline (`catalog.ts`).
3. Three.js WebView 360 viewer (deferred per confirmed direction).

### 2026-06-04 — Slice 3 (Venice AI episode pipeline) landed
AI-powered episode generation with dynamic scene images:

- **Catalog pipeline.** New `catalog.ts` with `stageFigure`, `createDraftEpisode`, `approveEpisode`, and `generateEpisode` action. Full staging→review→draft workflow with episode status lifecycle (staging/review/draft/live/closed).
- **Venice AI integration.** `generateEpisode` action calls Venice AI for structured scene briefs (JSON) and panorama image generation. Images stored in Convex file storage with URLs cached on scene records.
- **Scene image regeneration.** `regenerateScene` action allows re-generating individual scene images without touching the rest of the episode.
- **Schema updates.** Added `imageUrl` field to scenes, `staging` and `review` statuses to episodes.
- **Frontend dynamic images.** `getSceneImageSource` now accepts `imageUrl` to render AI-generated scenes alongside bundled fallbacks. `CinematicHero`, `PanoramaScene`, and `MemoryMediaStrip` all support dynamic image URLs.
- **Tests.** `catalog.test.ts` covers stageFigure idempotency, createDraftEpisode, approveEpisode validation, and getStagingQueue ordering.
- **Bug fix.** Corrected `internal.query` → `internalQuery` for internal query definitions (convex-test compatibility).

### 2026-06-05 — Slice 4 (Curator dashboard + smoke test) landed
Web-first curator UI for reviewing and approving AI-generated episodes:

- **Curator dashboard.** New `/curator` route with staging queue listing, expandable episode cards, scene thumbnails with regenerate buttons, and episode approval flow.
- **Generate form.** UI to select a figure from the catalog, enter a slug, and trigger `generateEpisode` action.
- **Episode detail query.** New `catalog.getEpisodeDetail` query returns full episode data including all scene fields (title, location, era, palette, panoramaPrompt, imageUrl, clues, isMercy).
- **Smoke test script.** `scripts/smoke-test-catalog.ts` validates the full pipeline end-to-end: stage figure → generate episode → verify review status → approve → verify draft status. Run with `bun run smoke:test`.
- **Type cleanup.** Removed `as { imageUrl?: string }` casts in `index.tsx` — the type already includes `imageUrl` from the schema.

### 2026-06-05 — Slice 5 (Immersion polish) landed
Cinematic polish to make the daily loop feel finished:

- **Scene transitions.** New `SceneTransition` component wraps `PanoramaScene` with a blackout fade (300ms) → title card showing scene title/location/era (1200ms) → image reveal (400ms). Uses react-native-reanimated for smooth animations.
- **Post-solve identity reveal.** New `IdentityReveal` component shows a full-screen overlay when the player solves, displaying the figure's canonical name, era, region, and tags over a blurred backdrop of the solved scene image. Animated entrance with spring scale. "View your result" button dismisses to reveal the `ResultShareCard`.
- **Clue ledger.** New `ClueLedger` component shows a collapsible panel of all discovered clues grouped by scene. Tracks clues client-side when hotspots are opened, resets on episode change. Shows count of discovered vs total available clues.

**Remaining gaps to attack next:**
1. Run the smoke test end-to-end to validate the Venice pipeline in production.
2. Full deletion pass: remove legacy fields and `ensureDemoEpisode` once catalog staging is proven.
3. Three.js WebView 360 viewer (deferred).
4. Push notifications for episode drops and streak reminders.
5. Archive mode for past episodes with post-close historical profile unlock.

## Goal
Turn the current playable MVP into the WhoWare described in the GDD: a daily first-person historical identity mystery where players inhabit a historical figure, explore immersive scenes, and compete on a fair global leaderboard.

## Core Direction
WhoWare is **not** a future-self transmission/journaling experience. The core fantasy is: **you wake up inside someone else's historical life and must figure out who you are.**

## Architecture Decisions
- Use the Bloom stack: Expo mobile client + Convex backend/database/storage/functions/auth.
- Treat the GDD's Supabase/Next.js/API-server tables as product intent, but implement the equivalent in Convex.
- Keep AI generation off the client. Episodes are staged/generated ahead of release, then served from Convex storage/CDN-style URLs.
- Do not send the answer to the client in leaderboard-qualifying daily runs.
- Build the 360 viewer in phases: first a convincing full-screen immersive prototype, then a Three.js WebView renderer with gyro/drag controls and hotspot dwell.

## Phase 0 — Re-align Current MVP Copy and UX
- [ ] Remove all meta/product-pipeline language from player-facing UI.
- [ ] Remove or rewrite any ambiguous “future transmission” language that conflicts with the historical-inhabitation premise.
- [ ] Keep useful additions already started: daily countdown, player leaderboard position, more immersive scene framing.
- [ ] Update app tone to: intimate, historical, investigative, embodied.

## Phase 1 — Daily Ritual Shell
- [ ] Add randomized global episode drop timestamps instead of midnight-only cadence.
- [ ] Show countdown to next global drop/release.
- [ ] Show today’s episode status: locked, live, solved, closed/profile unlocked.
- [ ] Add daily run state per player: guesses used, scenes unlocked, solvedAt, score, rank.
- [ ] Persist player identity locally/auth-backed so leaderboard position is stable.

## Phase 2 — Proper Guess + Leaderboard Model
- [ ] Replace free-text guesses with type-ahead historical figure search.
- [ ] Add curated `figures` table with searchable names, aliases, era, region, tier, tags.
- [ ] Validate guesses server-side against `figureId`, not raw name.
- [ ] Enforce five guesses per daily episode server-side.
- [ ] Lock in first correct solve; no re-guessing to improve rank.
- [ ] Rank by score multiplier/scenes used and solved time.
- [ ] Show live top ten, total correct solves, and current player's rank.

## Phase 3 — Scene Unlocking and Mercy Flow
- [ ] Model scenes 1–5 as leaderboard-eligible investigation scenes.
- [ ] Model scenes 6–7 as mercy unlocks after all guesses are exhausted.
- [ ] Add voluntary “look further” action that unlocks the next scene without spending a guess.
- [ ] Let players revisit unlocked scenes via a bottom scene drawer/map.
- [ ] Prevent fetching locked scenes from the client.

## Phase 4 — Immersive Panorama Prototype
- [ ] Create full-screen scene route with minimal HUD and fade-out chrome.
- [ ] Build a placeholder panorama mode using current scene cards/assets while real 360 assets are absent.
- [ ] Add cinematic scene transitions: fade to black, short ambient sting placeholder, then next scene.
- [ ] Add hotspot cards with contextual observations, never answer-revealing copy.
- [ ] Track hotspot discovery count per scene.

## Phase 5 — Three.js WebView Viewer
- [ ] Build long-lived WebView renderer hosting Three.js.
- [ ] Render equirectangular panoramas on an inverted sphere.
- [ ] Bridge RN → WebView scene URLs, hotspot coordinates, control mode.
- [ ] Bridge WebView → RN hotspot dwell/tap, scene loaded, render errors.
- [ ] Add drag pan fallback.
- [ ] Add gyroscope mode with Expo sensors where supported.
- [ ] Add low-res placeholder texture followed by full-res WebP swap.

## Phase 6 — Episode Generation/Staging Pipeline
- [ ] Add curator/admin-only Convex functions for staging figures and episodes.
- [ ] Generate scene briefs with Claude/OpenAI-compatible structured JSON.
- [ ] Generate or ingest panorama/detail image assets ahead of time.
- [ ] Store assets in Convex file storage initially; migrate to external object storage only if needed.
- [ ] Add quality-check status fields: draft, needsReview, approved, staged, live, closed.
- [ ] Add human review fields for historical profile and scene clues.

## Phase 7 — Retention Systems
- [ ] Add streaks for consecutive solved daily episodes.
- [ ] Add 30-episode seasons and difficulty arcs.
- [ ] Add archive mode for past episodes with no global leaderboard impact.
- [ ] Add post-close historical profile unlock.
- [ ] Add Socratic hint system with cached per-episode hints.
- [ ] Add push notifications for episode drops and streak reminders.

## Phase 8 — Monetization-Ready Structure
- [ ] Keep daily episode free.
- [ ] Prepare archive access gates and coin ledger.
- [ ] Add entitlement model compatible with RevenueCat later.
- [ ] Ensure hints never affect daily leaderboard fairness unless explicitly marked.

## Immediate Next Implementation Order
1. Clean up current copy/theme so the app matches the GDD exactly.
2. Refactor backend schema toward `figures`, `episodes`, `scenes`, `userEpisodes`, and `leaderboard`.
3. Implement server-side guess validation with figure IDs and five-guess enforcement.
4. Implement daily countdown, player rank, and top-ten leaderboard properly.
5. Build the full-screen immersive scene route before the full Three.js renderer.
6. Add generation/staging tools once the playable daily loop is correct.

## Focus Plan — GPT Image 2 Immersive Memory Sequence

### Goal
Replace the current text-described “places” with actual generated visual memories. A daily run should feel like a sequence of first-person immersive experiences, where every extra memory, hotspot, clue, and second spent reduces leaderboard advantage.

### Product Principle
The player is rewarded for recognizing the historical identity with the least assistance:

1. **Unassisted solve** — best possible score; player guesses from only the daily ritual prompt or very minimal atmospheric setup.
2. **Memory-assisted solve** — each generated immersive memory viewed reduces score.
3. **Clue-assisted solve** — each hotspot/detail inspected reduces score further.
4. **Time pressure** — longer solve time breaks ties and optionally applies a gradual score decay.
5. **Mercy/learning mode** — after leaderboard eligibility is lost, the app can reveal more direct clues and the historical profile.

### Proposed Player Flow
1. **Daily threshold screen**
   - Minimal copy: “You wake up inside another life.”
   - Show global countdown/status and “Guess now” for unassisted attempts.
   - No full leaderboard or all mechanics on the first screen.
2. **Memory 1: visual first-person scene**
   - Generated GPT Image 2 panorama/detail image shown full-screen.
   - Minimal HUD, hidden chrome, ambient “body memory” copy.
   - Player can guess or unlock the next memory.
3. **Memory 2–5: escalating context**
   - Each memory is a distinct generated scene from the figure’s life.
   - Earlier scenes are subtle; later scenes become more identifying.
   - Hotspots reveal inspectable visual details without naming the answer.
4. **Guess interstitial**
   - Guessing is available after each stage, but not as the entire home screen.
   - Server records the exact assistance state: memories viewed, hotspots opened, clue tier reached, elapsed time.
5. **Resolution**
   - Correct: identity locks, score/rank shown, historical profile unlocked.
   - Incorrect/exhausted: unlock mercy memories/profile without leaderboard improvement.

### Backend Data Model Direction
Move from embedding full scene arrays on `episodes` toward separate operational tables:

- `figures`
  - canonical name, aliases, era, region, tags, difficulty, source notes.
- `episodes`
  - figureId, activeAt, status, difficulty, scoring config, release metadata.
- `episodeScenes`
  - episodeId, order, assistanceTier, title, firstPersonBrief, imagePrompt, imageStorageId, imageUrl cache, generationStatus, reviewStatus.
- `sceneHotspots`
  - sceneId, x/y position, label, observation, clueWeight, revealTier.
- `playerRuns`
  - episodeId, player/user identity, startedAt, solvedAt, completedAt, status, score, memoriesViewed, hotspotsOpened, guessesUsed.
- `playerSceneViews`
  - runId, sceneId, firstViewedAt.
- `playerHotspotViews`
  - runId, hotspotId, firstViewedAt.
- `guesses`
  - runId, episodeId, figureId guess, isCorrect, guessedAt, assistance snapshot.

### GPT Image 2 Generation Pipeline
Keep generation server-side and pre-release:

1. **Scene brief creation**
   - Generate structured JSON for five memories: setting, camera perspective, objects, historical constraints, forbidden reveal terms, hotspot candidates.
2. **Image prompt hardening**
   - Convert each brief into a GPT Image 2 prompt optimized for immersive first-person viewing.
   - Include: period accuracy, embodied perspective, no portraits of the answer, no readable names, no anachronisms, no direct identity text.
3. **Image generation action**
   - Convex action calls GPT Image 2/OpenAI image API.
   - Store resulting image Blob in Convex file storage.
   - Save `imageStorageId`, generation metadata, and review status.
4. **Review gate**
   - Admin/curator approves generated images before an episode can go live.
   - Failed generations can be regenerated per scene without touching the rest of the episode.
5. **Client delivery**
   - Public queries return only unlocked scene metadata and signed image URLs.
   - Locked scenes, answer data, and future reveal tiers stay server-side.

### Image Format Decision
Implementation can start with generated immersive stills, then upgrade to true 360 panoramas:

- **Phase A: Cinematic immersive stills**
  - Faster, cheaper, reliable on mobile.
  - Use full-screen `expo-image`, parallax/pan/zoom, hotspot overlays.
- **Phase B: Wide pseudo-panorama**
  - Generate 16:9 or 2:1 scenes, add drag-to-pan crop window.
- **Phase C: True equirectangular panorama**
  - Use Three.js WebView inverted sphere once the data/scoring loop is stable.

### Scoring Model Draft
Use deterministic server-side scoring at first correct solve:

```text
baseScore = 10000
memoryPenalty = memoriesViewed * 1200
hotspotPenalty = hotspotsOpened * 250
guessPenalty = (guessesUsed - 1) * 600
timePenalty = floor(secondsElapsed / 10) * 10
score = max(0, baseScore - memoryPenalty - hotspotPenalty - guessPenalty - timePenalty)
```

Ranking order:
1. Higher score.
2. Fewer memories viewed.
3. Fewer hotspots opened.
4. Fewer guesses used.
5. Faster solvedAt - startedAt.

### Implementation Phases

#### Phase 1 — Flow refactor before image generation
- [x] Split the single scrolling home screen into a daily shell plus full-screen memory route.
- [x] Add a “guess now” path before memory assistance.
- [x] Move leaderboard/rules below the core run or behind a results panel.
- [x] Track local run start time and selected assistance stage in the UI.

#### Phase 2 — Server-side run state and scoring
- [x] Add `playerRuns`, `playerSceneViews`, and `playerHotspotViews` tables.
- [x] Add mutations for `startRun`, `viewScene`, `openHotspot`, and `submitGuess`.
- [x] Compute score on the server from stored assistance/time data.
- [x] Update leaderboard to rank by score, assistance, and elapsed time.

#### Phase 3 — Asset-backed scenes
- [x] Extend scene data with `imageStorageId` / image URL fields.
- [x] Add video-ready media metadata (`mediaKind`, `motionPrompt`, `detailImageKeys`) while keeping the first playable version still-image based.
- [x] Replace synthetic gradient panorama cards with real image-backed immersive scenes.
- [x] Keep text prompts/admin fields out of public player queries unless needed.
- [x] Add fallback display for scenes whose image is still pending review.
- [x] Add cinematic detail plates over existing image assets so every memory feels richer before true generated video is introduced.

#### Phase 4 — GPT Image 2 episode generation
- [ ] Add internal/admin Convex action for generating scene images with GPT Image 2.
- [ ] Store generated images in Convex file storage.
- [ ] Add generation status and error fields per scene.
- [ ] Add review/approve/regenerate mutations.

#### Phase 5 — Immersion polish
- [ ] Add scene transition: blackout → memory title → image fades in.
- [ ] Add optional ambient sound hooks later, not in the first pass.
- [ ] Add hotspot discovery animation and clue ledger.
- [ ] Add post-solve identity reveal/profile screen.

### Key Decisions To Confirm Before Execution
- Whether the first production pass should use cinematic stills or true 360 equirectangular panoramas.
- Whether players may guess before seeing any generated image, preserving the “unassisted” maximum score.
- Whether leaderboard identity should remain player-name based for now or switch to auth-backed runs before scoring matters.
- Whether GPT Image 2 generation should be exposed through an admin-only app screen or only internal Convex functions initially.

### Confirmed Direction — 2026-04-30
- Prioritize the most immersive feasible first pass: **image-backed memory experiences**, with a path toward true 360 panoramas.
- Do **not** allow a leaderboard guess before at least one memory is experienced.
- Recommended execution order:
  1. Build the sequence/run model so the app is no longer one all-initial-screen experience.
  2. Replace gradient/descriptive cards with generated image-backed memory scenes.
  3. Add server-side scoring based on memories viewed, clues opened, guesses used, and elapsed time.
  4. Add GPT Image 2 generation/staging tools once the scene delivery model is ready.
- Use internal Convex generation/admin functions first; add a polished admin UI only after the pipeline works.
- Start with immersive wide/pseudo-panorama scenes if needed for reliability, but design schema and viewer APIs so true equirectangular 360 assets can drop in later.

## Notes
- First execution pass added five GPT Image 2 wide/pseudo-panorama memory assets, a gated daily shell → memory sequence, hotspot assistance tracking in the UI, local score previews, and score-aware leaderboard rendering.
- Backend schema/functions have been prepared with optional scene image keys and score fields, but the durable `playerRuns` tables and server-authoritative run mutations are still the next major backend step.
- The current MVP is useful as a gameplay skeleton, but the next work should prioritize product truth over technical spectacle: the player must feel like they are inside a historical person's life before we invest heavily in the final renderer.
- The Three.js/WebView viewer is critical, but it should sit behind a stable episode/guess/leaderboard model.
- For this next iteration, prioritize **generated visual memory + scoring truth** over building the final 360 renderer immediately.
