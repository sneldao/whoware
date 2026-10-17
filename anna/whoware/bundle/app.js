// WhoWare — Anna App bundle entry.
//
// Static SPA, no build step. Talks to the host only through AnnaAppRuntime:
//   anna.storage.*  — per-user durable KV (APS): streak, score, guess log
//   anna.window.*   — window chrome
// The episode itself is read-only global data from ./episode.json, generated
// at curation time by tools/build-fixture-episode.ts.
//
// Grants required by manifest.ui.host_api:
//   storage: get, set     window: set_title, ready
//
// Structure:
//   game.js    pure rules — scoring, streak, guess evaluation, share text
//   motion.js  cancellable motion + dust motes
//   app.js     this file — APS state, view lifecycle, DOM
//
// Views are built once and *patched*, not torn down. The previous version
// did `app.innerHTML = ""` on every clue reveal, which destroyed and rebuilt
// the panorama layer and dropped focus mid-interaction.

import { AnnaAppRuntime } from "/static/anna-apps/_sdk/latest/index.js";
import {
  applySolve,
  buildShareText,
  defaultProfile,
  detectiveGrade,
  evaluateGuess,
  recordMiss,
  runSummary,
  scoreCeiling,
  streakSummary,
} from "./game.js";
import { crossfade, reducedMotion, startDust, typewriter } from "./motion.js";
import { ensureVoice, voiceKey } from "./voice.js";

const MAX_GUESS_CHARS = 64;
const SITE_URL = "https://whoware.vercel.app";

let episode = null;
let anna = null; // null when running standalone (bundle opened directly)

// ── Per-user state (APS) ───────────────────────────────────────────
//
// Only mutable data lives here. Everything in episode.json is global and
// read-only — see ANNA.md §3 for the split and why aps.kv cannot hold the
// catalog.
//
// Two keys, deliberately separated:
//
//   whoware/profile      durable across days — streak, best, day history
//   whoware/run/<day>    one day's in-flight run
//
// The first version kept `streak` inside the run record. Because a new
// episode resets the run, every new day silently zeroed the streak — which
// is the one mechanic the whole daily loop rests on.

const PROFILE_KEY = "whoware/profile";
const runKey = (day) => `whoware/run/${day}`;

const defaultRun = () => ({
  sceneIndex: 0,
  guessesLeft: 0,
  hintsLeft: 0,
  cluesFound: [],
  guesses: [],
  score: 0,
  solved: false,
  exhausted: false,
  lastHint: null,
  /** clueKey -> the figure's live line. Cached with the day's run so a
   * returning player is never charged twice for the same quote. */
  voice: {},
});

let state = defaultRun();
let profile = defaultProfile();

function startState(ep) {
  return {
    ...defaultRun(),
    guessesLeft: ep.tuning.guessLimit,
    hintsLeft: ep.tuning.hintLimit,
  };
}

// APS `storage.get` returns `{value, exists}` — a stored `null` is
// indistinguishable from a miss if you branch on `value` alone.
async function readKey(key) {
  if (!anna) return null;
  try {
    const res = await anna.storage.get({ key });
    return res?.exists ? res.value : null;
  } catch (e) {
    console.warn(`storage get failed (${key})`, e);
    return null;
  }
}

async function writeKey(key, value) {
  if (!anna) return;
  try {
    await anna.storage.set({ key, value });
  } catch (e) {
    // Best-effort: a failed write must never break an in-progress run.
    console.warn(`storage set failed (${key})`, e);
  }
}

const saveState = () => writeKey(runKey(episode.episodeDay), state);
const saveProfile = () => writeKey(PROFILE_KEY, profile);

async function loadState() {
  const [p, r] = await Promise.all([readKey(PROFILE_KEY), readKey(runKey(episode.episodeDay))]);
  if (p) profile = { ...defaultProfile(), ...p };
  if (r) state = { ...defaultRun(), ...r };
}

// ── DOM helpers ───────────────────────────────────────────────────

const app = document.getElementById("app");
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

function applyPalette(scene) {
  const p = scene.palette ?? [];
  if (p[0]) document.body.style.setProperty("--ink", p[0]);
  if (p[1]) document.body.style.setProperty("--deep", p[1]);
  if (p[2]) document.body.style.setProperty("--accent", p[2]);
  if (p[3]) document.body.style.setProperty("--parchment", p[3]);
}

function currentScene() {
  return episode.scenes[Math.min(state.sceneIndex ?? 0, episode.scenes.length - 1)];
}

