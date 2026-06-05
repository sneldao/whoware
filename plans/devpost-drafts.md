# WhoWare — Devpost Submission Drafts

---

## 1. MetaMask x 1Shot API x Venice AI Dev Cook Off

### Project Title
WhoWare — AI-curated daily history game with autonomous episode pipeline, Venice-powered hints, and x402 archive paywall

### Tagline
Wordle meets immersive history. An AI curator stages daily episodes autonomously; players solve in panoramic memory scenes; archive episodes unlock via USDC micropayments.

### Inspiration
History education is passive. We wanted to build a daily ritual that makes historical figures feel alive — stepping into their world, inspecting their surroundings, and earning the satisfaction of identification through observation rather than memorization.

### What it does
Each day at midnight UTC, an autonomous AI agent:
1. Selects a historical figure from a curated catalog
2. Writes three panoramic memory scenes with era-appropriate locations and hidden clues
3. Generates each scene image via Venice AI
4. Reviews and publishes the episode — no human in the loop

Players enter the first memory, explore panoramic environments, inspect clue hotspots, and guess the identity. Scoring rewards restraint: guessing without viewing memories earns the highest score. Venice AI generates Socratic hints on demand — guiding without spoiling.

Past episodes lock after the daily window. The archive uses an x402-inspired USDC paywall on Polygon Amoy: pay 1 USDC to unlock full access to any closed episode.

### How we built it
- **Frontend:** Expo + React Native (iOS, Android, Web)
- **Backend:** Convex (real-time database, serverless actions, cron scheduling)
- **Autonomous Agent:** `catalog.generateEpisode` Convex action orchestrates the full pipeline — figure selection → scene brief generation → Venice image API → review → publish
- **Venice AI:** Powers both panoramic scene generation and the Socratic hint system (per-clue hints + identity nudges, cached with leak guards)
- **Wallet:** MetaMask Smart Accounts via ERC-7715 delegation
- **Payments:** USDC on Polygon Amoy with on-chain verification (Convex action reads ERC-20 Transfer events from tx receipts)
- **On-chain:** Mantle Sepolia — soul-bound Score NFTs (EIP-712 oracle-signed), soul-bound Streak SBTs with tier badges, commit-reveal guessing

### Architecture
```
┌─────────────────────────────────────────────────────┐
│  Expo App (iOS / Android / Web)                     │
│  ├── MetaMask Smart Account (ERC-7715)              │
│  └── USDC payments on Polygon Amoy                  │
└──────────────────────┬──────────────────────────────┘
                       │
         ┌─────────────▼──────────────┐
         │  Convex Backend             │
         │  ├── Autonomous Agent       │
         │  │   (catalog.generate)     │
         │  ├── Venice AI Integration  │
         │  │   (scenes + hints)       │
         │  ├── Game State & Scoring   │
         │  ├── x402 Paywall Verify    │
         │  └── Oracle Signing (EIP-712)│
         └──────┬──────────┬───────────┘
                │          │
    ┌───────────▼──┐  ┌───▼────────────┐
    │ Mantle Sepolia│  │ Polygon Amoy   │
    │ Score NFT     │  │ USDC payments  │
    │ Streak SBT    │  │ Archive unlock │
    │ Guess commit  │  └────────────────┘
    └──────────────┘
```

### Track Mapping

**Autonomous Agent Track:**
The `catalog.generateEpisode` action is a fully autonomous pipeline. Given a figure ID, it writes scene briefs (titles, locations, eras, clue placements), calls Venice AI to generate panoramic images for each scene, reviews the output, and publishes a live episode — all without human intervention. The curator dashboard provides visibility into the pipeline but never gates it.

**Venice AI Track:**
Venice powers two features:
1. **Scene generation** — `venice.generateImage` produces panoramic environments from detailed prompts (location, era, palette, mood)
2. **Hint system** — `venice.generateHint` (per-clue Socratic hints) and `venice.generateIdentityHint` (era/region nudges). Both include leak guards that reject outputs containing the figure's canonical name or aliases.

