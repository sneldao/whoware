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
Each day at midnight UTC, an autonomous AI agent runs a three-stage pipeline:
1. **Memory-aware figure selection** — reviews the last 7 episodes (eras, regions, difficulty tiers) and asks Venice to pick the figure that maximizes variety
2. **Adversarial difficulty calibration** — a solver agent tries to guess the figure from the clues alone; if it solves too quickly, a rewrite agent makes clues more subtle; if it can't narrow down, another agent sharpens them (up to 2 calibration rounds)
3. **Self-evaluating image generation** — a quality judge checks each image prompt for era accuracy, anachronisms, and identity leakage before generation (up to 2 retries per scene)

The result is a fully staged episode — scenes, clues, panoramic imagery — published with no human in the loop.

Players enter the first memory, explore panoramic environments, inspect clue hotspots, and guess the identity. Scoring rewards restraint: guessing without viewing memories earns the highest score. Venice AI generates Socratic hints on demand — guiding without spoiling.

Past episodes lock after the daily window. The archive uses an x402-inspired USDC paywall on Polygon Amoy: pay 1 USDC to unlock full access to any closed episode.

First-time players see a cinematic onboarding flow guided by the Mystery Figure mascot — five atmospheric steps with interactive demos that teach the core mechanics before the first episode. Share cards show streak tier badges (spark/flame/inferno/eternal), score-ranked gradient borders, and one-tap image export for social virality. Haptic and sound feedback punctuate every interaction — clue reveals, correct guesses, scene transitions. A public "WhoWare Pulse" analytics dashboard shows live global stats: total solves, unique players, streak leaderboard, and recent solve feed, all updating in real-time.

### How we built it
- **Frontend:** Expo + React Native (iOS, Android, Web)
- **Backend:** Convex (real-time database, serverless actions, cron scheduling)
- **Autonomous Agent:** `catalog.autonomousGenerateEpisode` runs a three-stage pipeline — memory-aware figure selection, adversarial difficulty calibration (solver + rewrite agents), and self-evaluating image generation (quality judge with retries) — all orchestrated as a Convex action
- **Venice AI:** Powers both panoramic scene generation and the Socratic hint system (per-clue hints + identity nudges, cached with leak guards)
- **Wallet:** MetaMask Smart Accounts via ERC-7710 delegation (DelegationManager at `0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3` on Mantle Sepolia)
- **A2A Agent Card:** `GET /api/agents/card` exposes pipeline, curator, and scene-writer agents per Google A2A spec lite; `POST /api/agents/pipeline` and `POST /api/agents/curator` provide JSON-RPC 2.0 agent-to-agent communication
- **Payments:** USDC on Polygon Amoy with on-chain verification (Convex action reads ERC-20 Transfer events from tx receipts); HTTP 402 endpoint at `GET /api/archive/:episodeId` triggers payment flow
- **On-chain:** Mantle Sepolia — soul-bound Score NFTs (EIP-712 oracle-signed), soul-bound Streak SBTs with tier badges, commit-reveal guessing
- **Analytics:** Real-time Convex subscriptions powering the WhoWare Pulse dashboard (global stats, streak leaderboard, recent solves)
- **Onboarding:** 5-step cinematic flow with Mystery Figure mascot, interactive demos, Reanimated transitions
- **Polish:** Haptic feedback (expo-haptics), Web Audio API sound effects, progressive image loading with blurhash placeholders, SEO + OpenGraph meta tags
- **Figure Catalog:** 35+ historical figures across 3 difficulty tiers (iconic, field, research) spanning 15+ regions and 4000 years of history

