# WhoWare — Hackathon Demo Script (3 min)

**Tracks targeted:** Best x402 + ERC-7710, Best use of Venice AI, Best Agent

---

## Setup (5 min before recording)

```bash
# 1. Make sure dev env is up
cd /Users/udingethe/Dev/whoware
git log --oneline -1   # should be 8b1398f

# 2. Make one of the generated episodes "closed" so it shows in the archive
#    with the paywall gate. Pick the most photogenic one.
CONVEX_DEPLOY_KEY="colorless-seal-981|01d0a90a9be6ae72b801a5a03ebf66fe5e189368e26d42b4e01efd821f93978a13d46b7a67119a" \
CONVEX_DEPLOYMENT="colorless-seal-981" npx convex run "daily:openExpired" "{}"

# 3. Start the web dev server (or use the deployed URL if you have one)
cd apps/default
npx expo start --web --port 19006
# open http://localhost:19006

# 4. Prep a wallet with Polygon Amoy USDC
#    - Add Polygon Amoy to MetaMask (chainId 80002)
#    - Get test USDC: https://faucet.circle.com/ (select Amoy, USDC)
#    - Need ~0.05 USDC for the demo unlock
```

---

## The demo (record in 3 takes, ~1 min each)

### Take 1: Daily play (40s) — *sets the scene, shows the product*

> "Every day, WhoWare drops a panoramic scene from a moment that changed history.
> You walk into it first-person, scan for clues, and have to name the figure
> before your guesses run out."

1. Open `http://localhost:19006`
2. Land on the daily drop. Show the panorama.
3. Click a clue hotspot. Reveal the clue.
4. Type a guess and submit.
5. Show the score / result / leaderboard.

> "All scoring, history, and leaderboard state is real-time on Convex.
> Scores and streaks are minted as on-chain attestations on Mantle Sepolia
> — tamper-proof."

### Take 2: The x402 paywall (60s) — *the headline track*

> "Closed episodes live in the archive. To unlock one, you don't log in,
> you don't pay with a credit card — you make an x402-style micropayment
> in USDC. The server returns 402 with the price and recipient; the
> client does the approve + transfer on Polygon Amoy; we verify the receipt
> on-chain and unlock the episode."

Walk through `/archive`:

1. Show the locked archive list (closed episodes).
2. Click an episode.
3. **Show the network:** MetaMask is on Ethereum mainnet → the paywall
   detects this, prompts to switch to Polygon Amoy.
4. **Show the 402:** Network tab → `GET /api/archive/<id>?identityId=...` →
   response is 402 with the payment metadata:
   ```json
   {
     "required": true,
     "amount": "0.05",
     "token": "USDC",
     "recipient": "0x742d...bEb",
     "chainId": 80002
   }
   ```
5. Click "Unlock for 0.05 USDC" → MetaMask pops with the USDC approval
   (caller approves the paywall contract to spend USDC) → then the
   transfer tx.
6. Show Polygonscan link: "Receipt verified on-chain, episode unlocked."
7. The locked panorama/clues render.

> "ERC-7710 delegation makes this repeatable: once you grant a session,
> every future archive unlock in that window happens without a fresh
> approval pop-up. The relayer is permissionless via 1Shot."

### Take 3: The AI pipeline (45s) — *the agent track + Venice AI*

> "Every daily drop is generated autonomously. Let me show you the curator
> picking the next figure and the full generation pipeline."

1. Open a terminal. Run:
   ```bash
   CONVEX_DEPLOY_KEY="colorless-seal-981|01d0a90a9be6ae72b801a5a03ebf66fe5e189368e26d42b4e01efd821f93978a13d46b7a67119a" \
   CONVEX_DEPLOYMENT="colorless-seal-981" npx convex run "catalog:autonomousGenerateEpisode" '{"slug":"demo-X","sceneCount":4}'
   ```
2. **Show the [ai-fallback] log line** — this is the resilience story:
   ```
   [ai-fallback] Venice chat failed (Venice chat error: 402 Insufficient USD or Diem balance)
     — falling back to Replicate
   ```
3. Then scene-by-scene logs: calibration rounds, scene brief generation,
   Flux 1.1 Pro image gen, evaluation pass.
4. The final `episodeId` returns. The new episode shows up in
   the curator queue (or refresh the app and see it in the catalog).

> "Venice AI is primary for both chat and image — when credits run out,
> the catalog pipeline fails over to Replicate (Flux for images, Llama 3
> 70B for chat) without the curator noticing. That's the long-term
> robustness win."

---

## Closing shot (15s)

> "WhoWare is a daily ritual that lives at the intersection of three things
> MetaMask is investing in: x402 machine-payable web, ERC-7710 delegated
> smart accounts, and permissionless AI agents building the experience.
> One product, three prize tracks."

End on: the live drop rendered, the daily play screen, the leaderboard
or the curator queue — whichever looks best.

---

## Talking points if judges ask

- **x402**: Server returns 402 with payment metadata. Client makes the
  payment. Receipt verified on-chain before unlock. Compatible with any
  x402 client.
- **ERC-7710**: Session delegations let the app pay for archive unlocks
  without per-action wallet prompts. 1Shot relayer for permissionless
  submission. Code: `apps/default/lib/1shot.ts`,
  `apps/default/lib/paywall.ts`.
- **Venice AI**: Privacy-preserving — Venice inference is uncensored
  and doesn't train on inputs, ideal for a public game with creative
  prompts. Primary provider for both chat (curator, scene briefs,
  evaluation, calibration) and image (panoramas).
- **Replicate fallback**: `packages/backend/convex/catalog.ts:493` —
  `isTransient()` classifier decides when to fail over (402/429/5xx/
  timeout/empty response, never validation errors). Per-call
  `AbortController` timeouts (30s primary, 60-90s fallback). Logs the
  fail-over with `[ai-fallback]` prefix.
- **Mantle**: Score NFTs + streak SBTs on Mantle Sepolia for tamper-proof
  on-chain history. Commit-reveal guessing scheme for the daily drop
  prevents late-stage answer leaks.

---

## One-liner for the submission

> **WhoWare — daily panoramic history, paid for in USDC, generated by agents,
> attested on-chain.**
