# WhoWare

**Daily embodied history ritual.** Someone changed history from this room — can you name them?

WhoWare is a daily history guessing game where you step into panoramic memory scenes, inspect contextual clues, and identify the historical figure before your guesses run out. Think Wordle meets immersive history.

## How it works

- **Daily episodes** — one new historical figure per day, across three difficulty tiers (iconic, field, research)
- **Panoramic memory scenes** — visually rich environments with interactive clue hotspots
- **AI-powered hints** — Venice AI generates privacy-preserving hints that guide without spoiling
- **Scoring by restraint** — highest scores go to players who guess with fewer memories, clues, and time
- **On-chain verification** — score NFTs and streak tokens minted on Mantle Sepolia for tamper-proof leaderboards

## Architecture

```
whoware/
├── apps/default/          # Expo app (iOS, Android, Web)
├── packages/backend/      # Convex backend (game state, auth, AI, oracle)
├── packages/contracts/    # Solidity contracts (Mantle Sepolia)
└── assets/                # Shared images & fonts
```

- **Frontend:** Expo + React Native + StyleSheet
- **Backend:** Convex (real-time DB, auth, serverless actions)
- **Blockchain:** Mantle Sepolia (EVM) — Score NFTs, Streak SBTs, commit-reveal guessing
- **Payments:** Polygon Amoy — USDC archive paywall with on-chain verification (x402-inspired)
- **AI:** Venice AI (privacy-preserving hint generation)
- **Wallet:** MetaMask Smart Accounts (ERC-7715 delegation)

## Smart Contracts (Mantle Sepolia)

| Contract | Address |
|----------|---------|
| WhoWareScore | `0xd6ad76bed934ea5e5b25d635fba7889e782e691a` |
| WhoWareStreak | `0x6c82cc64c3c5c5f25766c77a41b78aa1f622cbbb` |
| WhoWareGuess | `0x8185762f72a6290eb4959adbd8286281131a531d` |

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
- `PAYWALL_TREASURY_ADDRESS` — Ethereum address that receives USDC payments for archive unlocks
- `POLYGON_AMOY_RPC_URL` — Optional custom RPC URL for Polygon Amoy (defaults to public RPC)

### 3. Run the app

```bash
# Terminal 1: Backend
cd packages/backend && bun run dev

# Terminal 2: App
cd apps/default && bun run start
```

### 4. Test contracts

```bash
cd packages/contracts && bun install && bun run test
```

## Hackathon Submissions

Built for dual submission — all code features complete (Slices 1–9). Submission assets in progress:

### MetaMask x 1Shot API x Venice AI Dev Cook Off
**Tracks:** Autonomous Agent · Venice AI · x402

| Feature | Status |
|---------|--------|
| Autonomous episode pipeline (`catalog.generateEpisode`) | ✅ |
| Venice AI scene generation + Socratic hints | ✅ |
| MetaMask Smart Account (ERC-7715 delegation) | ✅ |
| x402 archive paywall (USDC on Polygon Amoy) | ✅ |

### Mantle Turing Test Hackathon 2026 — Phase 2
**Track:** Consumer & Viral DApps

| Feature | Status |
|---------|--------|
| Soul-bound Score NFT (EIP-712 oracle-signed) | ✅ |
| Soul-bound Streak SBT (tier badges: spark → eternal) | ✅ |
| Commit-reveal guessing | ✅ |
| On-chain mint wired into solve flow | ✅ |

### Submission Assets

- Demo script: [`plans/demo-script.md`](./plans/demo-script.md)
- Devpost drafts: [`plans/devpost-drafts.md`](./plans/devpost-drafts.md)
- Hackathon plan: [`plans/hackathon-submissions.plan.md`](./plans/hackathon-submissions.plan.md)
- Demo video: [VIDEO_URL]
- Live demo: [DEPLOYMENT_URL]

## License

MIT
