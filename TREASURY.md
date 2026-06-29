# Treasury Wallet

**Generated**: 2026-06-16 (for the x402 + ERC-7710 hackathon submission)

## Polygon Amoy treasury

| Field | Value |
| --- | --- |
| Address | `0x5Ebc0D556A4B6876673A37868D1f9120EEC63A9a` |
| Chain | Polygon Amoy (chainId 80002) |
| Purpose | Receives 1 USDC archive unlock payments |

> **Note:** The 1 USDC payment unlocks the rich archive content (scenes,
> imagery, hotspots, ambient text, leaderboard). Summary metadata about a
> closed episode (figure name, era, region, tags, difficulty, scene count,
> blurb) is publicly readable via the free
> `GET /api/archive/:episodeId?detail=summary` endpoint and the
> `api.archive.getArchiveSummary` Convex query — no payment required.

| Env var on Convex | `PAYWALL_TREASURY_ADDRESS` |

## How to watch

Search the address on https://amoy.polygonscan.com to see incoming USDC
transfers and any other activity.

## Security

- The private key for this address is **not** stored in this repository,
  the `.env` file, or any Convex env var. The server only needs the
  public address; the key remains in the maintainer's local secrets.
- The client (`apps/default/components/who-ware/archive-paywall.tsx`)
  reads `treasury` and `amount` from the 402 response and passes them
  to `sendArchivePayment`. The hardcoded `TREASURY_ADDRESS` constant in
  `apps/default/lib/paywall.ts` is a fallback for offline development
  only — at runtime, the server is the source of truth.

## Rotating the treasury

If this wallet needs to be moved (e.g. compromised, cold-storage
migration, key rotation):

1. Generate a new wallet.
2. Update Convex: `npx convex env set PAYWALL_TREASURY_ADDRESS <new-address>`.
3. Update the DRY source of truth in **`apps/default/lib/contracts.ts`**
   (`POLYGON_AMOY_PAYWALL_TREASURY` and the `CONTRACTS.polygonAmoy`
   grouping). Hooks (`use-smart-account-delegate`), the paywall page
   (`archive-paywall.tsx`), and the contracts test all read from here.
4. Update the fallback in **`apps/default/lib/paywall.ts`**
   (`TREASURY_ADDRESS`) — only used for offline dev when the 402
   server response is unavailable.
5. Update the public address in this file and in the README's
   `Smart Contracts` table.
6. Commit + push. Vercel autodeploys.

If you skip step 3 the hook layer drifts from the backend; if you skip
step 4 local dev (no server round-trip) silently sends to the old wallet.
Both must move together.

The old wallet's funds can be swept by whoever holds the corresponding
private key — this is the maintainer's responsibility, not the repo's.

## USDC token (Polygon Amoy)

`0x41E94Eb019C0762f9Bfcf9FB1E58725BfB0e7582` — official Circle USDC on
Amoy. Hardcoded in `apps/default/lib/1shot.ts` and
`packages/backend/convex/paywall.ts`.
