import { describe, expect, it } from "vitest";
import { CONTRACTS, MANTLE_SEPOLIA_ORACLE, MANTLE_SEPOLIA_SCORE_CONTRACT, MANTLE_SEPOLIA_STREAK_CONTRACT, MANTLE_SEPOLIA_GUESS_CONTRACT, POLYGON_AMOY_PAYWALL_TREASURY } from "./contracts";

describe("contract addresses", () => {
  it("exposes Mantle Sepolia contracts used by the on-chain flow", () => {
    expect(MANTLE_SEPOLIA_SCORE_CONTRACT).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(MANTLE_SEPOLIA_STREAK_CONTRACT).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(MANTLE_SEPOLIA_GUESS_CONTRACT).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(MANTLE_SEPOLIA_ORACLE).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("exposes the Polygon Amoy paywall treasury", () => {
    expect(POLYGON_AMOY_PAYWALL_TREASURY).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("groups the addresses under the same names the README uses", () => {
    expect(CONTRACTS.mantleSepolia.score).toBe(MANTLE_SEPOLIA_SCORE_CONTRACT);
    expect(CONTRACTS.mantleSepolia.streak).toBe(MANTLE_SEPOLIA_STREAK_CONTRACT);
    expect(CONTRACTS.mantleSepolia.guess).toBe(MANTLE_SEPOLIA_GUESS_CONTRACT);
    expect(CONTRACTS.mantleSepolia.oracle).toBe(MANTLE_SEPOLIA_ORACLE);
    expect(CONTRACTS.polygonAmoy.paywallTreasury).toBe(POLYGON_AMOY_PAYWALL_TREASURY);
  });
});
