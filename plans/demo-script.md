# WhoWare — Demo Video Script (~2 minutes)

One recording covers both hackathon submissions. Record screen + voice-over.
Target length: 2:10–2:25.

---

## Opening (0:00–0:12)

**Screen:** App hero — "Someone changed history from this room."

> WhoWare is a daily history guessing game. Each day, an AI curator autonomously
> stages a full episode — picking a historical figure, writing three memory
> scenes, generating panoramic images with Venice AI, and publishing — with no
> human in the loop.

---

## Autonomous Agent + Venice AI (0:12–0:50)

**Screen:** Curator dashboard → episode pipeline → generated scenes

> The autonomous agent runs a three-stage pipeline with no human in the loop.
>
> First, **memory-aware figure selection**: the agent reviews the last seven
> episodes — eras, regions, difficulty tiers — and asks Venice to pick the
> figure that maximizes variety. No repeats, no bias toward famous names.
>
> Second, **adversarial difficulty calibration**: after writing scene briefs,
> a solver agent tries to guess the figure from the clues alone. If it solves
> in two scenes, the clues are too obvious — a rewrite agent makes them more
> subtle. If it can't narrow down with all clues, they're too vague — another
> agent sharpens them. Up to two calibration rounds per episode.
>
> Third, **self-evaluation**: before generating each image, a quality judge
> checks the prompt for era accuracy, anachronisms, and identity leakage.
> If issues are found, the prompt is refined and re-evaluated — up to two
> retries per scene.
>
> The result: a fully staged episode with calibrated difficulty and
> quality-checked imagery, ready for players at midnight UTC.
>
> During gameplay, Venice also powers the hint system. Players can ask any
> clue hotspot for a Socratic hint — the AI guides without spoiling. After
> three scenes, an identity nudge unlocks, narrowing the figure's era and
> region without leaking the name.

---

## Onboarding + Gameplay (0:50–1:20)

**Screen:** Onboarding flow → enter memory → panorama → hotspot → clue ledger → guess panel

> First-time players see a cinematic onboarding guided by the Mystery Figure —
> five atmospheric steps that teach the mechanics: explore memories, inspect
> clues, guess the identity. Interactive demos let players tap a hotspot and
> see a clue reveal before they even start.
>
> Then it's into the game. Each scene is a panoramic environment with hidden
> clues. Tap a hotspot and feel the haptic click, hear the subtle chime.
> The scoring rewards restraint — guessing without opening memories earns the
> highest score. A correct guess triggers a satisfying success animation and
> haptic burst.
>
> The leaderboard updates in real-time via Convex.

---

## MetaMask + On-Chain Verification (1:20–1:45)

**Screen:** Wallet connect → solve → dual OnChainBadge → Mantle explorer

> Connect your MetaMask Smart Account using ERC-7715 delegation. When you
> solve, two things happen on Mantle Sepolia simultaneously:
>
> Your score mints as a soul-bound NFT — oracle-signed via EIP-712,
> non-transferable. Your streak updates on the WhoWareStreak token, which
> tracks tier badges from spark to eternal based on consecutive daily solves.
>
> Both transactions show live progress as OnChainBadges, and you can tap
> through to the Mantle explorer to verify.

---

## x402 Archive Paywall (1:45–2:05)

**Screen:** Archive list → locked episode → paywall → USDC payment → unlock

> Past episodes lock when the daily window closes. The archive uses an
> x402-inspired paywall on Polygon Amoy — pay 1 USDC to unlock any closed
> episode's full content: all scenes, the leaderboard, and the identity
> reveal.
>
> Payment is verified on-chain. The Convex backend reads the USDC Transfer
> event from the transaction receipt, confirms the treasury received the
> funds, and records a persistent unlock tied to your identity.

---

## Closing (2:05–2:20)

**Screen:** Share card → streak badge → analytics dashboard → archive

> The share card shows your streak tier — spark, flame, inferno, or eternal —
> with a score-ranked gradient border and one-tap image export for social.
> The WhoWare Pulse dashboard shows live global stats: total solves, unique
> players, streak leaderboard, and recent solve feed — all updating in
> real-time via Convex subscriptions.
>
> Daily drops, cinematic onboarding, streaks, share cards, on-chain proof,
> and paid archive access. WhoWare — Wordle meets immersive history.

---

## Recording Tips

- Use a real closed episode in the archive (seed one if needed)
- Have MetaMask connected on Mantle Sepolia before recording
- Have USDC on Polygon Amoy ready for the paywall demo
- Keep the solve flow short — name the figure quickly, let the badges animate
- End on the share card so judges see the viral hook
