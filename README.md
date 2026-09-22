# WhoWare

**Daily embodied history ritual.** Someone changed history from this room — can you name them?

> **Live demo:** https://whoware.vercel.app
> **3D roadmap:** see [`3D-PLAN.md`](./3D-PLAN.md)
> **On-chain vision:** see [`ONCHAIN-VISION.md`](./ONCHAIN-VISION.md)
> **Treasury wallet:** see [`TREASURY.md`](./TREASURY.md)

WhoWare is a daily history guessing game where you step into a 3D memory scene, walk through it, inspect props for clues, and identify the historical figure before your guesses run out. Think Wordle meets an explorable history museum.

## How it works

- **Immersion-first entry** — cold start lands in today's room behind a case plate (episode number, difficulty tier, live "collapses in" countdown, streak-at-risk flame when a run is on the line). A single **Enter** drops you into the room. Sound is a top-right toggle (hydrates from your saved preference), not a fork in the entry path. Web players can also flip a "3D" chip to enter the immersive 3D room instead of the default 2D scene.
- **Where you left off** — returning mid-run players get a dismissible Case File recap (scenes opened, clues found, guesses left, last proximity) instead of a silent drop into the room
- **Daily episodes** — one new historical figure per day, across three difficulty tiers (iconic, field, research); research-tier days coach first-timers so a hard figure never reads as a bug
- **2D scenes by default, 3D as opt-in** — the AI-generated panorama renders as a single high-resolution image on the default path. On web, players can opt into the Three.js 3D room (skybox sphere, procedural props, drag-to-look) via the "3D" chip on the entry gate. Mobile keeps 2D only.
- **The figure has a voice (v0.3)** — every clue opens with a paired quote from the figure in the room, reacting to the prop in first-person. Generated at curation time by a deterministic template engine (`packages/backend/convex/figureVoice.ts`) that composes from the figure's tags, era, and region — no LLM cost.
- **The Witness Chamber (v0.4)** — when the puzzle target has related figures in the catalog, the figure in the room is *someone who knew the target* (a student, a tutor, a rival). The room-figure speaks about the target in relational first-person ("She gave me this to learn on"); solving identifies the absent one. The reveal acknowledges: "<room-figure> nods slowly." before the target name typewriters in. Episodes without related figures fall back to v0.3 behavior (the room-figure is the target).
- **Player vocabulary** — three words: **scene · clue · guess**. The room holds a scene with clues; you read clues and guess.
- **Guess budget** — 8 guesses, 2 hints per run (formerly 5 / uncapped). Wrong guesses read as prose feedback ("Hypatia lived around the same century — close, but not the one") rather than colored badges.
- **Live score ceiling** — the HUD shows a client-side projection of `computeScore` ticking every second ("if I name them right now, I score this"), so every scene opened, clue inspected, hint spent, and wrong guess visibly bleeds the ceiling. Guesses are two-tap commits — no mis-tap burns a guess.
- **Sparse play HUD** — ceiling/evidence/guesses pips stay as a floating overlay; denser panels open only for the guess panel or the evidence log. Phone-column chrome returns after the reveal.
- **Deduction log** — each guess lands as a row in a server-persisted log (`runs.getRunGuesses`); the proximity prose is the record, not a fading toast. The board survives reloads.
- **The verdict lands in the room** — on solve/exhaust the room holds ("Identity anchored…" / "The signal fades…"), then the reveal plays *over the room* — typewriter name, narrative summary. Witness Chamber episodes prepend an acknowledgment line from the room-figure ("Synesius of Cyrene nods slowly."). No confetti on a loss; only after the player continues does the column shell return; exhausted runs get a closest-call salvage line and an honest streak-fate note (freeze absorbs one miss).
- **Return ritual** — one-tap "Remind me" push opt-in plus a spoiler-free "Tomorrow's room: era · region" teaser on the countdown card
- **Portable identity** — play is anonymous by default (a local investigator UUID). Connecting a wallet links the identity, and a fresh device that connects the same wallet adopts the existing identity (streak + history follow the player)
- **Atmosphere** — optional ambient bed on Enter with sound (ducks under clue SFX); hovering a prop shows an "Inspect" tooltip while ~180 dust motes drift through the room. Wrong guesses are graded by ear: a rising fifth when you're warm, a sinking saw when you're cold, a low knell when the last guess is spent
- **Evidence, not popups** — clue payoffs open as numbered exhibits ("CLUE 01") with a censor-bar declassification beat; the figure's quote appears as a quote-block (italic parchment, accent border) beneath the artifact description
- **AI-powered hints** — Venice AI generates privacy-preserving hints that guide without spoiling
- **Scoring by restraint** — highest scores go to players who guess with fewer scenes, clues, and time; every solve earns a detective grade that lands on the share card and in the share text alongside the score
- **On-chain verification** — score NFTs and streak tokens minted on Mantle Sepolia for tamper-proof leaderboards
- **x402 archive paywall** — closed episodes' rich content (scenes, hotspots, ambient text) unlocks via USDC payment on Polygon Amoy, verified on-chain. Episode summaries (figure name, era, region, difficulty, tags, scene count) are freely accessible to any visitor.

