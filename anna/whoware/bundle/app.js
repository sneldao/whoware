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

import { AnnaAppRuntime } from "/static/anna-apps/_sdk/latest/index.js";
import {
  applySolve,
  defaultProfile,
  detectiveGrade,
  evaluateGuess,
  recordMiss,
  runSummary,
  scoreCeiling,
  streakSummary,
} from "./game.js";

const MAX_GUESS_CHARS = 64;

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

// ── Rendering ─────────────────────────────────────────────────────

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

// A real curated episode carries `imageUrl` (Venice panorama). The fixture
// falls back to a generated SVG so the room never renders as an empty box.
function sceneBackdrop(scene) {
  return scene.imageUrl ? `url("${scene.imageUrl}")` : null;
}

function currentScene() {
  return episode.scenes[Math.min(state.sceneIndex ?? 0, episode.scenes.length - 1)];
}

function render() {
  app.innerHTML = "";
  applyPalette(currentScene());

  if (state.solved || state.exhausted) return renderVerdict();
  renderRoom();
}

function renderRoom() {
  const scene = currentScene();
  const wrap = el("div", "room");

  const hud = el("div", "hud");
  hud.append(
    el("span", "hud-item", `CLUES ${state.cluesFound.length}/${totalClues()}`),
    el("span", "hud-item", `GUESSES ${state.guessesLeft}`),
    el("span", "hud-item", `CEILING ${scoreCeiling(episode, state)}`)
  );
  wrap.append(hud);

  if (state.guesses.length) wrap.append(renderLog());

  const stage = el("div", "stage");
  const backdrop = sceneBackdrop(scene) ?? (scene.panoramaDataUri ? `url("${scene.panoramaDataUri}")` : null);
  if (backdrop) stage.style.setProperty("--backdrop", backdrop);
  const title = el("div", "scene-title", scene.title);
  const ambient = el("div", "ambient", scene.ambientText);
  stage.append(title, ambient);

  // Hotspots. One declassified up-front per short-mode tuning so a cold
  // user has something to work from immediately.
  const revealed = new Set(state.cluesFound);
  scene.clues.forEach((clue) => {
    if (!revealed.has(clue.index)) {
      const dot = el("button", "hotspot");
      dot.style.left = `${clue.x * 100}%`;
      dot.style.top = `${clue.y * 100}%`;
      dot.setAttribute("aria-label", `Undisclosed clue ${clue.index}`);
      dot.addEventListener("click", () => revealClue(clue));
      stage.append(dot);
    }
  });

  if (revealed.size) {
    const open = scene.clues.find((c) => revealed.has(c.index));
    if (open) stage.append(renderExhibit(open));
  }

  wrap.append(stage);
  wrap.append(renderControls(scene));
  app.append(wrap);
}

function totalClues() {
  return episode.scenes.reduce((n, s) => n + s.clues.length, 0);
}

function renderExhibit(clue) {
  const box = el("figure", "exhibit");
  box.append(el("figcaption", "exhibit-no", `CLUE ${String(clue.index).padStart(2, "0")}`));
  box.append(el("h3", "exhibit-label", clue.label));
  box.append(el("p", "exhibit-detail", clue.detail));
  if (clue.figureQuote) {
    const q = el("blockquote", "quote");
    q.append(el("p", null, clue.figureQuote));
    q.append(el("cite", null, `— ${episode.roomFigure.canonicalName}`));
    box.append(q);
  }
  return box;
}

function renderLog() {
  const log = el("div", "log");
  for (const g of state.guesses.slice().reverse()) {
    log.append(el("div", "log-row", `${g.text} — ${g.prose}`));
  }
  return log;
}