**x402 Track:**
The archive paywall implements the x402 value proposition (stablecoin-gated content with on-chain verification) within a Convex architecture. Players pay 1 USDC on Polygon Amoy; the `paywall.verifyAndUnlock` action reads the USDC Transfer event from the transaction receipt, verifies the treasury received the funds, and records a persistent unlock.

### Challenges we ran into
- **Answer leakage in AI hints:** Venice sometimes included the figure's name in generated hints. Solved with a forbidden-word post-filter that checks canonicalName and all aliases before serving.
- **On-chain nonce management:** The EIP-712 oracle signature requires matching the contract's on-chain nonce. Hardcoding nonce=0 worked for the first mint but failed all subsequent ones. Fixed by reading `nonces(player)` before each signature.
- **x402 on Convex:** Convex doesn't support custom HTTP middleware for the classic 402 handshake. Adapted by implementing the payment + on-chain verification core of x402 directly in Convex actions.

### Accomplishments that we're proud of
- Fully autonomous episode pipeline — zero human intervention from figure selection to published episode
- Privacy-preserving AI hints that guide without spoiling (leak guard regression-tested)
- Multi-chain architecture: Mantle for NFTs, Polygon for payments
- Daily ritual mechanics with real retention hooks (streaks, leaderboards, share cards)
- 64 passing backend tests across 8 test suites

### What's next
- Three.js WebView for true 360° panoramic viewing
- Season arcs with progressive difficulty ramps
- Social features: friend leaderboards, challenge links
- Expanded figure catalog across more eras and regions

### Built With
expo, react-native, convex, venice-ai, viem, mantle, polygon, metamask, erc-7715, usdc, eip-712, typescript

### Links
- GitHub: https://github.com/sneldao/whoware
- Live demo: [DEPLOYMENT_URL]
- Demo video: [VIDEO_URL]

---

## 2. Mantle Turing Test Hackathon 2026 — Phase 2

### Project Title
WhoWare — Daily history game with soul-bound score NFTs and streak tokens on Mantle Sepolia

### Tagline
A daily embodied history ritual. Solve in panoramic memory scenes. Your score and streak live on-chain as soul-bound tokens — tamper-proof, non-transferable, earned daily.

### Inspiration
Wordle proved that daily rituals build habit. We wanted to bring that same compulsive loop to history education — and anchor achievement on-chain so scores can't be faked and streaks can't be bought.

### What it does
Every day at midnight UTC, a new historical figure becomes playable. Players step into panoramic memory scenes, inspect contextual clues, and guess the identity before their guesses run out. Scoring rewards restraint: fewer memories viewed, fewer clues opened, fewer guesses used, and less time elapsed all raise the score.

On solve, two transactions fire simultaneously on Mantle Sepolia:
1. **WhoWareScore** mints a soul-bound NFT recording the player's score, episode day, and assistance metrics (memories viewed, clues opened, guesses used). Oracle-signed via EIP-712.
2. **WhoWareStreak** updates the player's streak SBT, tracking consecutive daily solves with tier badges (spark → flame → inferno → eternal).

Both transactions show live progress as OnChainBadges with deep links to the Mantle explorer.

### How we built it on Mantle

**Smart Contracts (deployed to Mantle Sepolia):**

| Contract | Address | Purpose |
|----------|---------|---------|
| WhoWareScore | `0xd6ad76bed934ea5e5b25d635fba7889e782e691a` | Soul-bound score NFT, EIP-712 oracle-signed mint |
| WhoWareStreak | `0x6c82cc64c3c5c5f25766c77a41b78aa1f622cbbb` | Soul-bound streak SBT with tier badges |
| WhoWareGuess | `0x8185762f72a6290eb4959adbd8286281131a531d` | Commit-reveal guessing for fair competitive play |