## Architecture

```
whoware/
├── apps/default/                                # Expo app (iOS, Android, Web)
│   ├── app/                                     # Routes (Expo Router)
│   ├── components/
│   │   ├── who-ware/                           # Game-screen UI
│   │   │   ├── immersion-threshold.tsx         # Live-room entry gate (case plate, countdown, sound choice)
│   │   │   ├── immersion-session.tsx           # Full-bleed active run (room + HUD)
│   │   │   ├── case-file-recap.tsx             # "Where you left off" overlay for mid-run returns
│   │   │   ├── play-chrome.tsx                 # Overlay / stacked play chrome
│   │   │   ├── views/                          # SolvedView, ExhaustedView, HeroPanel, PlayingView, HistoryCard
│   │   │   │   └── props.ts                    # Composite prop shapes shared across views
│   │   │   └── scene-3d/                       # Three.js renderer (skybox, props, lighting, controls)
│   │   ├── shared/                             # Cross-section primitives (error-boundary, tappable-metric)
│   │   └── curator/                            # Curator Studio + weekly leaderboards
│   ├── hooks/                                  # Session, guessing, sounds/ambient, scene progression, mint, boot-error
│   ├── lib/                                    # Cross-cutting helpers
│   │   ├── immersion-shell.tsx                 # Web full-bleed flag (drops 560px column during play)
│   │   ├── theme.ts, logger.ts, contracts.ts, site.ts, scene-quality.ts, onboarding.ts
│   │   └── paywall.ts, wallet.ts, smart-account.ts, 1shot.ts, inco-lightning.ts
│   └── assets/                                 # Static images
├── packages/backend/                            # Convex backend
│   ├── convex/                                 # Functions, schema, agent pipeline, AI fallback
│   │   ├── figureVoice.ts                      # v0.3 self-voice + v0.4 relational-voice template engine
│   │   └── migrations.ts                       # Idempotent backfills: hintsUsed, figureQuote, roomFigureId
│   └── scripts/                                # Smoke tests, helpers
├── packages/contracts/                          # Solidity contracts (Hardhat + viem)
├── 3D-PLAN.md                                   # Phase roadmap for the 3D pivot
└── HACKWITHUS.md                                # Hack with Us / Tiun submission notes
```

- **Frontend:** Expo + React Native + StyleSheet; Three.js for the 3D scene renderer (web-only at first)
- **Backend:** Convex (real-time DB, auth, serverless actions, AI pipeline)
- **Blockchain:** Mantle Sepolia (EVM) — score NFTs, streak SBTs, commit-reveal guessing
- **Confidential on-chain:** Base Sepolia via Inco Lightning — encrypted guessing with `e.eq` on-chain, single-tx submission, provably fair settlement
- **Payments:** Polygon Amoy — USDC archive paywall with on-chain verification
- **AI:** Venice AI primary (chat + image); Replicate fallback (Flux for images, Llama 3 70B for chat)
- **Wallet:** MetaMask Smart Accounts (ERC-7710 delegation) + 1Shot permissionless relayer

## 3D scene composition

The 3D scene is rendered by `apps/default/components/who-ware/scene-3d/SceneCanvas.tsx`. Each memory is composed of:

1. **Skybox** — the AI-generated panorama image mapped onto the inside of a sphere (`SphereGeometry` with `BackSide` rendering). The player sits at the origin and can drag to look around.
2. **Lighting rig** — three-point lighting (ambient + key + fill) sourced from the scene brief's `lighting` block, with a cinematic default when the AI doesn't supply one.
3. **Props** — 4–8 3D objects per scene from a closed vocabulary of 51 kinds (room, furniture, era, doc, object). Phase 2 uses procedural primitives (boxes/cylinders/spheres composed to evoke the real object); Phase 3 will swap hero props for Tripo GLBs.

