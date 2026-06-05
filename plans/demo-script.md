# WhoWare — Demo Video Script (~2 minutes)

One recording covers both hackathon submissions. Record screen + voice-over.
Target length: 1:50–2:10.

---

## Opening (0:00–0:12)

**Screen:** App hero — "Someone changed history from this room."

> WhoWare is a daily history guessing game. Each day, an AI curator autonomously
> stages a full episode — picking a historical figure, writing three memory
> scenes, generating panoramic images with Venice AI, and publishing — with no
> human in the loop.

---

## Autonomous Agent + Venice AI (0:12–0:40)

**Screen:** Curator dashboard → episode pipeline → generated scenes

> Behind the scenes, the autonomous agent selects a figure from the catalog,
> writes scene briefs with era-appropriate locations and clues, then calls
> Venice to generate each panoramic memory. The result is a fully staged
> episode — three scenes, nine interactive clue hotspots, and AI-generated
> imagery — ready for players at midnight UTC.
>
> During gameplay, Venice also powers the hint system. Players can ask any
> clue hotspot for a Socratic hint — the AI guides without spoiling. After
> three scenes, an identity nudge unlocks, narrowing the figure's era and
> region without leaking the name.

---

## Gameplay + Scoring (0:40–1:05)

**Screen:** Enter memory → panorama → hotspot → clue ledger → guess panel

> Players enter the first memory and explore. Each scene is a panoramic
> environment with hidden clues. The scoring rewards restraint — guessing
> without opening memories earns the highest score. Every visual memory
> viewed, clue inspected, wrong guess, and extra second lowers the ceiling.
>
> The leaderboard updates in real-time via Convex.

---

## MetaMask + On-Chain Verification (1:05–1:30)

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

## x402 Archive Paywall (1:30–1:50)

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

## Closing (1:50–2:00)

**Screen:** Share card → streak banner → archive

> Daily drops, streaks, share cards, on-chain proof, and paid archive access.
> WhoWare — Wordle meets immersive history.

---

## Recording Tips

- Use a real closed episode in the archive (seed one if needed)
- Have MetaMask connected on Mantle Sepolia before recording
- Have USDC on Polygon Amoy ready for the paywall demo
- Keep the solve flow short — name the figure quickly, let the badges animate
- End on the share card so judges see the viral hook
