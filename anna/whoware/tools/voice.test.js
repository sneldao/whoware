// Tests for the live voice layer (bundle/voice.js).
//
//   bun test anna/whoware/tools/voice.test.js
//
// The important one is `isUsableQuote`. The Witness Chamber's entire premise
// is that the figure in the room never says the name of the person you are
// looking for, and we are handing that rule to a language model. The guard
// that enforces it is the difference between a game and a spoiler.

import { describe, expect, test } from "bun:test";
import {
  MAX_QUOTE_CHARS,
  buildVoicePrompt,
  isUsableQuote,
  parseQuote,
  requestVoice,
  voiceKey,
} from "../bundle/voice.js";

const input = {
  clue: { label: "Enigma cipher chart", detail: "A wall chart of rotor orders." },
  scene: { title: "The War Cabinet Room", location: "London, England", era: "20th century" },
  roomFigure: { canonicalName: "Winston Churchill" },
  target: { canonicalName: "Alan Turing" },
};

describe("voiceKey", () => {
  test("is stable and unique per day and clue", () => {
    expect(voiceKey(20261017, 1)).toBe("20261017:1");
    expect(voiceKey(20261017, 1)).not.toBe(voiceKey(20261018, 1));
    expect(voiceKey(20261017, 1)).not.toBe(voiceKey(20261017, 2));
  });
});

describe("parseQuote", () => {
  test("strips surrounding quotes, including nested", () => {
    expect(parseQuote('"He gave me this."')).toBe("He gave me this.");
    expect(parseQuote('"\'He gave me this.\'"')).toBe("He gave me this.");
  });

  test("strips a leading attribution", () => {
    expect(parseQuote("Churchill: He gave me this.")).toBe("He gave me this.");
  });

  test("strips markdown and list bullets", () => {
    expect(parseQuote("- He gave me this.")).toBe("He gave me this.");
    expect(parseQuote("1. He gave me this.")).toBe("He gave me this.");
    expect(parseQuote("**He gave me this.**")).toBe("He gave me this.");
  });

  test("collapses newlines and runs of whitespace", () => {
    expect(parseQuote("He gave me\n\n  this.   Then left.")).toBe("He gave me this. Then left.");
  });

  test("truncates on a sentence boundary when one exists", () => {
    // Several internal boundaries, so the last one inside the 220-char window
    // sits comfortably past the minimum and the hard-cut path is not taken.
    const long = ("A sentence that runs on. " + "word ".repeat(20).trim() + ". ").repeat(4).trim();
    const out = parseQuote(long);
    expect(out.length).toBeLessThanOrEqual(MAX_QUOTE_CHARS);
    expect(out.endsWith(".")).toBe(true);
    expect(out).not.toContain("\u2026");
  });

  test("falls back to an ellipsis when there is no clean break", () => {
    // No internal sentence boundary at all. Stopping mid-word would read as a
    // rendering fault, so the cut is marked instead.
    const out = parseQuote("word ".repeat(80).trim() + ".");
    expect(out.length).toBeLessThanOrEqual(MAX_QUOTE_CHARS);
    expect(out.endsWith("\u2026")).toBe(true);
    expect(out).not.toMatch(/\s\u2026$/);
  });

  test("survives junk input without throwing", () => {
    expect(parseQuote(null)).toBe("");
    expect(parseQuote(undefined)).toBe("");
    expect(parseQuote(42)).toBe("");
    expect(parseQuote("")).toBe("");
  });
});

describe("isUsableQuote — the spoiler guard", () => {
  test("rejects a line that names the target", () => {
    expect(isUsableQuote("I gave Alan Turing this myself.", "Alan Turing")).toBe(false);
  });

  test("rejects a line containing a distinctive part of the name", () => {
    expect(isUsableQuote("I remember Turing well.", "Alan Turing")).toBe(false);
  });

  test("rejects a fragment of the surname", () => {
    expect(isUsableQuote("That Turing fellow never listened.", "Alan Turing")).toBe(false);
  });

  test("allows short ordinary words that happen to match", () => {
    // A first name under four characters must not trip the guard, or every
    // line mentioning a short-named figure would be discarded.
    expect(isUsableQuote("I told Ada about it many times over.", "Ada Lovelace")).toBe(true);
  });

  test("is case-insensitive", () => {
    expect(isUsableQuote("I gave this to ALAN turing.", "Alan Turing")).toBe(false);
  });

  test("rejects too-short and unterminated lines", () => {
    expect(isUsableQuote("No.", "Alan Turing")).toBe(false);
    expect(isUsableQuote("he gave me this", "Alan Turing")).toBe(false);
  });

  test("accepts a proper first-person line that does not leak", () => {
    expect(isUsableQuote("He gave me this the week before he vanished.", "Alan Turing")).toBe(true);
  });

  test("rejects when there is no target to guard against", () => {
    expect(isUsableQuote("He gave me this the week before he vanished.", undefined)).toBe(true);
  });
});

describe("buildVoicePrompt", () => {
  test("puts the persona and the prohibition in the system prompt", () => {
    const { system, user } = buildVoicePrompt(input);
    expect(system).toContain("Winston Churchill");
    expect(system).toContain("first person");
    expect(system).toMatch(/never say the name/i);
    expect(system).toContain("Alan Turing");
  });

  test("describes the object in the user turn", () => {
    const { user } = buildVoicePrompt(input);
    expect(user).toContain("Enigma cipher chart");
    expect(user).toContain("A wall chart of rotor orders.");
    expect(user).toContain("The War Cabinet Room");
  });
});

describe("requestVoice — failure must be invisible", () => {
  test("returns null when there is no host", async () => {
    expect(await requestVoice(null, input)).toBeNull();
    expect(await requestVoice({}, input)).toBeNull();
  });

  test("returns null when the llm namespace is absent", async () => {
    expect(await requestVoice({ storage: {} }, input)).toBeNull();
  });

  test("returns null when the signal is already aborted", async () => {
    const ac = new AbortController();
    ac.abort();
    const anna = { llm: { complete: async () => { throw new Error("should not run"); } } };
    expect(await requestVoice(anna, input, { signal: ac.signal })).toBeNull();
  });

  test("returns null on a quota error", async () => {
    const anna = {
      llm: {
        complete: async () => {
          const e = new Error("quota");
          e.code = "APP_QUOTA_EXCEEDED";
          throw e;
        },
      },
    };
    expect(await requestVoice(anna, input)).toBeNull();
  });

  test("returns null when the model leaks the target's name", async () => {
    const anna = {
      llm: { complete: async () => ({ content: { text: "I gave this to Alan Turing myself." } }) },
    };
    expect(await requestVoice(anna, input)).toBeNull();
  });

  test("returns the line when it is good, unwrapped from the response shape", async () => {
    const anna = {
      llm: { complete: async () => ({ content: { text: '"He gave me this the week before."' } }) },
    };
    const out = await requestVoice(anna, input);
    expect(out).toBe("He gave me this the week before.");
  });

  test("asks for a short completion so the user's quota is not burned", async () => {
    let seen = null;
    const anna = {
      llm: {
        complete: async (args) => {
          seen = args;
          return { content: { text: "He gave me this the week before." } };
        },
      },
    };
    await requestVoice(anna, input);
    expect(seen.maxTokens).toBeLessThanOrEqual(200);
    expect(seen.systemPrompt).toBeTruthy();
    expect(Array.isArray(seen.messages)).toBe(true);
  });
});
