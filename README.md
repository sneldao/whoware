# WhoWare

**Daily embodied history ritual.** Someone changed history from this room — can you name them?

> **Live demo:** https://whoware-lhlw4wcza-snel.vercel.app
> **3D roadmap:** see [`3D-PLAN.md`](./3D-PLAN.md)
> **Treasury wallet:** see [`TREASURY.md`](./TREASURY.md)

WhoWare is a daily history guessing game where you step into a 3D memory scene, walk through it, inspect props for clues, and identify the historical figure before your guesses run out. Think Wordle meets an explorable history museum.

## How it works

- **Daily episodes** — one new historical figure per day, across three difficulty tiers (iconic, field, research)
- **3D memory scenes** — the AI-generated panorama becomes a skybox the player looks around inside; props anchored to the scene brief appear as 3D objects the player walks between
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
│   │   │   ├── views/                          # Composable views (PlayingView, SolvedView, IntroView, ExhaustedView, HeroPanel, HistoryCard, LastSolveCard)
│   │   │   │   └── props.ts                    # Composite prop shapes shared across views
│   │   │   └── scene-3d/                       # Three.js renderer (skybox, props, lighting, controls)
│   │   ├── shared/                             # Cross-section primitives (error-boundary, tappable-metric)
│   │   └── curator/                            # Curator Studio + weekly leaderboards
│   ├── hooks/                                  # Session, guessing, scene progression, smart-account delegate, mint, boot-error, streak
│   ├── lib/                                    # Cross-cutting helpers
│   │   ├── theme.ts                            # Single source of truth for design tokens
│   │   ├── logger.ts                           # Structured logger (console in dev, no-op debug/info in prod)
│   │   ├── contracts.ts                        # On-chain addresses (Mantle Sepolia, Polygon Amoy)
│   │   ├── scoring.ts (re-export from backend)
│   │   ├── scene-quality.ts                    # 3D capability detection / adaptive fallback
│   │   ├── paywall.ts, wallet.ts, smart-account.ts, 1shot.ts, onboarding.ts
│   └── assets/                                 # Static images
├── packages/backend/                            # Convex backend
│   ├── convex/                                 # Functions, schema, agent pipeline, AI fallback
│   └── scripts/                                # Smoke tests, helpers
├── packages/contracts/                          # Solidity contracts (Hardhat + viem)
└── 3D-PLAN.md                                   # Phase roadmap for the 3D pivot
```

- **Frontend:** Expo + React Native + StyleSheet; Three.js for the 3D scene renderer (web-only at first)
- **Backend:** Convex (real-time DB, auth, serverless actions, AI pipeline)
- **Blockchain:** Mantle Sepolia (EVM) — score NFTs, streak SBTs, commit-reveal guessing
- **Payments:** Polygon Amoy — USDC archive paywall with on-chain verification
- **AI:** Venice AI primary (chat + image); Replicate fallback (Flux for images, Llama 3 70B for chat)
- **Wallet:** MetaMask Smart Accounts (ERC-7710 delegation) + 1Shot permissionless relayer

## 3D scene composition

The 3D scene is rendered by `apps/default/components/who-ware/scene-3d/SceneCanvas.tsx`. Each memory is composed of:

1. **Skybox** — the AI-generated panorama image mapped onto the inside of a sphere (`SphereGeometry` with `BackSide` rendering). The player sits at the origin and can drag to look around.
2. **Lighting rig** — three-point lighting (ambient + key + fill) sourced from the scene brief's `lighting` block, with a cinematic default when the AI doesn't supply one.
3. **Props** — 4–8 3D objects per scene from a closed vocabulary of 51 kinds (room, furniture, era, doc, object). Phase 2 uses procedural primitives (boxes/cylinders/spheres composed to evoke the real object); Phase 3 will swap hero props for Tripo GLBs.

`apps/default/lib/scene-quality.ts` decides whether to render the 3D or 2D path per client (WebGL2 capability, low-power GPU detection, user override). The 2D `PanoramaScene` remains the fallback.

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
