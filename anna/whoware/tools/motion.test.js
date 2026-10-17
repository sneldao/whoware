// Tests for the motion layer (bundle/motion.js).
//
//   bun test anna/whoware/tools/motion.test.js
//
// The typewriter shipped two bugs that were invisible in a focused window
// and obvious in the real embedding, where an Anna app window is unfocused
// or collapsed for most of its life:
//
//   chained setTimeout   background timers clamp to ~1 Hz  -> 1 char/sec
//   bare rAF             paused outright when hidden      -> never completes
//
// Both are invisible here by default, so the harness below controls the
// frame clock directly.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// ── Environment stubs ─────────────────────────────────────────────

let frames = []; // queued rAF callbacks
let reduced = false;
let clock = 0; // shared clock: tick() advances it, performance.now() reads it
const real = {};

function install({ matchMediaMatches = false } = {}) {
  real.window = globalThis.window;
  real.performanceNow = globalThis.performance.now;
  reduced = matchMediaMatches;
  clock = 0;

  globalThis.window = { matchMedia: () => ({ matches: matchMediaMatches }) };
  globalThis.performance = { now: () => clock };
  globalThis.requestAnimationFrame = (cb) => {
    frames.push(cb);
    return frames.length;
  };
  globalThis.cancelAnimationFrame = () => {
    frames = [];
  };
}

// Advance the shared clock by `ms`, then run whatever frames were queued.
// Absolute offsets only, so the rAF timestamp and performance.now() agree.
function tick(ms = 16) {
  clock += ms;
  const pending = frames;
  frames = [];
  for (const cb of pending) cb(clock);
}

function uninstall() {
  if (real.window !== undefined) globalThis.window = real.window;
  globalThis.performance = { now: real.performanceNow };
  delete globalThis.requestAnimationFrame;
  delete globalThis.cancelAnimationFrame;
}

const node = () => ({ textContent: "" });

beforeEach(() => install());
afterEach(() => {
  uninstall();
  frames = [];
});

// ── Tests ─────────────────────────────────────────────────────────

describe("typewriter — smooth path", () => {
  test("reveals the full text and resolves true", async () => {
    const { typewriter } = await import("../bundle/motion.js");
    const n = node();
    const p = typewriter(n, "Alan Turing", { speed: 100, maxTotal: 1000 });

    tick(200); // a fifth of the way in
    expect(n.textContent.length).toBeGreaterThan(0);
    expect(n.textContent.length).toBeLessThan("Alan Turing".length);

    tick(900); // past the end
    expect(await p).toBe(true);
    expect(n.textContent).toBe("Alan Turing");
  });

  test("progress tracks elapsed wall-clock, not frame count", async () => {
    const { typewriter } = await import("../bundle/motion.js");
    const n = node();
    typewriter(n, "abcdefghij", { speed: 100, maxTotal: 1000 });

    // One frame, but 50% of the duration elapsed -> ~half revealed.
    tick(500); // half the duration
    expect(n.textContent).toBe("abcde");
  });
});

describe("typewriter — hidden window (rAF never fires)", () => {
  test("the safety timer still completes the reveal", async () => {
    const { typewriter } = await import("../bundle/motion.js");
    const n = node();
    // No tick() at all — this is what a hidden document looks like.
    const p = typewriter(n, "Alan Turing", { speed: 45, maxTotal: 300 });

    expect(await p).toBe(true);
    expect(n.textContent).toBe("Alan Turing");
  });

  test("completes even for a long string a frame at a time", async () => {
    const { typewriter } = await import("../bundle/motion.js");
    const n = node();
    const long = "x".repeat(400);
    const p = typewriter(n, long, { speed: 45, maxTotal: 2000 });

    expect(await p).toBe(true);
    expect(n.textContent).toBe(long);
  });
});

describe("typewriter — abort", () => {
  test("resolves false and leaves the partial text", async () => {
    const { typewriter } = await import("../bundle/motion.js");
    const n = node();
    const ac = new AbortController();
    const p = typewriter(n, "Alan Turing", { speed: 100, maxTotal: 1000, signal: ac.signal });

    tick(400);
    const partial = n.textContent;
    expect(partial.length).toBeGreaterThan(0);
    expect(partial.length).toBeLessThan("Alan Turing".length);

    ac.abort();
    expect(await p).toBe(false);
    // Interrupted, not snapped to a different word.
    expect(n.textContent).toBe(partial);
  });

  test("an already-aborted signal resolves instantly with full text", async () => {
    const { typewriter } = await import("../bundle/motion.js");
    const ac = new AbortController();
    ac.abort();
    const n = node();
    expect(await typewriter(n, "Alan Turing", { signal: ac.signal })).toBe(true);
    expect(n.textContent).toBe("Alan Turing");
  });
});

describe("typewriter — reduced motion", () => {
  test("sets the full text immediately with no frames", async () => {
    uninstall();
    install({ matchMediaMatches: true });
    const { typewriter } = await import("../bundle/motion.js");
    const n = node();
    expect(await typewriter(n, "Alan Turing")).toBe(true);
    expect(n.textContent).toBe("Alan Turing");
    expect(frames.length).toBe(0);
  });
});
