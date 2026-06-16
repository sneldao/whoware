# WhoWare

**Daily embodied history ritual.** Someone changed history from this room — can you name them?

> **Live demo:** https://whoware-lhlw4wcza-snel.vercel.app
> **Demo walkthrough:** see [`DEMO.md`](./DEMO.md)
> **Treasury wallet:** see [`TREASURY.md`](./TREASURY.md)

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
- **Wallet:** MetaMask Smart Accounts (ERC-7710 delegation)

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

### 4. Test contracts

```bash
cd packages/contracts && bun install && bun run test
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/archive/:episodeId?identityId=` | Access check — returns `200` if unlocked, `402 Payment Required` with metadata |
| `GET /api/agents/card` | A2A Agent Card manifest (Google A2A spec lite) |
| `POST /api/agents/pipeline` | Trigger autonomous episode generation pipeline |
| `POST /api/agents/curator` | Standalone curator agent — selects next figure from catalog |

## Hackathon Submissions: MetaMask x 1Shot API x Venice AI

WhoWare is purpose-built to showcase the synergy between autonomous AI agents and advanced Web3 infrastructure.

### 1. Best Use of Venice AI (Privacy-First Agentic Intelligence)
WhoWare implements a sophisticated **6-stage autonomous pipeline** powered exclusively by Venice AI:
- **Autonomous Curator:** Analyzes recent episode history and the figure catalog to select the next figure that maximizes variety.
- **Scene Director:** Generates structured JSON for 7 atmospheric memory scenes with visual clues.
- **Adversarial Calibration:** A dedicated "Solver" agent tries to identify the figure from the clues; if too easy or hard, a "Rewriter" agent adjusts the clue subtlety.
- **Self-Evaluation:** A "Judge" agent reviews generated image prompts for era-accuracy and anachronisms before rendering.
- **Contextual Hints:** Socratic hints generated on-the-fly for players, maintaining privacy by never storing user queries.

### 2. Best x402 + ERC-7710 (Advanced Permissions)
WhoWare leverages the **MetaMask Smart Accounts Kit** for a seamless credentialing flow:
- **EIP-7702 Upgrade:** Users can upgrade their account to a Stateless Smart Account with one click.
- **ERC-7715 Advanced Permissions:** The app requests a delegation (ERC-7715) that allows our backend Oracle to mint the user's score NFT.
- **ERC-7710 Compliance:** Delegations are restricted by strict caveats (AllowedTargets, AllowedMethods, LimitedCalls) ensuring the user retains ultimate control.
- **x402 Archive Paywall:** The historical archive uses a `402 Payment Required` pattern, requiring a USDC transfer via 1Shot before granting access.

### 3. Best Agent / A2A Coordination
The backend is a **multi-agent orchestration layer**:
- Agents negotiate the difficulty of clues via a feedback loop.
- The Curator agent "hands off" the figure to the Director agent.
- Agent-to-Agent (A2A) coordination is demonstrated through the `autonomousGenerateEpisode` action which sequences multiple LLM calls with distinct roles.

### 4. Best Use of 1Shot Permissionless Relayer
- **Gasless USDC Payments:** The archive paywall uses 1Shot's public relayer to allow users to pay in USDC without needing MATIC for gas.
- **Operational Scalability:** 1Shot handles the operational capacity, ensuring the paywall remains responsive during usage spikes.

---

## Architecture


MIT
