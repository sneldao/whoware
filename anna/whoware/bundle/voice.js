// voice.js — the figure's voice, live.
//
// The Witness Chamber's whole conceit is that the figure in the room is a
// witness to someone who is NOT there, and speaks about them in first person
// without ever naming them. Until now that voice was entirely pre-baked at
// curation time, which is a problem for two reasons:
//
//   1. Anna only counts a Qualified App Run when the primary function actually
//      exercises AI, and a bundle whose only host calls are `storage.set` and
//      `window.set_title` is unlikely to register. See ANNA.md §1a.
//   2. It is not really the product. A deterministic template engine picking
//      from a bank of phrases is not a person remembering someone.
//
// So: when a clue is opened, we ask the host to speak that line. The curated
// `figureQuote` stays as the instant fallback and is never thrown away — if the
// call fails, is not granted, or is over quota, the exhibit still reads well.
//
// This never blocks play. The exhibit shows the curated line immediately and
// upgrades in place when the live line lands.

// ── Pure helpers (unit-tested in tools/voice.test.js) ──────────────

/** Stable per-episode-day + clue key, so a line is generated once and cached. */
export function voiceKey(episodeDay, clueIndex) {
  return `${episodeDay}:${clueIndex}`;
}

export const MAX_QUOTE_CHARS = 220;
const MIN_QUOTE_CHARS = 24;

/**
 * Strip the shapes a chat model wraps prose in: surrounding quotes, markdown
 * emphasis, a leading attribution ("Churchill: ..."), bullet dashes.
 */
export function parseQuote(raw) {
  if (typeof raw !== "string") return "";
  let s = raw.trim();

  // Drop a leading "Name:" style attribution.
  s = s.replace(/^[^:\n]{1,40}:\s*/, "");
  // Emphasis FIRST. A bullet regex of /^[-*]/ also matches the first
  // asterisk of a **bold** span and leaves a dangling "*" behind, so the
  // wrapper has to come off before we look for list markers.
  s = s.replace(/^\*\*(.+)\*\*$/s, "$1").replace(/^\*(.+)\*$/s, "$1");
  // Bullets and list numbering, but not a stray "**" left by an unwrap.
  s = s.replace(/^[-*•](?!\*)\s*/, "").replace(/^\d+[.)]\s*/, "");

  // Unwrap matched surrounding quotes, possibly nested.
  for (let i = 0; i < 2; i++) {
    const m = s.match(/^["'“‘](.*)["'”’]$/s);
    if (m) s = m[1].trim();
  }

  s = s.replace(/\s+/g, " ").trim();

  if (s.length > MAX_QUOTE_CHARS) {
    const cut = s.slice(0, MAX_QUOTE_CHARS);
    const lastStop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
    if (lastStop > MIN_QUOTE_CHARS) {
      s = cut.slice(0, lastStop + 1);
    } else {
      // No clean break available. Break on a word and mark it, because a
      // quote that just stops mid-word reads as a rendering fault.
      const at = cut.lastIndexOf(" ");
      s = (at > MIN_QUOTE_CHARS ? cut.slice(0, at) : cut).replace(/[\s.,;:\u2014-]+$/, "") + "\u2026";
    }
  }
  return s;
}

/**
 * A line is only usable if it sounds like a person and, critically, if it does
 * not give the game away. Naming the target in their own room would end the
 * puzzle, so a line that leaks the name is discarded in favour of the curated
 * one — the model cannot be trusted with the one rule that matters.
 */
export function isUsableQuote(text, targetName) {
  if (!text || text.length < MIN_QUOTE_CHARS) return false;
  if (!/[.!?…]"?$/.test(text)) return false;

  if (targetName) {
    const parts = String(targetName)
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 4);
    const hay = text.toLowerCase();
    if (parts.some((w) => hay.includes(w))) return false;
  }
  return true;
}

export function buildVoicePrompt({ clue, scene, roomFigure, target }) {
  const system = [
    `You are ${roomFigure.canonicalName}, speaking in the first person, standing in a room where something happened.`,
    `You are talking about ${target.canonicalName} — who is NOT in the room. You knew them well.`,
    `You must never say the name "${target.canonicalName}", or any part of it.`,
    `Speak only about this object, and about what this person meant to you through it.`,
    `One or two sentences, plain prose, plain present tense.`,
    `No quotation marks, no attribution, no name tags, no explanation of these instructions.`,
  ].join(" ");

  const user = [
    `Room: ${scene.title} — ${scene.location}.`,
    `You are looking at ${clue.label}.`,
    `What you see: ${clue.detail}`,
    `Say one line about the person you remember, in relation to this object.`,
  ].join(" ");

  return { system, user };
}

// ── Host call (impure) ─────────────────────────────────────────────

/**
 * Ask the host to speak the line. Returns the text, or null on any failure.
 *
 * Every failure mode here is expected and must stay invisible to the player:
 *   APP_NOT_GRANTED    user never granted the llm capability
 *   APP_QUOTA_EXCEEDED user's credits are spent
 *   APP_PROVIDER_ERROR no eligible model / provider down
 * None of them should produce an error state — the curated quote is already on
 * screen by the time this resolves.
 */
export async function requestVoice(anna, input, { signal } = {}) {
  if (!anna?.llm?.complete) return null;
  if (signal?.aborted) return null;

  const { system, user } = buildVoicePrompt(input);

  try {
    const res = await anna.llm.complete(
      {
        messages: [{ role: "user", content: user }],
        systemPrompt: system,
        // A spoken line is short. Asking for more just spends the user's quota.
        maxTokens: 120,
        temperature: 0.85,
      },
      { timeoutMs: 20000 },
    );

    const text = parseQuote(res?.content?.text ?? "");
    return isUsableQuote(text, input.target?.canonicalName) ? text : null;
  } catch (e) {
    // Quota, grant, provider, timeout — all soft. The curated line stands.
    console.info("voice: falling back to curated quote", e?.message ?? e);
    return null;
  }
}

// ── Cache ─────────────────────────────────────────────────────────

/**
 * One line, on demand.
 *
 * Called when a clue is opened rather than prefetching the whole scene: a
 * bulk request would spend the user's quota on lines they may never read, and
 * binding one call to one interaction keeps the AI step unambiguously part
 * of the primary function rather than incidental background work.
 *
 * `state.voice` is persisted with the day's run, so a returning player is
 * never charged twice for the same line.
 */
export async function ensureVoice({ anna, state, episode, scene, clue, signal, onLine }) {
  const key = voiceKey(episode.episodeDay, clue.index);
  if (state.voice?.[key]) return state.voice[key];

  const text = await requestVoice(
    anna,
    {
      clue: { label: clue.label, detail: clue.detail },
      scene: { title: scene.title, location: scene.location, era: scene.era },
      roomFigure: episode.roomFigure,
      target: episode.target,
    },
    { signal },
  );

  if (!text) return null;
  state.voice = { ...(state.voice ?? {}), [key]: text };
  onLine?.(key, text);
  return text;
}