function totalClues() {
  return episode.scenes.reduce((n, s) => n + s.clues.length, 0);
}

function isRunInProgress() {
  return !state.solved && !state.exhausted && (state.guesses.length > 0 || state.cluesFound.length > 0);
}

// ── View lifecycle ────────────────────────────────────────────────
//
// Every view owns its teardown. Aborting the controller stops the
// typewriter; calling `stopDust` cancels the rAF loop. Without this, moving
// between views leaked a timer chain and a full-screen canvas animation
// every time.

let disposeView = () => {};
let stopDust = () => {};
let roomRefs = null; // node handles of the mounted room, for in-place patching

function mountView(build) {
  disposeView();
  roomRefs = null;
  const controller = new AbortController();
  disposeView = () => {
    controller.abort();
    stopDust();
    stopDust = () => {};
  };
  app.replaceChildren();
  build(controller.signal);
}

// ── Entry gate (cold path) ────────────────────────────────────────
//
// A user arriving from a chat mention sees a room with two mystery dots and
// no framing. The gate is what the native app's threshold does: episode
// number, tier, who is in the room, and one Enter. It is also where the
// return-recap branches, because that is exactly the "you left off" moment.

function renderGate(signal, { resumed }) {
  const wrap = el("div", "gate");

  const plate = el("div", "plate");
  plate.append(
    el("div", "plate-kicker", episode.witnessChamber ? "The Witness Chamber" : "Daily case"),
    el("h1", "plate-title", "WhoWare"),
    el("p", "plate-tag", "Someone changed history from this room. Name them.")
  );

  const meta = el("dl", "plate-meta");
  const addMeta = (k, v) => {
    meta.append(el("dt", null, k), el("dd", null, v));
  };
  addMeta("Episode", `#${String(episode.episodeDay).slice(-3)}`);
  addMeta("Tier", episode.difficulty);
  if (episode.witnessChamber) addMeta("In the room", episode.roomFigure.canonicalName);
  addMeta("Streak", profile.streak ? `${profile.streak} day${profile.streak === 1 ? "" : "s"}` : "none yet");
  plate.append(meta);
  wrap.append(plate);

  if (resumed) {
    const recap = el("div", "recap");
    recap.append(el("div", "recap-title", "Where you left off"));
    const line = el("p", "recap-line");
    line.textContent =
      `${state.cluesFound.length} of ${totalClues()} clues opened · ` +
      `${state.guesses.length} guess${state.guesses.length === 1 ? "" : "es"} spent · ` +
      `${state.guessesLeft} left`;
    recap.append(line);
    if (state.guesses.length) {
      const last = state.guesses[state.guesses.length - 1];
      recap.append(el("p", "recap-proximity", last.prose));
    }
    plate.append(recap);
  }

  const enter = el("button", "btn primary gate-enter", resumed ? "Resume the room" : "Enter the room");
  enter.addEventListener("click", () => {
    // Sound/analytics would hook here; first interaction unlocks autoplay.
    renderRoom();
  });
  wrap.append(enter);

  const howto = el("p", "gate-howto");
  howto.innerHTML =
    "Inspect what is in the room, read what the figure says about it, then name the one they knew.";
  wrap.append(howto);

  app.append(wrap);
  if (!reducedMotion()) wrap.classList.add("rise-in");
  void signal;
}

// ── Room ──────────────────────────────────────────────────────────

