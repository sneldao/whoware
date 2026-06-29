import { describe, expect, it, vi, beforeAll } from "vitest";

// vitest doesn't expose React Native's __DEV__; set it so the logger
// behaves as it does in development.
beforeAll(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
});

import { logger } from "./logger";

/**
 * The logger routes through console.* in development. In the test
 * environment (NODE_ENV=test) we expect warn and error to fire,
 * debug and info to no-op so test output stays clean.
 */
describe("logger", () => {
  it("warn logs through console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("context.warn");
    expect(spy).toHaveBeenCalledWith("[context.warn]");
    spy.mockRestore();
  });

  it("error logs through console.error with the error attached", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("boom");
    logger.error("context.error", err);
    expect(spy).toHaveBeenCalledWith("[context.error]", err);
    spy.mockRestore();
  });

  it("debug logs through console.debug", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    logger.debug("context.debug");
    expect(spy).toHaveBeenCalledWith("[context.debug]");
    spy.mockRestore();
  });

  it("info logs through console.info", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logger.info("context.info");
    expect(spy).toHaveBeenCalledWith("[context.info]");
    spy.mockRestore();
  });
});