**Renderer default is 2D (v0.4).** `apps/default/lib/scene-quality.ts` returns `"panorama"` for every client unless the player explicitly opts in via the "3D" chip on the entry gate (web only — 3D is not surfaced on mobile). The opt-in writes a localStorage override; the renderer reads it on every visit. Mobile keeps the 2D `PanoramaScene` only. The 3D renderer code is still shipped and tested (`scene-3d-skybox.test.ts`); it just isn't reached by default.

## First-run immersion

Cold path (web):

1. **Threshold** — today's scene 0 already running full-bleed behind the case plate (episode · difficulty · collapse countdown), WhoWare + tagline, and a single **Enter** button. Sound is a top-right toggle; the "3D" chip on the threshold lets web players opt into the 3D room. "How to play" links to `/how-to` without leaving the cold path.
2. **Wake** — `ensureRun` + `enterScene(0)`; ambient bed starts only when sound is enabled; onboarding flag persisted.
3. **ImmersionSession** — same full-bleed room; whisper/coach until first clue, Guess, or ~12s; every scene change whispers the scene's title inside the room. Clues open as numbered exhibits paired with a quote from the figure.
4. **PlayChrome overlay** — ceiling + evidence + guesses metrics; scene rail + actions; clue/guess sheet expands on demand; tapping the Guesses metric opens the guess panel directly.
5. **Solve / exhaust** — restore the phone-column shell (`HeroPanel` + SolvedView / ExhaustedView). Witness Chamber reveals prepend the room-figure's acknowledgment before the target name.

`lib/immersion-shell.tsx` drops the 560px web column while threshold or an active run is up. Returning mid-run players skip the threshold and land HUD-over-room with chrome unlocked, plus a one-time **Case File recap** ("Where you left off") until they resume or dismiss it.

Progressive coaches (one-shot, AsyncStorage) fire at the moment of need: first wrong guess, first "Next scene," first open of Guess, and entering a research-tier day. Optional full rules live at `/how-to` — never on the cold path.

Desktop shortcuts while in the room: `Esc` close sheets · `G` Guess · `N` next scene · `1`–`9` scene rail. A wrong guess soft-pulses **Next scene** instead of auto-advancing. After solve/exhaust, the room holds for the reveal and stays up until it's dismissed.

## Smart Contracts (Mantle Sepolia)

| Contract | Address |
|----------|---------|
| WhoWareScore | `0xd6ad76bed934ea5e5b25d635fba7889e782e691a` |
| WhoWareStreak | `0x6c82cc64c3c5c5f25766c77a41b78aa1f622cbbb` |
| WhoWareGuess | `0x8185762f72a6290eb4959adbd8286281131a531d` |
| WhoWareOracle | `0xfb8a7B42070334CB196e94E542cEA13655e2f394` |

> **DRY note:** these addresses are the single source of truth in
> `apps/default/lib/contracts.ts`. The table above mirrors that file —
> if a deployment address changes, update `contracts.ts` first (so the
> hook layer, the Convex backend, and any future caller all see the new
> value), then regenerate this table. `contracts.test.ts` pins the
> addresses as a regression guard.

- **WhoWareScore** — Soul-bound score NFT, oracle-signed via EIP-712, non-transferable
- **WhoWareStreak** — Soul-bound streak token with tier badges (spark/flame/inferno/eternal)
- **WhoWareGuess** — Commit-reveal scheme for fair competitive play

## Confidential On-Chain Guessing (Base Sepolia via Inco Lightning)

| Contract | Address |
|----------|---------|
| WhoWareConfidentialGuess | `0xd6ad76bed934ea5e5b25d635fba7889e782e691a` |

- **Chain:** Base Sepolia (chainId 84532)
- **How it works:** The figure ID is encrypted on-chain as an `euint256` using Inco Lightning's TEE-based encrypted computation. Players submit a single encrypted guess; the contract checks `e.eq(encryptedGuess, encryptedAnswer)` producing an encrypted `ebool`. At episode close, `e.reveal` makes the result publicly verifiable — no commit-reveal, no salt, no timing attack surface.
- **Fallback:** When Inco is unavailable (native mobile, or contract not deployed), the legacy commit-reveal flow on Mantle Sepolia is used instead. The `useIncoGuess` hook checks `isIncoEnabled()` (contract address non-zero) and `isIncoPlatformSupported()` (browser + wallet) to determine which path to take.
- **Curator:** When an episode goes live, `inco.ts` (`setEpisodeAnswerOnChain`) encrypts the figure ID via `@inco/lightning-js` and calls `setAnswer(episodeDay, ciphertext)` on the contract. This is a no-op if the Inco env vars are not set.
- **Basescan:** https://sepolia.basescan.org/address/0xd6ad76bed934ea5e5b25d635fba7889e782e691a

