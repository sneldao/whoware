# WhoWare — Devpost Submission Draft

## Project Title
**WhoWare — Daily Embodied History Ritual**

## Tagline
Step into panoramic memories. Name the figure who changed history from that room. Every guess is on-chain.

## Elevator Pitch (1-2 sentences)
WhoWare is a daily historical guessing game where players explore AI-generated panoramic memory scenes, inspect contextual clues, and identify the historical figure — with MetaMask Smart Accounts, Venice AI-generated content, gasless archive payments via 1Shot, and on-chain score verification on Mantle Sepolia.

## How it works
1. **Daily episode** — one new historical figure per day across three difficulty tiers
2. **Panoramic memory scenes** — Venice AI generates immersive 360° scenes with interactive clue hotspots
3. **Score by restraint** — highest scores go to players who guess with fewer memories opened
4. **MetaMask Smart Account** — users upgrade their EOA to a smart account (EIP-7702) for ERC-4337 account abstraction
5. **1Shot Permissionless Relayer** — gasless USDC payments for archive unlocks
6. **On-chain verification** — Score NFTs and streak tokens minted on Mantle Sepolia

## Which tracks are you applying for?

### MetaMask Smart Accounts Kit Track ($3,000)
- MetaMask Smart Accounts Kit (`@metamask/smart-accounts-kit` v1.6.0) integrated via `useSmartAccount` hook
- EIP-7702 upgrade upgrades the user's EOA to a Stateless7702 MetaMask Smart Account
- Smart account used for on-chain operations via ERC-4337 user operations through a bundler
- ERC-7710 Delegation Framework — user grants on-chain delegation to the oracle for automated minting
- DelegationManager deployed on Mantle Sepolia at `0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3` — delegation signed via EIP-712 and submitted via `enableDelegation`
- Delegation constrained to single call on WhoWareScore.mintScore within 24h via AllowedTargets + AllowedMethods + LimitedCalls + Timestamp enforcers
- A2A agent card at `GET /api/agents/card` exposing pipeline, curator, and scene-writer capabilities (Google A2A spec lite)
- HTTP 402 archive paywall: `GET /api/archive/:episodeId` returns `402 Payment Required` with on-chain payment metadata

### Best Agent Track ($3,000)
- `catalog.autonomousGenerateEpisode` — fully autonomous episode generation pipeline
- Venice AI selects figures from catalog, generates scenes with adversarial difficulty calibration
- Self-evaluation QA loop: Venice AI evaluates generated image prompts for anachronisms and identity leakage

### Best use of Venice AI ($3,000)
- Scene generation: Venice's `venice-uncensored` model generates panorama descriptions, clues, and ambient text
- Image generation: Venice API generates panoramic memory scene images (1792x1024)
- Socratic hint generation: Venice AI generates privacy-preserving hints that guide without spoiling
- Self-evaluation: Venice judges its own output quality in the calibration loop

### Best Use of 1Shot Permissionless Relayer ($1,000 USDC)
- Archive paywall uses 1Shot's `relayer_sendTransaction` for gasless USDC payments on Polygon Amoy
- Users pay 1 USDC for archive unlocks — gas is paid in USDC via 1Shot, not MATIC
- No signup, no pre-funding needed — true permissionless gas abstraction
- HTTP 402 endpoint at `GET /api/archive/:episodeId` returns payment metadata on unpaid access, triggering the 1Shot payment flow

## Architecture

```
apps/default/          # Expo app (React Native / Web)
packages/backend/      # Convex (database, auth, AI orchestration, scoring)
packages/contracts/    # Solidity on Mantle Sepolia
```

- **Frontend:** Expo + React Native + StyleSheet
- **Backend:** Convex (real-time database, serverless functions, auth)
- **Blockchain:** Mantle Sepolia (Score NFTs, Streak SBTs, commit-reveal guessing)
- **Payments:** Polygon Amoy — 1Shot Permissionless Relayer for gasless USDC
- **AI:** Venice AI (scene generation, image generation, hint generation, self-evaluation)
- **Wallet:** MetaMask Smart Accounts Kit (EIP-7702 upgrade, ERC-7710 delegation)

## Smart Contracts (Mantle Sepolia)

| Contract | Address |
|----------|---------|
| WhoWareScore | `0xd6ad76bed934ea5e5b25d635fba7889e782e691a` |
| WhoWareStreak | `0x6c82cc64c3c5c5f25766c77a41b78aa1f622cbbb` |
| WhoWareGuess | `0x8185762f72a6290eb4959adbd8286281131a531d` |

## Demo Video

[VIDEO_URL]

## Links

- **Live demo:** [DEPLOYMENT_URL]
- **GitHub:** [GITHUB_REPO]
- **Devpost:** This page
