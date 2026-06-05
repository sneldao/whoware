# WhoWare — Hackathon Submission Plan

## Status: on-track
Two concurrent hackathon submissions targeting complementary tracks. Both leverage the same core codebase; the checklist below tracks per-hackathon completion of the features each track judges.

---

## 1. MetaMask x 1Shot API x Venice AI Dev Cook Off

**Tracks (multi-track submission):**
- **Autonomous Agent** — the AI curator (`catalog.generateEpisode`) autonomously stages a full daily episode (figure selection → scene briefs → image generation → review → publish) with no human in the generation loop.
- **Venice AI** — Venice API powers both scene-image generation (`venice.generateImage`) and the Socratic hint system (`venice.generateHint`, `venice.generateIdentityHint`).
- **x402** — USDC-gated archive paywall on Polygon Amoy. Players pay 1 USDC to unlock closed episodes; payment verified on-chain via ERC-20 Transfer event inspection.

### Checklist
- [x] Venice AI scene-image generation (`catalog.generateEpisode`, `catalog.regenerateScene`)
- [x] Venice AI hint pipeline (scene hint + identity nudge, both cached in `veniceHints`)
- [x] Autonomous agent: curator pipeline with self-evaluation, adversarial difficulty calibration, and memory-aware figure selection (Slice 10)
- [x] MetaMask Smart Account wallet connect (ERC-7715 delegation in `wallet-connect.tsx` / `use-wallet.ts`)
- [x] **x402 integration** — USDC archive paywall on Polygon Amoy (`paywall.verifyAndUnlock` reads Transfer events, `ArchivePaywall` component gates `/archive/[id]`).
- [ ] Demo video walkthrough (~2 min) highlighting autonomous agent + Venice + MetaMask + x402.
- [ ] Devpost write-up: problem, architecture diagram, track mapping, live demo link.

### Submission assets needed
- [ ] README section linking to Devpost submission.
- [ ] 2-min demo video (Loom / YouTube unlisted).
- [ ] Architecture diagram (Expo + Convex + Venice + Mantle + MetaMask Smart Accounts).
- [ ] Public test deployment URL (Expo Go QR code + web URL).
- [ ] Repo with MIT license (done) and clear commit history.

### Risks
- x402 track requires *meaningful* use of the x402 protocol — the archive paywall with on-chain USDC verification on Polygon Amoy satisfies this. Narrative: archive = paid content, verified on-chain.

---

## 2. Mantle Turing Test Hackathon 2026 — Phase 2

**Track:** Consumer & Viral DApps.

### Checklist
- [x] Mantle Sepolia deployment (WhoWareScore, WhoWareStreak, WhoWareGuess deployed; addresses in README).
- [x] Soul-bound score NFT (oracle-signed via EIP-712).
- [x] Soul-bound streak SBT with tier badges (spark / flame / inferno / eternal).
- [x] Commit-reveal guessing for fair competitive play.
- [x] MetaMask wallet connect.
- [x] Daily ritual UX (countdown, live episode, solve flow).
- [x] **On-chain verification wired into game loop** — `mintScore` and `updateStreak` both read on-chain nonce, sign EIP-712, and await receipt. Frontend captures both tx hashes, renders dual `OnChainBadge` components, and guards against duplicate mints via `hasMintedRef`.
- [ ] Demo video emphasizing the "consumer viral" hook (daily drop, streaks, share card).
- [ ] Mantle-specific Devpost submission with contract addresses and Mantle explorer links.

### Submission assets needed
- [ ] Contract addresses + Mantle Sepolia explorer links in README (already there).
- [ ] Short demo video highlighting daily play loop + on-chain proof.
- [ ] Metrics narrative: retention levers (streaks, leaderboard), virality (share card), and on-chain verification.

### Risks
- "Viral DApps" judges care about DAU and retention hooks — emphasize streaks + daily drop + share card in the write-up.
- On-chain mint flow is wired and receipt-verified (Slice 8); demo should show both Score and Streak badges resolving live.

---

## Cross-cutting remaining work

| Task | Owner | Status |
|------|-------|--------|
| Wire x402 payment (Dev Cook Off x402 track) | Slice 9 | ✅ done |
| Wire `WhoWareScore.mint` on correct solve | Slice 8 | ✅ done |
| Record 2-min demo video (covers both submissions) | TBD | ❌ not started |
| Write Devpost submission drafts (2x) | TBD | ❌ not started |
| Deploy public test build (Expo Go + web) | TBD | ❌ not started |
| End-to-end smoke test against deployed Mantle contracts | TBD | ❌ not started |
| Update `smoke-test-catalog.ts` to hit production Venice endpoint | TBD | ❌ not started |

---

## Suggested next steps

- **Submission polish** — Demo video script, Devpost copy, architecture diagram, public deployment, README updates with submission links.
