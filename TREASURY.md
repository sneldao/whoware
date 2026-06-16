# Treasury Wallet

**Generated**: 2026-06-16 (for the x402 + ERC-7710 hackathon submission)

## Polygon Amoy treasury

| Field | Value |
| --- | --- |
| Address | `0x5Ebc0D556A4B6876673A37868D1f9120EEC63A9a` |
| Chain | Polygon Amoy (chainId 80002) |
| Purpose | Receives 1 USDC archive unlock payments |
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
3. Update the fallback in `apps/default/lib/paywall.ts`.
4. Update the public address in this file.
5. Commit + push. Vercel autodeploys.

The old wallet's funds can be swept by whoever holds the corresponding
private key — this is the maintainer's responsibility, not the repo's.

## USDC token (Polygon Amoy)

`0x41E94Eb019C0762f9Bfcf9FB1E58725BfB0e7582` — official Circle USDC on
Amoy. Hardcoded in `apps/default/lib/1shot.ts` and
`packages/backend/convex/paywall.ts`.