## Getting Started

### 1. Install dependencies

```bash
bun install
```

> **Note:** the repo tracks `bun.lock` (bun is the single package manager).
> Vercel installs from it so dependency resolution matches local exactly.

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `CONVEX_DEPLOYMENT` / `EXPO_PUBLIC_CONVEX_URL` — Run `bunx convex dev` in `packages/backend/`
- `EXPO_PUBLIC_SITE_URL` — Canonical public origin for OG/Twitter tags (e.g. `https://whoware.vercel.app`)
- `DEPLOYER_PRIVATE_KEY` — Ethereum private key for oracle signing
- `VENICE_API_KEY` — Sign up at [venice.ai](https://venice.ai)
- `REPLICATE_API_TOKEN` — Sign up at [replicate.com](https://replicate.com) for the AI fallback chain
- `PAYWALL_TREASURY_ADDRESS` — Polygon Amoy address that receives 1 USDC payments for archive unlocks. The submission's live deployment uses a fresh wallet (`0x5Ebc0D556A4B6876673A37868D1f9120EEC63A9a`). See `TREASURY.md` for rotation.
- `POLYGON_AMOY_RPC_URL` — Optional custom RPC URL for Polygon Amoy (defaults to public RPC)
- `AGENTS_API_KEY` — Required bearer key for `POST /api/agents/pipeline` and `POST /api/agents/curator`. Set it on the Convex deployment; both endpoints fail closed (401) when it is missing.

### 3. Run the app

```bash
# Terminal 1: Backend
cd packages/backend && bun run dev

# Terminal 2: App
cd apps/default && bun run start
```

### 4. Test

Run tests from the repo root or per-package.

```bash
# Backend — Convex functions, AI pipeline, AI fallback, figure voice
cd packages/backend && npm test
# (16 suites: analytics, archive, catalog, daily, example, figureVoice
#  (v0.3/v0.4), mercy, notifications, paywall, practice, props,
#  relationships, runs, scene-3d-skybox, scoring, venice — includes the
#  answer-leak guard suites)

# Frontend — hooks, theme tokens, contract addresses, scoring-tooltip, logger
cd apps/default && npm test
# (7 suites: theme, contracts, scoring-tooltip, logger, use-guessing,
#  use-inco-guess, use-clue-insights)
# Run from app dir so vitest resolves Expo's tsconfig.base.

# Contracts — Hardhat
cd packages/contracts && bun install && bun run test
```

Both Vitest suites use the project's `vitest.config.ts` per package and
fail loudly on missing test fixtures or stale test output. The frontend
config lives at `apps/default/vitest.config.ts`; the backend suite runs
on the repo default.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/archive/:episodeId?identityId=` | Access check — returns `200` if unlocked, `402 Payment Required` with metadata |
| `GET /api/archive/:episodeId?detail=summary` | Free summary — returns `{ slug, difficulty, figureName, era, region, tags, sceneCount, blurb }` with `200`, no paywall check |
| `GET /api/agents/card` | A2A Agent Card manifest (Google A2A spec lite) |
| `POST /api/agents/pipeline` | Trigger autonomous episode generation pipeline (bearer key required — fails closed) |
| `POST /api/agents/curator` | Standalone curator agent — selects next figure from catalog (bearer key required — fails closed) |

**Answer-leak posture.** `daily.getCurrentDrop` returns scenes only — never the
figure, answer options, or reveal payload. Identity queries (bios,
relationships, episode detail, archive content, player history) are gated by
`revealGating.ts`: the answer is served only once the episode is closed or the
caller's run is solved/exhausted. Guess feedback (`runs.getRunGuesses`) is
scoped to the caller's own run and never includes the episode's figure.

## Core principles

These guide every change:

- **ENHANCEMENT FIRST** — extend existing components over creating new ones
- **CONSOLIDATION** — delete unnecessary code rather than deprecate
- **PREVENT BLOAT** — audit and consolidate before adding features
- **DRY** — single source of truth for shared logic
- **CLEAN** — clear separation of concerns with explicit dependencies
- **MODULAR** — composable, testable, independent modules
- **PERFORMANT** — adaptive loading, caching, and resource optimization
- **ORGANIZED** — predictable file structure with domain-driven design

## License

MIT