### Architecture
```
┌─────────────────────────────────────────────────────┐
│  Expo App (iOS / Android / Web)                     │
│  ├── MetaMask Smart Account (ERC-7710)              │
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
The `catalog.autonomousGenerateEpisode` action is a genuine autonomous agent with self-evaluation and adversarial reasoning:
- **Memory-aware selection** — the agent reviews recent episode history (eras, regions, difficulty) and selects the next figure to maximize variety across the catalog
- **Adversarial calibration** — a solver sub-agent plays the puzzle before any human sees it, and triggers rewrite agents if the difficulty is miscalibrated (too easy → subtle rewrite; too hard → sharpen rewrite)
- **Self-evaluation** — a quality-judge sub-agent evaluates each image prompt before generation, rejecting prompts with anachronisms or identity leakage

The agent calls 6+ Venice AI sub-agents per episode (figure selector, calibration solver, subtle/sharpen rewriters, quality judge) and makes autonomous decisions about when to retry, when to rewrite, and when to proceed. No human gates any stage.

**Venice AI Track:**
Venice powers two features:
1. **Scene generation** — `venice.generateImage` produces panoramic environments from detailed prompts (location, era, palette, mood)
2. **Hint system** — `venice.generateHint` (per-clue Socratic hints) and `venice.generateIdentityHint` (era/region nudges). Both include leak guards that reject outputs containing the figure's canonical name or aliases.

**x402 Track:**
The archive paywall implements the x402 value proposition (stablecoin-gated content with on-chain verification) within a Convex architecture. Players pay 1 USDC on Polygon Amoy; the `paywall.verifyAndUnlock` action reads the USDC Transfer event from the transaction receipt, verifies the treasury received the funds, and records a persistent unlock.

### Challenges we ran into
- **Calibrating clue difficulty autonomously:** Early episodes had clues that were either too obvious (players solved from scene 1) or too vague (couldn't narrow down with all scenes). Solved by introducing an adversarial solver agent that plays the puzzle before publishing, triggering subtle or sharpen rewrites based on how quickly it guesses.
- **Answer leakage in AI hints:** Venice sometimes included the figure's name in generated hints. Solved with a forbidden-word post-filter that checks canonicalName and all aliases before serving.
- **On-chain nonce management:** The EIP-712 oracle signature requires matching the contract's on-chain nonce. Hardcoding nonce=0 worked for the first mint but failed all subsequent ones. Fixed by reading `nonces(player)` before each signature.
- **x402 on Convex:** Convex doesn't support custom HTTP middleware for the classic 402 handshake. Adapted by implementing the payment + on-chain verification core of x402 directly in Convex actions.

### Accomplishments that we're proud of
- Genuine autonomous agent with self-evaluation, adversarial difficulty calibration, and memory-aware figure selection — 6+ AI sub-agents per episode
- Privacy-preserving AI hints that guide without spoiling (leak guard regression-tested)
- Multi-chain architecture: Mantle for NFTs, Polygon for payments
- Cinematic onboarding flow with interactive demos and mascot-driven guidance
- Real-time analytics dashboard with live Convex subscriptions
- Daily ritual mechanics with real retention hooks (streaks, leaderboards, share cards with image export)
- 35+ diverse historical figures across 15+ regions and 4000 years
- 77 passing backend tests across 10 test suites

### What's next
- Three.js WebView for true 360° panoramic viewing
- Season arcs with progressive difficulty ramps
- Social features: friend leaderboards, challenge links
- Expanded figure catalog across more eras and regions

### Built With
expo, react-native, convex, venice-ai, viem, mantle, polygon, metamask, erc-7710, usdc, eip-712, typescript

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
- Cinematic 5-step onboarding flow with Mystery Figure mascot and interactive demos

**Virality:**
- Share card with streak tier badge, score-ranked gradient border, and one-tap image export
- Real-time leaderboard with player rank
- On-chain verification badges that link to Mantle explorer
- "WhoWare Pulse" public analytics dashboard with live global stats
- SEO + OpenGraph meta tags for polished social sharing

**Polish:**
- Haptic feedback on clue reveals, correct guesses, and scene transitions
- Web Audio API sound effects (chime on clue, arpeggio on correct guess)
- Progressive image loading with blurhash placeholders and shimmer animations

**Multi-Chain Architecture:**
- Mantle Sepolia for on-chain achievement (Score NFTs + Streak SBTs)
- Polygon Amoy for archive micropayments (USDC paywall)
- MetaMask Smart Accounts via ERC-7710 delegation for seamless wallet UX

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
- Cinematic onboarding flow with interactive demos
- Real-time analytics dashboard (WhoWare Pulse) with live Convex subscriptions
- 35+ diverse historical figures across 15+ regions and 4000 years
- 77 passing backend tests across 10 test suites

### Built With
mantle, solidity, openzeppelin, eip-712, ecrecover, viem, convex, expo, react-native, metamask, erc-7710, typescript

### Links
- GitHub: https://github.com/sneldao/whoware
- WhoWareScore on Mantle Explorer: https://sepolia.mantlescan.xyz/address/0xd6ad76bed934ea5e5b25d635fba7889e782e691a
- WhoWareStreak on Mantle Explorer: https://sepolia.mantlescan.xyz/address/0x6c82cc64c3c5c5f25766c77a41b78aa1f622cbbb
- WhoWareGuess on Mantle Explorer: https://sepolia.mantlescan.xyz/address/0x8185762f72a6290eb4959adbd8286281131a531d
- Live demo: [DEPLOYMENT_URL]
- Demo video: [VIDEO_URL]