function renderRoom() {
  mountView((signal) => {
    const scene = currentScene();
    applyPalette(scene);

    const wrap = el("div", "room");
    const refs = {};

    // HUD — patched in place, never rebuilt.
    const hud = el("div", "hud");
    refs.clues = el("span", "hud-item");
    refs.guesses = el("span", "hud-item");
    refs.ceiling = el("span", "hud-item");
    hud.append(refs.clues, refs.guesses, refs.ceiling);
    wrap.append(hud);

    // Hint feedback line — the previous version revealed a clue silently.
    refs.hintLine = el("p", "hint-line");
    refs.hintLine.hidden = true;
    wrap.append(refs.hintLine);

    refs.log = el("div", "log");
    refs.log.hidden = true;
    wrap.append(refs.log);

    // Stage
    const stage = el("div", "stage");
    const backdrop = scene.imageUrl ?? scene.panorama ?? null;
    if (backdrop) stage.style.setProperty("--backdrop", `url("${backdrop}")`);

    stage.append(el("div", "scene-title", scene.title));
    stage.append(el("p", "ambient", scene.ambientText));

    refs.hotspots = el("div", "hotspots");
    stage.append(refs.hotspots);

    refs.exhibitSlot = el("div", "exhibit-slot");
    stage.append(refs.exhibitSlot);

    // Objective: say what to do, once, in the room.
    refs.objective = el("p", "objective");
    stage.append(refs.objective);

    wrap.append(stage);

    // Controls
    const bar = el("div", "controls");
    refs.guessBtn = el("button", "btn primary", "Guess");
    refs.guessBtn.addEventListener("click", openGuessSheet);
    refs.hintBtn = el("button", "btn", "Hint");
    refs.hintBtn.addEventListener("click", spendHint);
    refs.nextBtn = el("button", "btn ghost", "Next scene");
    refs.nextBtn.addEventListener("click", advanceScene);
    bar.append(refs.guessBtn, refs.hintBtn, refs.nextBtn);
    wrap.append(bar);

    app.append(wrap);

    // Dust sits above the backdrop but below the text layer.
    const canvas = el("canvas", "dust");
    canvas.setAttribute("aria-hidden", "true");
    stage.prepend(canvas);
    stopDust = startDust(canvas, { color: scene.palette?.[2] });

    // Signal-driven teardown, so leaving the room always stops the loop even
    // if the view is swapped by a path that skips mountView's disposer.
    signal.addEventListener("abort", () => stopDust(), { once: true });

    roomRefs = refs;
    renderRoomScene(refs);
  });
}

function renderRoomScene(refs) {
  const scene = currentScene();
  const revealed = new Set(state.cluesFound);
  const ceiling = scoreCeiling(episode, state);

  refs.clues.textContent = `CLUES ${state.cluesFound.length}/${totalClues()}`;
  refs.guesses.textContent = `GUESSES ${state.guessesLeft}`;
  refs.ceiling.textContent = `CEILING ${ceiling}`;

  // Hint line — explain what the hint did, instead of a silent reveal.
  if (state.lastHint) {
    refs.hintLine.textContent = state.lastHint;
    refs.hintLine.hidden = false;
  } else {
    refs.hintLine.hidden = true;
  }

  // Deduction log
  if (state.guesses.length) {
    refs.log.replaceChildren(
      ...state.guesses
        .slice()
        .reverse()
        .map((g) => el("div", "log-row", `${g.text} — ${g.prose}`)),
    );
    refs.log.hidden = false;
  } else {
    refs.log.hidden = true;
  }

  // Hotspots — only unrevealed ones remain.
  const dots = scene.clues
    .filter((c) => !revealed.has(c.index))
    .map((c) => {
      const dot = el("button", "hotspot");
      dot.style.left = `${c.x * 100}%`;
      dot.style.top = `${c.y * 100}%`;
      dot.setAttribute("aria-label", `Inspect: ${c.label}`);
      // Visible affordance — the old dot gave a sighted user nothing to go on.
      dot.append(el("span", "hotspot-tip", "Inspect"));
      dot.addEventListener("click", () => revealClue(c));
      return dot;
    });
  refs.hotspots.replaceChildren(...dots);

  // Exhibit — the most recently revealed clue in this scene.
  const open = scene.clues.filter((c) => revealed.has(c.index)).at(-1);
  if (open) {
    const box = el("figure", "exhibit");
    box.append(el("figcaption", "exhibit-no", `CLUE ${String(open.index).padStart(2, "0")}`));
    box.append(el("h3", "exhibit-label", open.label));
    box.append(el("p", "exhibit-detail", open.detail));
    // The figure's line. A live one is preferred; the curated quote is the
    // instant fallback, so the exhibit is never empty and never blocked.
    const vkey = voiceKey(episode.episodeDay, open.index);
    const live = state.voice?.[vkey];
    const line = live ?? open.figureQuote;
    if (line) {
      const q = el("blockquote", "quote");
      q.append(el("p", "quote-line", line), el("cite", null, `\u2014 ${episode.roomFigure.canonicalName}`));
      if (live) q.classList.add("live");
      box.append(q);
    }
    // Declassification wipe — the native app's "censor bar" beat.
    if (!reducedMotion()) {
      const bar = el("div", "censor");
      box.append(bar);
      requestAnimationFrame(() => bar.classList.add("retract"));
    }
    refs.exhibitSlot.replaceChildren(box);
  } else {
    refs.exhibitSlot.replaceChildren();
  }

  // Objective
  const remaining = dots.length;
  refs.objective.textContent = remaining
    ? `${remaining} object${remaining === 1 ? "" : "s"} in this room ${remaining === 1 ? "is" : "are"} unopened.`
    : "Nothing left here. Move on, or name who changed history.";

  // Controls
  refs.hintBtn.disabled = state.hintsLeft <= 0 || state.cluesFound.length >= totalClues();
  refs.hintBtn.textContent = state.hintsLeft ? `Hint (${state.hintsLeft})` : "No hints left";
  refs.nextBtn.disabled = state.sceneIndex >= episode.scenes.length - 1;
  refs.nextBtn.textContent =
    state.sceneIndex >= episode.scenes.length - 1 ? "Last scene" : `Scene ${state.sceneIndex + 2}`;
}

