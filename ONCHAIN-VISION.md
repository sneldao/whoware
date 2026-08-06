# WhoWare On-Chain Vision — The Knowledge Economy

> Status: **Design vision, not yet built.**
> This document describes the long-term on-chain incentive layer for
> WhoWare. The core game (3D rooms, guessing, figure bios, daily cadence)
> is live and being tested with users. The mechanics below will be built
> once we have signal that the underlying gameplay resonates.
>
> Principle: **no on-chain mechanic should exist to compensate for a game
> that isn't fun.** The game comes first. The economy is built on top of
> engagement, not in place of it.

## The problem with current on-chain game incentives

Most on-chain games bolt a token or NFT onto a game loop and call it
"play-to-earn." The result is a speculative wrapper around thin gameplay —
the on-chain layer exists to create financial value, not to deepen the
game. Players come for the yield, leave when the yield dries up, and the
game dies with the token.

The 2026 frontier is different. Protocols like FWA (Fake World Assets) and
Zora's Uniswap V4 hooks show that on-chain assets can be **simultaneously
game objects and financial positions** — the market structure IS the game
mechanic. FWA's NFTs are backed by ETH and selected at random. Zora's
coins are liquidity positions whose swaps distribute rewards. The asset
and the mechanic are the same thing.

WhoWare's opportunity: make historical knowledge the substrate of an
on-chain economy where **being knowledgeable makes you a better liquidity
provider, a better collector, and a better trader** — without the game
being about any of those things.

## What stays the same

The core game loop is unchanged:

1. A daily historical figure episode (3D rooms, clues, guessing)
2. Score by restraint (fewer hints, fewer guesses, less time)
3. Figure bio reveal + connected-figures web
4. Streaks, weekly recap, archive practice mode

Players who never touch the on-chain layer have the full experience.
The on-chain layer is an **opt-in economy** for players who want their
knowledge to have lasting, tradeable, financial weight.

## The vision: three integrated layers

### Layer 1 — Episode Token Pools (Uniswap V4 hooks)

Every daily episode gets its own Uniswap V4 pool with a custom hook.

**Minting:** When a player solves an episode, the backend mints them
Episode Tokens (ERC20) proportional to their score. A perfect solve
(10,000 pts) mints more tokens than a scrape-through (2,000 pts). The
tokens are minted at zero cost — you earn them by playing.

**The pool:** The Episode Token is paired with ETH (or USDC on Base) in a
V4 pool. The hook controls:

- `afterInitialize` — sets a bonding curve based on the episode's
  difficulty tier. Research-tier figures get steeper curves (less
  liquidity, more price sensitivity). Iconic figures get flatter curves
  (more liquidity, more volume).
- `beforeSwap` — charges a **decaying fee** in the first 24 hours after
  the episode closes. Starts at 10% (anti-sniper), decays linearly to
  0.1%. This rewards players who solved the episode (they already have
  tokens) and penalizes pure speculators who didn't play.
- `afterSwap` — collects swap fees and routes them:
  - **50%** to the episode's top solver (by score) as a solver dividend
  - **30%** to the protocol treasury (funds future episode generation,
    figure acquisition backing)
  - **20%** reminted as LP (grows the pool over time)

**Why this is novel:** Your knowledge literally determines your cost basis.
If you solved the episode well, you got tokens for free. If you're
speculating, you're buying from players who earned their position through
gameplay, and you're paying a fee that goes to those players.

**Why it's not Ponzinomics:** The token has no governance value, no
promise of future returns. Its value derives from the cultural significance
of the historical figure and the demand to "collect" that episode. The fee
distribution creates a closed loop: swap volume → solver rewards → more
reason to solve well → more episodes played → more tokens in circulation.

### Layer 2 — Figure Acquisition Pools (FWA-style)

Each historical figure who has been featured in an episode becomes an
acquirable position in an FWA-style pool.

**The mechanic:** When an episode closes, the protocol deposits the
figure's NFT into a pool with ETH backing. The backing amount is set by
the figure's difficulty tier:

- Iconic (well-known): more ETH backing, lower rarity
- Field (moderately known): medium backing, medium rarity
- Research (obscure): less backing, higher rarity

**Acquisition:** Anyone can pay the pool-derived price to receive a
randomly selected figure NFT (Chainlink VRF for selection). The price
is derived from the total backing in the pool. You might get a common
figure (lots of backing, low price) or a rare one (little backing,
high price).

**The player advantage:** Players who solved the episode get one free
acquisition from that episode's figure pool. They don't pay — they
earned it by playing. Players who didn't solve can still acquire figures,
but they pay the pool price.

