# WhoWare

**Daily embodied history ritual.** Someone changed history from this room — can you name them?

> **Live demo:** https://whoware-lhlw4wcza-snel.vercel.app
> **3D roadmap:** see [`3D-PLAN.md`](./3D-PLAN.md)
> **On-chain vision:** see [`ONCHAIN-VISION.md`](./ONCHAIN-VISION.md)
> **Treasury wallet:** see [`TREASURY.md`](./TREASURY.md)

WhoWare is a daily history guessing game where you step into a 3D memory scene, walk through it, inspect props for clues, and identify the historical figure before your guesses run out. Think Wordle meets an explorable history museum.

## How it works

- **Immersion-first entry** — cold start lands in today's room (live panorama/3D behind Enter with/without sound), not a tutorial carousel or dashboard
- **Daily episodes** — one new historical figure per day, across three difficulty tiers (iconic, field, research)
- **3D memory scenes** — the AI-generated panorama becomes a skybox the player looks around inside; props anchored to the scene brief appear as 3D objects the player inspects
- **Sparse play HUD** — score/guesses stay as a floating overlay; denser panels open only when naming an identity or reviewing clues. Phone-column chrome returns after solve
- **Atmosphere** — optional ambient bed on Enter with sound (ducks under clue SFX); hard mute on Enter without
- **AI-powered hints** — Venice AI generates privacy-preserving hints that guide without spoiling
- **Scoring by restraint** — highest scores go to players who guess with fewer memories, clues, and time
- **On-chain verification** — score NFTs and streak tokens minted on Mantle Sepolia for tamper-proof leaderboards
- **x402 archive paywall** — closed episodes' rich content (scenes, hotspots, ambient text) unlocks via USDC payment on Polygon Amoy, verified on-chain. Episode summaries (figure name, era, region, difficulty, tags, scene count) are freely accessible to any visitor.

## Architecture

```
whoware/
├── apps/default/                                # Expo app (iOS, Android, Web)
│   ├── app/                                     # Routes (Expo Router)
│   ├── components/
│   │   ├── who-ware/                           # Game-screen UI
│   │   │   ├── immersion-threshold.tsx         # Live-room entry gate (sound choice)
│   │   │   ├── immersion-session.tsx           # Full-bleed active run (room + HUD)
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

`apps/default/lib/scene-quality.ts` decides whether to render the 3D or 2D path per client (WebGL2 capability, low-power GPU detection, user override). The 2D `PanoramaScene` remains the fallback.

## First-run immersion

Cold path (web):

1. **Threshold** — today's scene 0 already running full-bleed behind WhoWare + Enter with/without sound
2. **Wake** — `ensureRun` + `enterScene(0)`; ambient bed starts only for with-sound; onboarding flag persisted
3. **ImmersionSession** — same full-bleed room; whisper/coach until first clue, Name identity, or ~12s
4. **PlayChrome overlay** — metrics + scene rail + actions; clue/guess sheet expands on demand
5. **Solve / exhaust** — restore the phone-column shell (`HeroPanel` + SolvedView / ExhaustedView)

`lib/immersion-shell.tsx` drops the 560px web column while threshold or an active run is up. Returning mid-run players skip the threshold and land HUD-over-room with chrome unlocked.

Progressive coaches (one-shot, AsyncStorage) fire at the moment of need: first wrong guess, first “Unlock next memory,” first open of Name identity. Optional full rules live at `/how-to` — never on the cold path.

Desktop shortcuts while in the room: `Esc` close sheets · `G` Name identity · `N` next memory · `1`–`9` scene rail. A wrong guess soft-pulses **Next memory** instead of auto-advancing. After solve/exhaust, the room holds ~1.4s (“Identity anchored…”) before the phone-column ritual.

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
- `AGENTS_API_KEY` — Optional API key for `POST /api/agents/pipeline` auth (omit to skip auth)

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
# Backend — Convex functions, AI pipeline, AI fallback
cd packages/backend && npm test
# (88 tests across 12 suites: catalog, runs, daily, archive, paywall, props,
#  analytics, scene-3d-skybox, venice, notifications, mercy, example)

# Frontend — theme tokens, contract addresses, scoring-tooltip, logger
cd apps/default && npm test
# (23 tests across 4 suites: theme, contracts, scoring-tooltip, logger)
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
| `POST /api/agents/pipeline` | Trigger autonomous episode generation pipeline |
| `POST /api/agents/curator` | Standalone curator agent — selects next figure from catalog |

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