// ── Actions ───────────────────────────────────────────────────────

function revealClue(clue) {
  if (state.cluesFound.includes(clue.index)) return;
  state.cluesFound = [...state.cluesFound, clue.index].sort((a, b) => a - b);
  saveState();
  patchRoom();
  speakFor(clue);
}

/**
 * Ask the host for this clue's line, then upgrade the exhibit in place.
 *
 * Deliberately not awaited: the exhibit is already showing the curated quote,
 * so the room is playable immediately and this only ever enriches it. Any
 * failure -- not granted, out of quota, no eligible model -- is swallowed by
 * requestVoice and leaves the curated line standing.
 */
function speakFor(clue) {
  ensureVoice({
    anna,
    state,
    episode,
    scene: currentScene(),
    clue,
    onLine: () => {
      saveState();
      // Only repaint if this clue is the one currently on display.
      const shown = currentScene().clues.filter((c) => state.cluesFound.includes(c.index)).at(-1);
      if (shown?.index === clue.index) patchRoom();
    },
  });
}

function spendHint() {
  if (state.hintsLeft <= 0) return;
  const scene = currentScene();
  const hidden = scene.clues.find((c) => !state.cluesFound.includes(c.index));
  if (!hidden) return;
  state.hintsLeft -= 1;
  state.cluesFound = [...state.cluesFound, hidden.index].sort((a, b) => a - b);
  state.lastHint = `A hand points to “${hidden.label}.”`;
  saveState();
  patchRoom();
}

function advanceScene() {
  if (state.sceneIndex >= episode.scenes.length - 1) return;
  state.sceneIndex += 1;
  saveState();
  // Scene change repaints the backdrop, so rebuild the room rather than
  // patching — but go through the transition so it is not a hard cut.
  crossfade(app, renderRoom);
}

// patchRoom updates the mounted room in place — no teardown, so the
// panorama layer, the dust canvas and focus all survive a clue reveal.
function patchRoom() {
  if (roomRefs) renderRoomScene(roomRefs);
  else renderRoom();
}

function openGuessSheet() {
  mountView(() => {
    const sheet = el("div", "sheet");
    const input = el("input", "guess-input");
    input.maxLength = MAX_GUESS_CHARS;
    input.placeholder = episode.witnessChamber ? `Who did ${episode.roomFigure.canonicalName} mean?` : "Name the one who changed history";
    input.setAttribute("aria-label", "Your guess");
    input.setAttribute("autocomplete", "off");

    const submit = el("button", "btn primary", "Commit");
    const cancel = el("button", "btn ghost", "Back");

    const commit = () => {
      const result = evaluateGuess(input.value, episode);
      state.guessesLeft -= 1;
      state.guesses.push({ text: input.value.trim(), prose: result.prose, proximity: result.proximity });
      state.lastHint = null;
      if (result.correct) {
        state.score = scoreCeiling(episode, state);
        profile = applySolve(profile, episode, state.score);
        state.solved = true;
        saveProfile();
      } else if (state.guessesLeft <= 0) {
        state.exhausted = true;
        state.score = 0;
        profile = recordMiss(profile, episode);
        saveProfile();
      }
      saveState();
      renderVerdict();
    };

    submit.addEventListener("click", commit);
    cancel.addEventListener("click", () => renderRoom());
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") commit();
    });

    const actions = el("div", "sheet-actions");
    actions.append(cancel, submit);
    sheet.append(
      el("p", "sheet-kicker", episode.witnessChamber ? `${episode.roomFigure.canonicalName} is speaking about someone.` : "Name the one"),
      input,
      el("p", "sheet-help", `${state.guessesLeft} guess${state.guessesLeft === 1 ? "" : "es"} remaining. Enter to commit, Esc to back out.`),
      actions,
    );
    app.append(sheet);
    input.focus();
  });
}

// ── Verdict ───────────────────────────────────────────────────────

