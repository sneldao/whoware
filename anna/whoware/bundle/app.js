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

const STATE_KEY = "whoware:run";
const MAX_GUESS_CHARS = 64;

let episode = null;
let anna = null; // null when running standalone (bundle opened directly)

// ── Per-user state (APS) ───────────────────────────────────────────
//
// Only mutable data lives here. Everything in episode.json is global and
// read-only — see ANNA.md §3 for the split and why aps.kv cannot hold the
// catalog.

const defaultState = () => ({
  episodeDay: null,
  guessesLeft: 0,
  hintsLeft: 0,
  cluesFound: [],
  guesses: [],
  score: 0,
  streak: 0,
  solved: false,
  exhausted: false,
});

let state = defaultState();

function startState(ep) {
  return {
    ...defaultState(),
    episodeDay: ep.episodeDay,
    guessesLeft: ep.tuning.guessLimit,
    hintsLeft: ep.tuning.hintLimit,
  };
}

async function saveState() {
  if (!anna) return;
  try {
    await anna.storage.set({ key: STATE_KEY, value: state });
  } catch (e) {
    // Storage is best-effort: a failed write must not break the run.
    console.warn("state save failed", e);
  }
}

async function loadState() {
  if (!anna) return;
  try {
    const res = await anna.storage.get({ key: STATE_KEY });
    const v = res?.value;
    if (v && v.episodeDay === episode.episodeDay) state = { ...defaultState(), ...v };
  } catch (e) {
    console.warn("state load failed", e);
  }
}

// ── Scoring by restraint (ANNA.md §5 — short mode) ────────────────
//
// Mirrors packages/backend/convex/scoring.ts in spirit: every scene opened,
// clue read, hint spent and wrong guess bleeds the ceiling.

function scoreCeiling(ep, s) {
  const t = ep.tuning;
  const base = 1000;
  const cluePenalty = s.cluesFound.length * 40;
  const hintPenalty = (t.hintLimit - s.hintsLeft) * 120;
  const guessPenalty = (t.guessLimit - s.guessesLeft) * 80;
  // Mercy is only a penalty when a mercy scene was actually taken. Charging
  // it unconditionally capped every run at 700 and made `archivist` (>800)
  // unreachable.
  const mercyPenalty = ep.scenes.some((sc, i) => sc.isMercy && i <= (s.sceneIndex ?? 0)) ? 300 : 0;
  return Math.max(0, base - cluePenalty - hintPenalty - guessPenalty - mercyPenalty);
}

function detectiveGrade(score) {
  if (score >= 800) return "archivist";
  if (score >= 600) return "curator";
  if (score >= 400) return "investigator";
  return "witness";
}

// ── Guess checking ─────────────────────────────────────────────────
//
// v1 accepts the target's canonical name or any alias. Proximity prose is
// resolved client-side against the bundled catalog — enough for the Anna
// slice, where only one episode ships. A production build should port
// packages/backend/convex/relationships.ts rather than grow this.

function normalise(s) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function candidates(target) {
  return [target.canonicalName, ...(target.aliases ?? [])];
}

function evaluateGuess(text, ep) {
  const g = normalise(text);
  if (!g) return { correct: false, proximity: "off", prose: "Say a name." };

  const t = ep.target;
  if (candidates(t).some((c) => normalise(c) === g)) {
    return { correct: true, proximity: "correct", prose: "That is the one." };
  }

  const near = candidates(t).some((c) => {
    const n = normalise(c);
    return n.includes(g) || g.includes(n);
  });
  if (near) {
    return {
      correct: false,
      proximity: "same_region",
      prose: `Close to the name — but not the one. Look again at what is on the desk.`,
    };
  }

  const eraHit = normalise(t.era).includes(g) || g.includes(normalise(t.era));
  const regionHit = normalise(t.region).includes(g) || g.includes(normalise(t.region));
  if (eraHit) return { correct: false, proximity: "same_era", prose: `That era, yes — but not the one.` };
  if (regionHit)
    return { correct: false, proximity: "same_region", prose: `That region, yes — but not the one.` };

  return { correct: false, proximity: "off", prose: `Nothing in this room points there.` };
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
      state.solved = true;
      state.streak = (state.streak ?? 0) + 1;
      state.score = scoreCeiling(episode, state);
    } else if (state.guessesLeft <= 0) {
      state.exhausted = true;
      state.score = 0;
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
  const grade = detectiveGrade(state.score);

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
  } else {
    wrap.append(el("h1", "reveal", episode.target.canonicalName));
    wrap.append(el("p", "summary", episode.targetSummary));
    wrap.append(el("p", "salvage", `The signal fades. ${episode.roomFigure.canonicalName} says nothing.`));
  }

  // The LLM reads this when summarising the window for the assistant.
  wrap.append(el("p", "summary-template", summaryForLlm()));

  const again = el("button", "btn primary", "Play again");
  again.addEventListener("click", () => {
    state = startState(episode);
    saveState();
    render();
  });
  wrap.append(again);

  app.append(wrap);
}

function summaryForLlm() {
  const outcome = state.solved
    ? `solved as ${episode.target.canonicalName}, ${detectiveGrade(state.score)}, ${state.score} points`
    : `did not solve; target was ${episode.target.canonicalName}`;
  return `WhoWare day ${episode.episodeDay}: ${outcome}. Streak ${state.streak ?? 0}. Guesses used ${state.guesses.length}/${episode.tuning.guessLimit}.`;
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
  state.sceneIndex = 0;

  try {
    anna = await AnnaAppRuntime.connect();
    await anna.window.set_title({ title: "WhoWare — name who changed history" });
    await anna.window.ready?.();
    await loadState();
    if (state.solved || state.exhausted) state.sceneIndex = 0;
  } catch (e) {
    anna = null;
    console.info("standalone preview — APS disabled", e);
  }

  render();
}

main();