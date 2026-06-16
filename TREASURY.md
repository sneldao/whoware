# Treasury Wallet

**Generated**: 2026-06-16 (for the x402 + ERC-7710 hackathon submission)

## Polygon Amoy treasury

| Field | Value |
| --- | --- |
| Address | `0x5Ebc0D556A4B6876673A37868D1f9120EEC63A9a` |
| Chain | Polygon Amoy (chainId 80002) |
| Purpose | Receives 1 USDC archive unlock payments |
| Env var on Convex | `PAYWALL_TREASURY_ADDRESS` |

The private key for this wallet is **not** stored in this repo. It lives in
`./.local/treasury-wallet.md` (gitignored) so the holder can sweep USDC out
later without exposing the key to GitHub.

## How to use

- **To sweep USDC out**: open `.local/treasury-wallet.md` locally and import
  the private key into MetaMask or any wallet.
- **To watch the address**: search `0x5Ebc0D556A4B6876673A37868D1f9120EEC63A9a`
  on https://amoy.polygonscan.com.

## Security

- This key was generated fresh for the demo and has never been used elsewhere.
- The server (`packages/backend/convex/paywall.ts`) only needs the **address**,
  set via Convex env `PAYWALL_TREASURY_ADDRESS`.
- The client (`apps/default/components/who-ware/archive-paywall.tsx`) reads
  `treasury` and `amount` from the 402 response and passes them to
  `sendArchivePayment`. The hardcoded `TREASURY_ADDRESS` constant in
  `apps/default/lib/paywall.ts` is a fallback for offline development only —
  at runtime, the server is the source of truth.
- The private key is intentionally NOT in this repo, NOT in `.env`, and NOT
  in Convex env. The only place it exists is `.local/treasury-wallet.md`
  on the maintainer's machine.

## Rotating the treasury

If this wallet is ever compromised or you want to move funds to cold storage:

1. Generate a new wallet (e.g. `node -e "import('viem/accounts').then(async m => { const pk = m.generatePrivateKey(); const a = m.privateKeyToAccount(pk); console.log(a.address, pk); })"`).
2. Update Convex: `npx convex env set PAYWALL_TREASURY_ADDRESS <new-address>`.
3. Update the fallback in `apps/default/lib/paywall.ts`.
4. Move the old key to `.local/treasury-wallet.md` (replace) and update the
   public address in this file.
5. Commit + push. Vercel autodeploys.

## USDC token (Polygon Amoy)

`0x41E94Eb019C0762f9Bfcf89Fb1E58725BfB0e7582` — official Circle USDC on Amoy.
Hardcoded in `apps/default/lib/1shot.ts` and `packages/backend/convex/paywall.ts`.