**The standing bid:** The protocol maintains a standing bid to reacquire
any figure (like FWA). This means the protocol can reclaim a figure if
it needs to be re-featured in a future episode (e.g., a connected-figures
web that references a figure from episode 47 in episode 92). The standing
bid also gives every figure a floor price — you can always sell back to
the protocol.

**Why this is novel:** This is a **knowledge gacha** — but the gacha is
fair because the randomness is on-chain (VRF), the backing is real (ETH),
and the free pulls are earned through gameplay, not paid for. The figure
collection becomes a portfolio that reflects your historical knowledge,
with real value backed by protocol ETH.

### Layer 3 — Skill Positions (skill as liquidity)

The most ambitious layer. Each player has a **Skill Position** in the
protocol's master V4 pool — a position weighted by their gameplay history.

**Skill weight formula** (illustrative):
```
skillWeight = (solveCount × 100)
            + (averageScore / 100)
            + (currentStreak × 50)
            + (speedBonus)  // solved in first hour of episode close
```

**How it works:**
- The master pool holds protocol fees from all Episode Token pools
- `afterSwap` on the master hook distributes fees to Skill Position holders,
  weighted by their skill
- A player who has solved 100 episodes with high scores earns more from
  every swap across the entire protocol than a player who has solved 5
- The `beforeSwap` hook can offer **reduced slippage** to players with
  higher Skill Positions — they've proven their knowledge, so the protocol
  treats them as "trusted" participants

**Why this is novel:** Skill is not a badge or a leaderboard rank. It's a
**liquidity position**. Your gameplay history generates yield. The more
you know (and the better you play), the larger your position, and the more
you earn from protocol activity. This is the inverse of play-to-earn:
you don't earn by playing, you earn by **having played well**.

## The flywheel

```
Play daily episodes
        ↓
Solve well → mint Episode Tokens (score-weighted)
        ↓
Episode Token pool opens → swap volume generates fees
        ↓
Fees route to top solvers + protocol treasury
        ↓
Protocol treasury funds figure pool backing (ETH)
        ↓
Figure pools open → players acquire figures (free for solvers, paid for others)
        ↓
Figure acquisitions generate protocol fees
        ↓
Fees distribute to Skill Position holders (weighted by gameplay history)
        ↓
Skill grows → earn more from future protocol activity
        ↓
More reason to play well → back to top
```

## Chain architecture

Everything lives on **Base**:

- **Uniswap V4** pools with custom hooks (Episode Tokens + master Skill pool)
- **FWA-style** figure acquisition pools (NFT + ETH backing + VRF)
- **Inco Lightning** encrypted guessing (competitive integrity)
- **ERC721** figure NFTs (collectible, backed by ETH)
- **ERC20** episode tokens (minted on solve, tradeable in V4 pools)

One chain. One wallet connection. The player connects once, plays, and
their wallet accumulates episode tokens and figure NFTs. No chain
switches, no multi-chain complexity.

## What we're building now vs. later

### Now (ship for user feedback)
- Core game loop (3D rooms, clues, guessing, bios, insights)
- Inco Lightning encrypted guessing on Base (competitive integrity)
- Score NFT + streak SBT on Base (consolidated from Mantle)
- Daily episodes with AI-generated scenes and figure bios
- Archive, weekly recap, practice mode

### Later (after gameplay validation)
- Episode Token pools (V4 hooks)
- Figure acquisition pools (FWA-style)
- Skill Positions (skill as liquidity)
- Competitive tournaments with on-chain prize pools

## Why wait

The on-chain mechanics above are only valuable if:

1. **Players care about the figures.** If collecting a historical figure
   NFT doesn't resonate, the FWA-style pool is a gacha with no soul.

2. **Episode tokens have cultural meaning.** If players don't feel pride
   in having solved "the Galileo episode" perfectly, the token is just
   another speculative asset.

3. **The daily loop is sticky.** If retention isn't there without the
   economy, the economy won't fix it — it'll just delay the churn.

The current game tests all three. Once we see that players come back
daily, care about the figures, and feel the competitive pull of the
leaderboard, the on-chain economy becomes a multiplier on existing
engagement rather than a substitute for it.

## References

- [FWA — Fake World Assets](https://www.fwa.fun/docs/overview) —
  randomized NFT acquisition with ETH-backed positions and standing bids
- [Zora V4 Hook System](https://docs.zora.co/coins/contracts/hook) —
  Uniswap V4 hook that manages pool lifecycle, dynamic fees, and reward
  distribution on every swap
- [Uniswap V4 Hooks](https://docs.uniswap.org/contracts/v4/concepts/hooks) —
  beforeSwap, afterSwap, afterInitialize lifecycle hooks
- [Inco Lightning](https://docs.inco.org) — encrypted on-chain computation
  for confidential guessing
