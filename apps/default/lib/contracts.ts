/**
 * On-chain contract addresses for WhoWare.
 *
 * Single source of truth — previously hardcoded inline in
 * `hooks/use-smart-account-delegate.ts`, the contracts package, and the README.
 *
 * If a value must change, update here and every consumer picks it up.
 * Mirrors the values documented in the project root README.
 */

import type { Address } from "viem";

export const MANTLE_SEPOLIA_SCORE_CONTRACT: Address =
  "0xd6ad76bed934ea5e5b25d635fba7889e782e691a";

export const MANTLE_SEPOLIA_STREAK_CONTRACT: Address =
  "0x6c82cc64c3c5c5f25766c77a41b78aa1f622cbbb";

export const MANTLE_SEPOLIA_GUESS_CONTRACT: Address =
  "0x8185762f72a6290eb4959adbd8286281131a531d";

export const MANTLE_SEPOLIA_ORACLE: Address =
  "0xfb8a7B42070334CB196e94E542cEA13655e2f394";

export const POLYGON_AMOY_PAYWALL_TREASURY: Address =
  "0x5Ebc0D556A4B6876673A37868D1f9120EEC63A9a";

export const CONTRACTS = {
  mantleSepolia: {
    score: MANTLE_SEPOLIA_SCORE_CONTRACT,
    streak: MANTLE_SEPOLIA_STREAK_CONTRACT,
    guess: MANTLE_SEPOLIA_GUESS_CONTRACT,
    oracle: MANTLE_SEPOLIA_ORACLE,
  },
  polygonAmoy: {
    paywallTreasury: POLYGON_AMOY_PAYWALL_TREASURY,
  },
} as const;
