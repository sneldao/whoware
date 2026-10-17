// game.js — pure game logic. No DOM, no host SDK, no network.
//
// Split out of app.js so the scoring and streak rules can be unit-tested in
// isolation (see tools/game.test.js). The streak is the mechanic the daily
// loop rests on; it should not only be reachable by clicking through a room.

// ── Scoring by restraint (ANNA.md §5 — short mode) ────────────────
//
// Mirrors packages/backend/convex/scoring.ts in spirit: every clue read,
// hint spent and wrong guess bleeds the ceiling.

export function scoreCeiling(ep, s) {
  const t = ep.tuning;
  const base = 1000;
  const cluePenalty = s.cluesFound.length * 40;
  const hintPenalty = (t.hintLimit - s.hintsLeft) * 120;
  const guessPenalty = (t.guessLimit - s.guessesLeft) * 80;
  // Mercy is only a penalty when a mercy scene was actually taken. Charging
  // it unconditionally capped every run at 700 and made `archivist`
  // (>800) unreachable.
  const mercyPenalty = ep.scenes.some((sc, i) => sc.isMercy && i <= (s.sceneIndex ?? 0)) ? 300 : 0;
  return Math.max(0, base - cluePenalty - hintPenalty - guessPenalty - mercyPenalty);
}

export function detectiveGrade(score) {
  if (score >= 800) return "archivist";
  if (score >= 600) return "curator";
  if (score >= 400) return "investigator";
  return "witness";
}

// ── Guess checking ─────────────────────────────────────────────────
//
// v1 accepts the target's canonical name or any alias. Proximity prose is
// resolved against the bundled catalog — enough for the Anna slice, where
// one episode ships. A production build should port
// packages/backend/convex/relationships.ts rather than grow this.

function normalise(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function candidates(target) {
  return [target.canonicalName, ...(target.aliases ?? [])];
}

export function evaluateGuess(text, ep) {
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
      prose: "Close to the name — but not the one. Look again at what is on the desk.",
    };
  }

  const eraHit = normalise(t.era).includes(g) || g.includes(normalise(t.era));
  const regionHit = normalise(t.region).includes(g) || g.includes(normalise(t.region));
  if (eraHit) return { correct: false, proximity: "same_era", prose: "That era, yes — but not the one." };
  if (regionHit) return { correct: false, proximity: "same_region", prose: "That region, yes — but not the one." };

  return { correct: false, proximity: "off", prose: "Nothing in this room points there." };
}

// ── Streak ─────────────────────────────────────────────────────────
//
// Consecutive solved days, in episode-day numbers. One skipped day may be
// absorbed by a freeze, per the README ritual. Pure: returns a new profile.

export const HISTORY_CAP = 60; // bound the history map against the APS byte quota

export function defaultProfile() {
  return {
    streak: 0,
    best: 0,
    freezes: 1,
    lastSolvedDay: null,
    history: {}, // "<day>": { solved, score, grade }
  };
}

/**
 * Record a completed run. Idempotent per day: solving the same episode twice
 * must not double-count the streak.
 */
export function applySolve(profile, ep, score) {
  const grade = detectiveGrade(score);
  const day = ep.episodeDay;
  const next = { ...profile, history: { ...profile.history } };

  // Only advance the chain forward. Replaying an already-solved day (or
  // backfilling an older one) records history but must not touch the
  // streak — comparing `!==` alone let a backfill reset the chain to 1.
  if (next.lastSolvedDay == null || day > next.lastSolvedDay) {
    const prev = next.lastSolvedDay;
    const consecutive = prev != null && day - prev === 1;
    const oneSkip = prev != null && day - prev === 2 && next.freezes > 0;

    if (consecutive) next.streak += 1;
    else if (oneSkip) {
      next.streak += 1; // the skipped day was absorbed; the chain is unbroken
      next.freezes -= 1;
    } else next.streak = 1;

    next.lastSolvedDay = day;
  }

  next.best = Math.max(next.best ?? 0, next.streak);
  next.history[day] = { solved: true, score, grade };

  const days = Object.keys(next.history)
    .map(Number)
    .sort((a, b) => a - b);
  if (days.length > HISTORY_CAP) for (const d of days.slice(0, days.length - HISTORY_CAP)) delete next.history[d];

  return next;
}

export function recordMiss(profile, ep) {
  const next = { ...profile, history: { ...profile.history } };
  next.history[ep.episodeDay] = { solved: false, score: 0, grade: null };
  return next;
}

export function streakSummary(profile, missed = false) {
  const n = profile.streak ?? 0;
  if (missed) {
    return profile.freezes > 0
      ? `Streak ${n} · a freeze is in reserve`
      : `Streak ${n} · no freeze in reserve`;
  }
  const day = n === 1 ? "day" : "days";
  return `Streak ${n} ${day} · best ${profile.best ?? n}`;
}

/** One-line state of the run for the assistant's window summary. */
export function runSummary(profile, state, ep) {
  const outcome = state.solved
    ? `solved as ${ep.target.canonicalName}, ${detectiveGrade(state.score)}, ${state.score} points`
    : `did not solve; target was ${ep.target.canonicalName}`;
  return `WhoWare day ${ep.episodeDay}: ${outcome}. Streak ${profile.streak ?? 0} (best ${profile.best ?? 0}). Guesses used ${state.guesses.length}/${ep.tuning.guessLimit}. Clues found ${state.cluesFound.length}.`;
}