function renderVerdict() {
  mountView((signal) => {
    const solved = state.solved;
    const grade = solved ? detectiveGrade(state.score) : null;
    const wrap = el("div", `verdict ${solved ? "solved" : "exhausted"}`);

    const ack = el("p", "ack");
    const name = el("h1", "reveal");

    if (solved) {
      // Witness Chamber acknowledgment, then the name — the order matters.
      typewriter(ack, `${episode.roomFigure.canonicalName} nods slowly.`, { signal }).then(() => {
        if (!signal.aborted) typewriter(name, episode.target.canonicalName, { speed: 55, signal });
      });
    } else {
      ack.textContent = `The signal fades. ${episode.roomFigure.canonicalName} says nothing.`;
      name.textContent = episode.target.canonicalName;
    }
    wrap.append(ack, name);
    wrap.append(el("p", "summary", episode.targetSummary));
    wrap.append(el("div", "grade", solved ? `${grade} · ${state.score} points` : "No points today"));
    wrap.append(el("div", "streak", streakSummary(profile, !solved)));
    wrap.append(el("p", "summary-template", runSummary(profile, state, episode)));
    wrap.append(renderShare());
    app.append(wrap);

    if (solved) {
      const again = el("button", "btn primary", "Play again");
      again.addEventListener("click", () => {
        // Replaying resets the run only — the streak lives in the profile.
        state = startState(episode);
        saveState();
        renderRoom();
      });
      wrap.append(again);
    }
  });
}

// ── Share ─────────────────────────────────────────────────────────

function shareText() {
  return buildShareText({
    episodeDay: episode.episodeDay,
    figureName: episode.target.canonicalName,
    outcome: state.solved ? "solved" : "exhausted",
    score: state.score,
    grade: state.solved ? detectiveGrade(state.score) : null,
    streak: profile.streak,
    guessesUsed: state.guesses.length,
    maxGuesses: episode.tuning.guessLimit,
    difficulty: episode.difficulty,
    era: episode.target.era,
    region: episode.target.region,
    siteUrl: SITE_URL,
  });
}

function renderShare() {
  const text = shareText();
  const block = el("div", "share");
  const status = el("span", "share-status");

  block.append(el("pre", "share-text", text));

  const row = el("div", "share-row");
  if (navigator.share) {
    const native = el("button", "btn primary", "Share");
    native.addEventListener("click", async () => {
      try {
        await navigator.share({ text });
      } catch (e) {
        if (e?.name !== "AbortError") status.textContent = "Share cancelled";
      }
    });
    row.append(native);
  }
  const copy = el("button", navigator.share ? "btn" : "btn primary", "Copy");
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = "Copied";
    } catch {
      status.textContent = "Select and copy above";
    }
  });
  row.append(copy);

  block.append(row, status);
  return block;
}

// ── Keyboard ──────────────────────────────────────────────────────
//
// The native app binds Esc/G/N/1–9. Cheap here, and it is the difference
// between "usable" and "fast" for anyone who plays several days running.

function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

  if (e.key === "Escape") {
    if (app.querySelector(".sheet")) renderRoom();
    return;
  }
  if (typing) return;

  const k = e.key.toLowerCase();
  if (k === "g") {
    e.preventDefault();
    if (!state.solved && !state.exhausted) openGuessSheet();
  } else if (k === "h") {
    e.preventDefault();
    spendHint();
  } else if (k === "n") {
    e.preventDefault();
    advanceScene();
  } else if (/^[1-9]$/.test(e.key)) {
    const idx = Number(e.key) - 1;
    if (idx < episode.scenes.length) {
      e.preventDefault();
      state.sceneIndex = idx;
      saveState();
      crossfade(app, renderRoom);
    }
  }
}

// ── Boot ──────────────────────────────────────────────────────────

async function main() {
  const res = await fetch("./episode.json");
  episode = await res.json();
  state = startState(episode);

  try {
    anna = await AnnaAppRuntime.connect();
    await anna.window.set_title({ title: "WhoWare — name who changed history" });
    await anna.window.ready?.();
    // A returning player lands back in the run they left; the profile
    // (streak, history) loads regardless of which day the run belongs to.
    await loadState();
  } catch (e) {
    anna = null;
    console.info("standalone preview — APS disabled", e);
  }

  // Cold start always shows the gate. Resumed runs get the recap on it,
  // rather than dropping straight into a room with no framing.
  mountView((signal) => renderGate(signal, { resumed: isRunInProgress() }));

  document.addEventListener("keydown", onKey);
}

main();