function renderControls(scene) {
  const bar = el("div", "controls");

  const guessBtn = el("button", "btn primary", "Guess");
  guessBtn.addEventListener("click", openGuessSheet);
  bar.append(guessBtn);

  if (state.cluesFound.length < totalClues()) {
    const hintBtn = el("button", "btn", "Hint");
    hintBtn.disabled = state.hintsLeft <= 0;
    hintBtn.addEventListener("click", spendHint);
    bar.append(hintBtn);
  }

  const next = el("button", "btn ghost", "Next scene");
  next.disabled = state.sceneIndex >= episode.scenes.length - 1;
  next.addEventListener("click", () => {
    state.sceneIndex = (state.sceneIndex ?? 0) + 1;
    saveState();
    render();
  });
  bar.append(next);

  return bar;
}

// ── Actions ───────────────────────────────────────────────────────

function revealClue(clue) {
  state.cluesFound = [...new Set([...state.cluesFound, clue.index])].sort((a, b) => a - b);
  saveState();
  render();
}

function spendHint() {
  if (state.hintsLeft <= 0) return;
  state.hintsLeft -= 1;
  const scene = currentScene();
  const hidden = scene.clues.find((c) => !state.cluesFound.includes(c.index));
  if (hidden) state.cluesFound = [...state.cluesFound, hidden.index].sort((a, b) => a - b);
  saveState();
  render();
}

function openGuessSheet() {
  const sheet = el("div", "sheet");
  const input = el("input", "guess-input");
  input.maxLength = MAX_GUESS_CHARS;
  input.placeholder = "Name the one who changed history";
  input.setAttribute("aria-label", "Your guess");

  const submit = el("button", "btn primary", "Commit");
  const cancel = el("button", "btn ghost", "Back");

  const close = () => render();

  submit.addEventListener("click", () => {
    const result = evaluateGuess(input.value, episode);
    state.guessesLeft -= 1;
    state.guesses.push({ text: input.value.trim(), prose: result.prose, proximity: result.proximity });
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
    close();
  });

  cancel.addEventListener("click", close);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit.click();
  });

  const actions = el("div", "sheet-actions");
  actions.append(cancel, submit);
  sheet.append(input, actions);
  app.innerHTML = "";
  app.append(sheet);
  input.focus();
}

function renderVerdict() {
  const solved = state.solved;
  const grade = solved ? detectiveGrade(state.score) : null;

  const wrap = el("div", `verdict ${solved ? "solved" : "exhausted"}`);

  if (episode.witnessChamber) {
    wrap.append(el("p", "ack", `${episode.roomFigure.canonicalName} nods slowly.`));
  }

  if (solved) {
    const name = el("h1", "reveal");
    typewrite(name, episode.target.canonicalName);
    wrap.append(name);
    wrap.append(el("p", "summary", episode.targetSummary));
    wrap.append(el("div", "grade", `${grade} · ${state.score} points`));
    wrap.append(el("div", "streak", streakLine()));
  } else {
    wrap.append(el("h1", "reveal", episode.target.canonicalName));
    wrap.append(el("p", "summary", episode.targetSummary));
    wrap.append(el("p", "salvage", `The signal fades. ${episode.roomFigure.canonicalName} says nothing.`));
    wrap.append(el("div", "streak", streakLine(true)));
  }

  // The LLM reads this when summarising the window for the assistant.
  wrap.append(el("p", "summary-template", summaryForLlm()));

  const again = el("button", "btn primary", "Play again");
  again.addEventListener("click", () => {
    // Replaying resets the run only — the streak lives in the profile and
    // must survive, or the daily ritual has no memory.
    state = startState(episode);
    saveState();
    render();
  });
  wrap.append(again);

  app.append(wrap);
}

function streakLine(missed = false) {
  return streakSummary(profile, missed);
}

function summaryForLlm() {
  return runSummary(profile, state, episode);
}

function typewrite(node, text) {
  node.textContent = "";
  let i = 0;
  const tick = () => {
    if (i > text.length) return;
    node.textContent = text.slice(0, i++);
    setTimeout(tick, 45);
  };
  tick();
}

// ── Boot ──────────────────────────────────────────────────────────

async function main() {
  episode = await fetch("./episode.json").then((r) => r.json());
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

  render();
}

main();