// motion.js — DOM-side motion. No game rules, no host SDK.
//
// Everything here is cancellable and pauses when the window is hidden or the
// reader has asked for reduced motion. The first cut of app.js had a
// `setTimeout` typewriter that could not be stopped, so leaving a verdict
// mid-reveal kept a timer chain running against a detached node.

export const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

function onVisible(fn) {
  if (document.hidden) return () => {};
  return fn;
}

// ── Typewriter ────────────────────────────────────────────────────
//
// Pass an AbortSignal to stop mid-reveal; the promise then resolves false.
// Without one it resolves true on completion. Callers own an AbortController
// per view and abort it on teardown, which is what keeps a leaving verdict
// from stranding a timer chain on a detached node.
//
// Time-based, not tick-based, and with a guaranteed completion path. Both
// halves of the obvious implementations broke in the real embedding:
//
//   chained setTimeout  Chrome clamps background timers to ~1 Hz, so the
//                       reveal crawled at one character per second in an
//                       unfocused window.
//   requestAnimationFrame
//                       paused outright when the document is hidden, so a
//                       collapsed or unfocused window never completed the
//                       reveal at all and left a blank verdict on screen.
//
// Progress is derived from elapsed wall-clock, so a throttled frame jumps to
// where it should be, and a timer backstops rAF to guarantee the text always
// lands. An Anna window spends much of its life not focused, since the user
// is reading the conversation it was summoned from.

export function typewriter(node, text, { speed = 45, maxTotal = 1200, signal } = {}) {
  node.textContent = "";
  if (reducedMotion() || signal?.aborted) {
    node.textContent = text;
    return Promise.resolve(true);
  }

  const total = Math.max(1, Math.min(text.length * speed, maxTotal));
  const start = performance.now();
  let raf = null;
  let safety = null;
  let settled = false;

  const show = (i) => {
    node.textContent = text.slice(0, Math.max(0, Math.min(text.length, i)));
  };

  return new Promise((resolve) => {
    function onAbort() {
      // Leave the partial text in place -- an interrupted reveal should look
      // interrupted, not snap to a different word.
      finish(false);
    }

    function finish(completed) {
      if (settled) return;
      settled = true;
      if (raf) cancelAnimationFrame(raf);
      if (safety) clearTimeout(safety);
      signal?.removeEventListener?.("abort", onAbort);
      resolve(completed);
    }

    // Smooth path: one character position per elapsed wall-clock slice.
    function frame(now) {
      if (settled) return;
      const i = Math.ceil(((now - start) / total) * text.length);
      show(i);
      if (i >= text.length) return finish(true);
      raf = requestAnimationFrame(frame);
    }

    signal?.addEventListener?.("abort", onAbort, { once: true });

    // Guaranteed path. rAF is paused outright whenever the document is
    // hidden, so a window that loses focus or gets collapsed mid-reveal
    // would otherwise strand the player on a blank verdict. A timer still
    // fires (clamped to ~1 Hz when backgrounded), and because progress is
    // time-based the first tick lands near the end. Whichever path gets
    // there first wins; the other is cleared.
    safety = setTimeout(() => {
      if (settled) return;
      show(text.length);
      finish(true);
    }, total + 120);

    raf = requestAnimationFrame(frame);
  });
}

// ── Dust motes ────────────────────────────────────────────────────
//
// The native app drifts ~180 particles through the room. Inside an iframe
// window that is often small, so this scales down and — more importantly —
// stops entirely when the window is hidden or motion is reduced. An
// always-on rAF loop in a backgrounded tab is pure waste.

export function startDust(canvas, { count = 70, color = "#c9a227" } = {}) {
  if (!canvas?.getContext) return () => {};
  if (reducedMotion()) return () => {};

  const ctx = canvas.getContext("2d", { alpha: true });
  let w = 0;
  let h = 0;
  let dpr = 1;
  let raf = null;
  let stopped = false;

  const motes = Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 0.4 + Math.random() * 1.5,
    vx: (Math.random() - 0.5) * 0.00018,
    vy: -0.00006 - Math.random() * 0.00012,
    a: 0.12 + Math.random() * 0.3,
    ph: Math.random() * Math.PI * 2,
  }));

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2); // cap: 3x is not worth it here
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame(t) {
    if (stopped) return;
    ctx.clearRect(0, 0, w, h);
    for (const m of motes) {
      m.x += m.vx;
      m.y += m.vy;
      if (m.y < -0.02) {
        m.y = 1.02;
        m.x = Math.random();
      }
      if (m.x < -0.02) m.x = 1.02;
      if (m.x > 1.02) m.x = -0.02;
      const twinkle = 0.72 + 0.28 * Math.sin(t / 1400 + m.ph);
      ctx.globalAlpha = m.a * twinkle;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (stopped || raf) return;
    raf = onVisible(requestAnimationFrame)(frame);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  const onResize = () => resize();
  const onVisibility = () => (document.hidden ? stop() : start());
  const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");

  resize();
  start();
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  mq?.addEventListener?.("change", onVisibility);

  return function stopDust() {
    stopped = true;
    stop();
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVisibility);
    mq?.removeEventListener?.("change", onVisibility);
  };
}

// ── View transition ───────────────────────────────────────────────
//
// Crossfade the outgoing view out and the incoming view in. Skipped under
// reduced motion, where a hard swap is the honest thing to do.

export async function crossfade(node, build) {
  if (reducedMotion()) {
    build();
    return;
  }
  node.style.opacity = "0";
  await new Promise((r) => setTimeout(r, 140));
  build();
  // one frame so the new content paints before fading in
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  node.style.opacity = "1";
}

export function fadeable(node) {
  node.style.transition = "opacity 140ms ease";
  if (!reducedMotion()) node.style.opacity = "0";
  return node;
}
