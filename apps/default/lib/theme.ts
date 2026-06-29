/**
 * Design tokens for WhoWare.
 *
 * Single source of truth for colors, type, and spacing primitives.
 * Previously these values were hardcoded across 28+ components (DRY violation).
 *
 * Components should import from here instead of inlining hex values.
 * The token names match the semantic role, not the literal color value,
 * so the palette can evolve without touching every call site.
 */

export const theme = {
  accent: "#FBBF24",
  accentAlpha6: "rgba(251, 191, 36, 0.06)",
  accentAlpha8: "rgba(251, 191, 36, 0.08)",
  accentAlpha10: "rgba(251, 191, 36, 0.1)",
  accentAlpha12: "rgba(251, 191, 36, 0.12)",
  accentAlpha14: "rgba(251, 191, 36, 0.14)",
  accentAlpha15: "rgba(251, 191, 36, 0.15)",
  accentAlpha18: "rgba(251, 191, 36, 0.18)",
  accentAlpha20: "rgba(251, 191, 36, 0.2)",
  accentAlpha22: "rgba(251, 191, 36, 0.22)",
  accentAlpha24: "rgba(251, 191, 36, 0.24)",
  accentAlpha25: "rgba(251, 191, 36, 0.25)",
  accentAlpha28: "rgba(251, 191, 36, 0.28)",
  accentAlpha30: "rgba(251, 191, 36, 0.3)",
  accentAlpha35: "rgba(251, 191, 36, 0.35)",
  accentAlpha40: "rgba(251, 191, 36, 0.4)",
  accentAlpha50: "rgba(251, 191, 36, 0.5)",
  accentAlpha60: "rgba(251, 191, 36, 0.6)",
  accentAlpha70: "rgba(251, 191, 36, 0.7)",
  accentAlpha78: "rgba(251, 191, 36, 0.78)",
  accentAlpha90: "rgba(251, 191, 36, 0.9)",
  accentSoft: "rgba(251, 191, 36, 0.15)",
  accentSoftBorder: "rgba(251, 191, 36, 0.3)",
  accentMutedBg: "rgba(251, 191, 36, 0.1)",
  accentMutedBorder: "rgba(251, 191, 36, 0.2)",
  accentGlow: "rgba(251, 191, 36, 0.3)",

  ink: "#FFF7ED",
  inkAlpha3: "rgba(255, 247, 237, 0.03)",
  inkAlpha4: "rgba(255, 247, 237, 0.04)",
  inkAlpha6: "rgba(255, 247, 237, 0.06)",
  inkAlpha8: "rgba(255, 247, 237, 0.08)",
  inkAlpha10: "rgba(255, 247, 237, 0.1)",
  inkAlpha12: "rgba(255, 247, 237, 0.12)",
  inkAlpha13: "rgba(255, 247, 237, 0.13)",
  inkAlpha35: "rgba(255, 247, 237, 0.35)",
  inkAlpha38: "rgba(255, 247, 237, 0.38)",
  inkAlpha40: "rgba(255, 247, 237, 0.4)",
  inkAlpha50: "rgba(255, 247, 237, 0.5)",
  inkAlpha55: "rgba(255, 247, 237, 0.55)",
  inkAlpha58: "rgba(255, 247, 237, 0.58)",
  inkAlpha60: "rgba(255, 247, 237, 0.6)",
  inkAlpha65: "rgba(255, 247, 237, 0.65)",
  inkAlpha68: "rgba(255, 247, 237, 0.68)",
  inkAlpha70: "rgba(255, 247, 237, 0.7)",
  inkAlpha72: "rgba(255, 247, 237, 0.72)",
  inkInverted: "#1C1106",
  inkOnAccent: "#111827",
  inkMuted: "rgba(255, 247, 237, 0.72)",
  inkSubtle: "rgba(255, 247, 237, 0.5)",
  inkFaint: "rgba(255, 247, 237, 0.4)",
  inkGhost: "rgba(255, 247, 237, 0.35)",
  inkWhisper: "rgba(255, 247, 237, 0.3)",
  inkDivider: "rgba(255, 247, 237, 0.13)",
  inkBorder: "rgba(255, 247, 237, 0.12)",
  inkSurface: "rgba(255, 247, 237, 0.08)",
  inkSurfaceFaint: "rgba(255, 247, 237, 0.06)",
  inkSurfaceFainter: "rgba(255, 247, 237, 0.03)",
  inkChip: "rgba(255, 247, 237, 0.04)",

  canvas: "#070A12",
  canvasWarm: "#1C1106",
  canvasScrim: "rgba(10, 6, 4, 0.7)",
  canvasScrimDense: "rgba(10, 6, 4, 0.95)",
  canvasOpaque: "rgba(10, 6, 4, 1)",

  success: "#22C55E",
  successMuted: "rgba(34, 197, 94, 0.85)",
  danger: "#F87171",
  dangerMuted: "#FCA5A5",
  dangerBg: "rgba(239, 68, 68, 0.06)",
  dangerBorder: "rgba(239, 68, 68, 0.15)",
  dangerText: "rgba(239, 68, 68, 0.6)",

  neutral: "#64748B",
  neutralDark: "#475569",

  violet: "#A78BFA",
  violetMuted: "rgba(167, 139, 250, 0.06)",
  violetBorder: "rgba(167, 139, 250, 0.15)",
  violetIconBg: "rgba(167, 139, 250, 0.12)",

  goldGradientEnd: "#F59E0B",
  goldSoft: "#FDE68A",

  // Scene palette fallbacks (used by EnhancedSceneTransition + PanoramaScene)
  warmBrown: "#92400E",
  parchment: "#F8E7C9",
  inkAlpha80: "rgba(255, 247, 237, 0.8)",
  inkAlpha84: "rgba(255, 247, 237, 0.84)",
  inkAlpha78: "rgba(255, 247, 237, 0.78)",
  inkAlpha62: "rgba(255, 247, 237, 0.62)",
  inkAlpha45: "rgba(255, 247, 237, 0.45)",
  inkAlpha54: "rgba(255, 247, 237, 0.54)",
  inkAlpha44: "rgba(255, 247, 237, 0.44)",
  inkAlpha25: "rgba(255, 247, 237, 0.25)",
  inkAlpha20: "rgba(255, 247, 237, 0.2)",
  inkAlpha15: "rgba(255, 247, 237, 0.15)",
  inkAlpha07: "rgba(255, 247, 237, 0.07)",
  inkAlpha05: "rgba(255, 247, 237, 0.05)",
  inkAlpha04: "rgba(255, 247, 237, 0.04)",
  inkAlpha02: "rgba(255, 247, 237, 0.02)",
  inkAlpha48: "rgba(255, 247, 237, 0.48)",
  inkAlpha30: "rgba(255, 247, 237, 0.3)",

  scrim: "rgba(0, 0, 0, 0.7)",
  slateDeep: "rgba(15, 23, 42, 0.85)",
  parchmentLight: "rgba(248, 231, 201, 0.13)",
  pureBlack: "#000",

  // Curator leaderboard accents
  pink: "#F472B6",
  pinkAlpha15: "rgba(244, 114, 182, 0.08)",
  pinkAlpha30: "rgba(244, 114, 182, 0.19)",
  silver: "#94A3B8",
  bronze: "#CD7F32",
  lightViolet: "#C4B5FD",
  lightGreen: "#86EFAC",

  violetAlpha04: "rgba(167, 139, 250, 0.04)",
  violetAlpha08: "rgba(167, 139, 250, 0.08)",
  violetAlpha15: "rgba(167, 139, 250, 0.09)",
  violetAlpha20: "rgba(167, 139, 250, 0.13)",
  violetAlpha30: "rgba(167, 139, 250, 0.19)",
  violetAlpha60: "rgba(167, 139, 250, 0.38)",

  successAlpha15: "rgba(34, 197, 94, 0.09)",
  successAlpha20: "rgba(34, 197, 94, 0.13)",
  successAlpha30: "rgba(34, 197, 94, 0.19)",
  successAlpha60: "rgba(34, 197, 94, 0.38)",

  blackAlpha15: "rgba(0, 0, 0, 0.15)",
  blackAlpha25: "rgba(0, 0, 0, 0.25)",
} as const;

Object.freeze(theme);

export type Theme = typeof theme;
