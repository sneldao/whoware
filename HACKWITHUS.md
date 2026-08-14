# Hack with Us — Week 1 submission (WhoWare)

Use this when entering [hackwithus.dev](https://www.hackwithus.dev/). Edit the demo URL / Tiun product name after your dashboard product exists.

## One-liner

Daily embodied history ritual — step into a 3D memory, find clues, name who changed history from this room. Free daily play; Tiun unlocks sealed archive cases without a crypto wallet.

## Problem

History education is passive (feeds, timelines, quizzes). People forget. There’s no daily habit that makes you *feel* a moment before you name it — and archive deep-dives usually require either a subscription stack or a crypto wallet.

## Solution

WhoWare is Wordle meets an explorable history museum:

- One new historical figure per day (three difficulty tiers)
- AI-generated panoramic memory scenes + inspectable props
- Score by restraint (fewer hints / less time = higher score)
- Closed episodes stay sealed until unlocked

**Tiun integration:** one-time purchase for archive unlock — pay once, permanent access, no wallet required. Crypto USDC path remains as an optional alternate.

## Demo

- Live app: https://whoware.vercel.app
- Repo: https://github.com/<!-- fill org/repo if public -->

## How Tiun is used

| Piece | Role |
|---|---|
| `tiun.init` | Client SDK at app startup (web) |
| One-time product | “Archive Unlock” — fixed fee, permanent entitlement |
| `tiun.checkout` | Buy / unlock a sealed episode archive |
| `tiun.login` | Returning buyers reclaim access without paying twice |
| Server verify | Convex checks JWT + `productAccess` before recording unlock |

## Week 1 goal fit

- Creative angle on a real problem (habit-forming history literacy)
- MVP already playable in browser
- Monetization path that non-crypto players can complete in minutes

## Vote ask (short)

> WhoWare — daily 3D history guessing game. Free puzzle every day; Tiun unlocks the sealed archive. Vote if you want history that feels like a place, not a Wikipedia tab.

## Checklist before submit

- [ ] Enter challenge at hackwithus.dev (Connect)
- [ ] Create Tiun account + sandbox provider at [my.tiun.business](https://my.tiun.business)
- [ ] Create **OneTime** product (e.g. “Archive Unlock”)
- [ ] Paste `snippetId` + `productId` into `.env` (see `.env.example`)
- [ ] Deploy web build with Tiun env vars
- [ ] Record 30–60s demo clip (enter scene → clue → guess → archive paywall → Tiun checkout)
- [ ] Submit + share for votes
