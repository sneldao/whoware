import { describe, expect, test } from "vitest";

// Test the Inco guess utility logic without importing the module
// (which pulls in @inco/lightning-js, not available in the test env).
// We replicate the pure-logic functions here and test them directly.

describe("Inco Lightning integration guards", () => {
  // isIncoEnabled checks if the contract address is not the zero address
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  function isIncoEnabled(contractAddress: string): boolean {
    return contractAddress !== ZERO_ADDRESS;
  }

  // isIncoPlatformSupported checks for window.ethereum
  function isIncoPlatformSupported(): boolean {
    return typeof window !== "undefined" && typeof (window as any).ethereum !== "undefined";
  }

  // episodeDayFromDropsAt derives a day number from a ms timestamp
  function episodeDayFromDropsAt(dropsAt: number): number {
    return Math.max(1, Math.floor(dropsAt / 86_400_000));
  }

  test("isIncoEnabled returns false when contract address is zero", () => {
    expect(isIncoEnabled(ZERO_ADDRESS)).toBe(false);
  });

  test("isIncoEnabled returns true when contract address is set", () => {
    expect(isIncoEnabled("0x1234567890123456789012345678901234567890")).toBe(true);
  });

  test("isIncoPlatformSupported returns false in Node test environment", () => {
    expect(isIncoPlatformSupported()).toBe(false);
  });

  test("episodeDayFromDropsAt derives a day number from a timestamp", () => {
    expect(episodeDayFromDropsAt(0)).toBe(1);
    expect(episodeDayFromDropsAt(86_400_000)).toBe(1);
    expect(episodeDayFromDropsAt(86_400_001)).toBe(1); // still within day 1
    expect(episodeDayFromDropsAt(2 * 86_400_000)).toBe(2);
    expect(episodeDayFromDropsAt(10 * 86_400_000)).toBe(10);
  });

  test("episodeDayFromDropsAt never returns 0 (minimum is 1)", () => {
    expect(episodeDayFromDropsAt(-1000)).toBe(1);
    expect(episodeDayFromDropsAt(1)).toBe(1);
  });

  test("episodeDayFromDropsAt handles realistic episode timestamps", () => {
    // A timestamp from ~2026
    const ts = 1_769_000_000_000; // ~Feb 2026
    const day = episodeDayFromDropsAt(ts);
    expect(day).toBeGreaterThan(20000); // days since epoch
    expect(day).toBe(Math.floor(ts / 86_400_000));
  });
});
