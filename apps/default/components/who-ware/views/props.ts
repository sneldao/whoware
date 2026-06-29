/**
 * Composite prop shapes for the game views.
 *
 * Splitting a 30-prop signature into 3-4 cohesive composites means
 *   - one prop per concern (clear call sites in GameDashboard)
 *   - easy to spread from already-grouped session state
 *   - the type surface of `PlayingView` stays under 10 props total
 *
 * All composites extend the same root object family used by the
 * orchestrator in app/index.tsx.
 */

import type { FigureOption } from "@/components/who-ware/guess-panel";
import type { Id } from "@/convex/_generated/dataModel";

/** Minimal scene document consumed by views — decoupled from Convex generated types. */
export interface PlayingViewScene {
  title: string;
  location: string;
  era: string;
  palette: string[];
  imageKey?: string;
  imageUrl?: string;
  ambientText: string;
  clues: Array<{ label: string; detail: string; x: number; y: number }>;
}

export interface ClueEntry {
  sceneIndex: number;
  sceneTitle: string;
  label: string;
  detail: string;
}

export interface LeaderboardRank {
  rank: number;
  score: number;
  entriesUsed: number;
  hotspotsOpened: number;
  elapsedMs: number;
  guessedAt: number;
}

export interface LeaderboardEntry {
  [key: string]: unknown;
}

/**
 * What's currently being rendered: which scene, how far we've unlocked,
 * what clues we've surfaced.
 */
export interface SceneState {
  scene: PlayingViewScene;
  sceneIndex: number;
  totalAccessibleScenes: number;
  visibleSceneIndices: number[];
  currentSceneIndex: number;
  discoveredClues: ClueEntry[];
  activeHint: string | null;
  isHintGenerating: boolean;
  onSelectScene: (episodeIndex: number) => void;
  onHotspotOpen: (label: string) => Promise<void>;
  onGenerateHint: (clueLabel: string) => Promise<void>;
}

/** Action bar state + handlers (guess panel toggle, unlock memory). */
export interface ActionState {
  isGuessPanelOpen: boolean;
  isSolved: boolean;
  isExhausted: boolean;
  moreMemoriesAvailable: boolean;
  isBusy: boolean;
  onToggleGuessPanel: () => void;
  onUnlockNextMemory: () => void;
}

/** Guess panel inputs — figure options, guesses remaining, submission handler. */
export interface GuessState {
  figureOptions: FigureOption[];
  guessesLeft: number;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  onSubmitGuess: (text: string, figureId: string, playerName: string) => Promise<void>;
}

/** Leaderboard query + footer meta (archive count, push, episode identity). */
export interface ExtrasState {
  episodeId: Id<"episodes"> | null;
  memoriesViewed: number;
  currentStreak: number;
  leaderboardEntries: LeaderboardEntry[];
  playerRank: LeaderboardRank | null;
  rankedCount: number;
  archiveCount: number;
  isPushOptedIn: boolean;
  isPushBusy: boolean;
  onTogglePush: () => void;
}

/**
 * Composite PlayingView props: 4 cohesive groups instead of 30+ flat props.
 * GameDashboard assembles each composite from its existing session/delegate/
 * minter/guessing state and passes them down.
 */
export interface PlayingViewProps {
  scene: SceneState;
  actions: ActionState;
  guess: GuessState;
  extras: ExtrasState;
}

/* ── SolvedView composites ─────────────────────────────────────────── */

export interface ResultShareData {
  episodeNumber: number;
  memoriesViewed: number;
  cluesOpened: number;
  elapsedMs: number;
  score: number;
  rank: number | null;
  rankedCount: number;
  streak: number;
  guessesUsed: number;
  hotspotsOpened: number;
  difficulty: string;
  figureEra?: string;
  figureRegion?: string;
}

export interface OnchainBadges {
  isSmartAccountUpgraded: boolean;
  delegationTxHash: string | null;
  isDelegating: boolean;
  mintTxHash: string | null;
  isMinting: boolean;
  streakTxHash: string | null;
  isStreakUpdating: boolean;
  onShowDelegationTooltip: () => void;
  onShowMintTooltip: () => void;
  onShowStreakTooltip: () => void;
}

/**
 * Composite SolvedView props: 3 cohesive groups instead of 20+ flat props.
 */
export interface SolvedViewProps {
  result: ResultShareData;
  onchain: OnchainBadges;
  nextActions: {
    onShowHistory: () => void;
    onShare: () => void;
  };
}