**Oracle Signing Flow:**
The Convex backend acts as a trusted oracle. When a player solves:
1. Backend reads the on-chain `nonces(player)` for both Score and Streak contracts
2. Signs an EIP-712 typed data payload with the current nonce
3. Submits the transaction and awaits the receipt
4. Returns the tx hash to the frontend

This prevents score manipulation — only the oracle can authorize mints, and the nonce ensures each signature is single-use.

**Soul-Bound Design:**
Both tokens override `_update` to block transfers after initial mint. Scores and streaks are bound to the player who earned them — they can't be traded, gifted, or stolen.

**Commit-Reveal Guessing:**
WhoWareGuess implements a commit-reveal scheme where players hash their guess before submitting. This prevents front-running on competitive leaderboards where timing matters.

### Consumer & Viral Hooks

**Daily Ritual:**
- One episode per day, available for 24 hours
- Countdown timer creates urgency
- "Next body opens in…" drives return visits

**Retention Levers:**
- Streak tracking with tier badges (spark/flame/inferno/eternal)
- Push notifications when new episodes drop live
- Archive of past episodes (paywalled with USDC for revenue)
- Progressive identity hints that unlock after sustained play

**Virality:**
- Share card with score, streak, difficulty, era/region, and copy-to-clipboard
- Real-time leaderboard with player rank
- On-chain verification badges that link to Mantle explorer

**Multi-Chain Architecture:**
- Mantle Sepolia for on-chain achievement (Score NFTs + Streak SBTs)
- Polygon Amoy for archive micropayments (USDC paywall)
- MetaMask Smart Accounts via ERC-7715 delegation for seamless wallet UX

### Technical Highlights

**On-Chain Nonce Fix:**
The EIP-712 signature must match the contract's `nonces[player]` counter. Our initial implementation hardcoded `nonce = 0n`, which worked for the first mint but caused every subsequent mint to fail the `require(signer == oracle)` check. Fixed by reading `nonces(player)` via `publicClient.readContract` before each signature.

**Duplicate Mint Guard:**
A `hasMintedRef` on the frontend prevents re-entering the solve flow from triggering a second mint. The ref resets when a new episode loads.

**Streak Accuracy:**
The solve flow `await`s `recordSolve()` (which returns the updated streak state) before passing values to `updateStreak`. This ensures the on-chain streak reflects the post-solve count, not the stale pre-solve value.

### Metrics Narrative

| Metric | Lever | Implementation |
|--------|-------|---------------|
| DAU | Daily drop at midnight UTC | `crons.openExpired` transitions episodes to live |
| Retention | Streaks + push notifications | `useStreak` hook + `expo-notifications` |
| Session length | 3 scenes × 3 clues × hints | Panoramic exploration + clue inspection |
| Virality | Share card + leaderboard | `ResultShareCard` + `expo-clipboard` |
| Revenue | Archive paywall | 1 USDC per episode via Polygon Amoy |

### Accomplishments
- Three deployed contracts on Mantle Sepolia with verified source code
- Oracle-signed EIP-712 mint flow with dynamic nonce handling
- Soul-bound tokens with tier progression
- Commit-reveal guessing for fair competition
- Full game loop wired end-to-end: solve → mint → badge → explorer link
- 64 passing backend tests

### Built With
mantle, solidity, openzeppelin, eip-712, ecrecover, viem, convex, expo, react-native, metamask, erc-7715, typescript

### Links
- GitHub: https://github.com/sneldao/whoware
- WhoWareScore on Mantle Explorer: https://sepolia.mantlescan.xyz/address/0xd6ad76bed934ea5e5b25d635fba7889e782e691a
- WhoWareStreak on Mantle Explorer: https://sepolia.mantlescan.xyz/address/0x6c82cc64c3c5c5f25766c77a41b78aa1f622cbbb
- WhoWareGuess on Mantle Explorer: https://sepolia.mantlescan.xyz/address/0x8185762f72a6290eb4959adbd8286281131a531d
- Live demo: [DEPLOYMENT_URL]
- Demo video: [VIDEO_URL]
