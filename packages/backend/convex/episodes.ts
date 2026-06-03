import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const BASE_SCORE = 10_000;
const MEMORY_PENALTY = 1200;
const HOTSPOT_PENALTY = 250;
const GUESS_PENALTY = 600;
const TIME_BUCKET_MS = 10000;
const TIME_BUCKET_PENALTY = 10;

const sceneReturnValidator = v.object({
  title: v.string(),
  location: v.string(),
  era: v.string(),
  palette: v.array(v.string()),
  panoramaPrompt: v.string(),
  imageKey: v.optional(v.string()),
  imageAspectRatio: v.optional(v.string()),
  detailImageKeys: v.optional(v.array(v.string())),
  mediaKind: v.optional(v.union(v.literal("image"), v.literal("motion"), v.literal("video"))),
  motionPrompt: v.optional(v.string()),
  ambientText: v.string(),
  clues: v.array(v.object({ label: v.string(), detail: v.string(), x: v.number(), y: v.number() })),
});

const demoScenes = [
  {
    title: "A quiet room before the world notices",
    location: "Upstairs bedroom",
    era: "Early 1940s",
    palette: ["#1E293B", "#7C2D12", "#F8E7C9"],
    panoramaPrompt:
      "Equirectangular cylindrical equidistant projection, seamless 360 panorama, dim wartime bedroom, heavy curtains, maps hidden under books, no faces, no readable names.",
    imageKey: "bedroom",
    imageAspectRatio: "16:9",
    detailImageKeys: ["bedroom"],
    mediaKind: "motion" as const,
    motionPrompt: "Slow push from blackout curtains to the radio dial, ending on torn speech notes under lamplight.",
    ambientText:
      "A wireless set murmurs beneath blackout curtains. On the desk, an unfinished speech is weighted by a cigar case.",
    clues: [
      { label: "Blackout notice", detail: "A London civil-defense placard warns residents to cover every window after dusk.", x: 18, y: 34 },
      { label: "Half-written page", detail: "The draft repeats the phrase ‘we shall’ in a forceful hand, but the signature is torn away.", x: 68, y: 42 },
      { label: "Tiny bulldog", detail: "A porcelain bulldog sits beside military dispatches stamped with yesterday’s date.", x: 45, y: 69 },
    ],
  },
  {
    title: "The underground workplace",
    location: "Cabinet rooms below the street",
    era: "Second World War",
    palette: ["#111827", "#92400E", "#FDE68A"],
    panoramaPrompt:
      "Seamless 360 equirectangular panorama inside underground war rooms, maps, telephones, pinned convoy routes, period labels, no explicit names.",
    imageKey: "warRooms",
    imageAspectRatio: "16:9",
    detailImageKeys: ["warRooms"],
    mediaKind: "motion" as const,
    motionPrompt: "A low glide over convoy pins, telephones, and the waiting hat, as if a memory is searching the table.",
    ambientText:
      "Telephones ring in a low ceilinged room. Red pins cross the Atlantic while a wall clock shows a sleepless hour.",
    clues: [
      { label: "Map pins", detail: "Convoy routes converge on Britain; a clerk has circled the Channel in red pencil.", x: 28, y: 46 },
      { label: "Telephone label", detail: "A switchboard tag reads ‘Admiralty’ in crisp English lettering.", x: 59, y: 38 },
      { label: "Hat and cane", detail: "A homburg hat rests beside a walking stick with a silver band.", x: 74, y: 72 },
    ],
  },
  {
    title: "A window over the capital",
    location: "Government office",
    era: "1940",
    palette: ["#0F172A", "#991B1B", "#FBBF24"],
    panoramaPrompt:
      "360-degree panorama from a wartime government office overlooking Westminster, papers, cigar smoke, famous river view, no portraits, no name plates.",
    imageKey: "office",
    imageAspectRatio: "16:9",
    detailImageKeys: ["office"],
    mediaKind: "motion" as const,
    motionPrompt: "Rain-streaked window to dispatch box, then a drifting curl of cigar smoke over military cables.",
    ambientText:
      "From the window, the river bends past a clock tower. The city below is bruised but unbowed.",
    clues: [
      { label: "Red dispatch box", detail: "The box is embossed only with the words ‘Prime Minister’ — the personal name is scratched away.", x: 23, y: 63 },
      { label: "Newspaper headline", detail: "A headline praises defiance after the evacuation from Dunkirk.", x: 50, y: 44 },
      { label: "Cigar smoke", detail: "A half-smoked cigar burns in an ashtray beside military cables.", x: 79, y: 58 },
    ],
  },
  {
    title: "A chamber holding its breath",
    location: "House of Commons",
    era: "May 1940",
    palette: ["#052E1B", "#B45309", "#FDE68A"],
    panoramaPrompt:
      "Wide immersive panorama from the British House of Commons floor, green benches, dispatch boxes, smoke haze, wartime urgency, no readable personal names.",
    imageKey: "commons",
    imageAspectRatio: "16:9",
    detailImageKeys: ["commons"],
    mediaKind: "motion" as const,
    motionPrompt: "A tense sweep across green benches and the dispatch box, holding on order papers just long enough to unsettle.",
    ambientText:
      "Green benches creak under restless bodies. Every cough sounds like a vote, every silence like a verdict.",
    clues: [
      { label: "Green bench", detail: "The chamber is crowded, but the government front bench has been left expectantly open.", x: 31, y: 66 },
      { label: "Dispatch box", detail: "A battered box waits for a speech that will have to become a weapon.", x: 51, y: 58 },
      { label: "Order paper", detail: "The date places this memory just after a failed policy of appeasement collapsed.", x: 70, y: 43 },
    ],
  },
  {
    title: "A voice entering the dark",
    location: "Broadcast room",
    era: "Wartime Britain",
    palette: ["#1F2937", "#78350F", "#F8E7C9"],
    panoramaPrompt:
      "First-person 1940s radio broadcast room, microphone, script pages, ashtray, studio clock, no personal names, no portraits, period accurate.",
    imageKey: "broadcast",
    imageAspectRatio: "16:9",
    detailImageKeys: ["broadcast"],
    mediaKind: "motion" as const,
    motionPrompt: "A slow move toward the microphone while the studio clock and ashtray fall into peripheral blur.",
    ambientText:
      "The microphone waits like a tunnel. Beyond it, an island listens in kitchens, shelters, and barracks.",
    clues: [
      { label: "Studio clock", detail: "The scheduled address begins minutes before the evening news reaches the colonies.", x: 20, y: 31 },
      { label: "Script margin", detail: "The margin carries a repeated instruction: make resolve sound inevitable.", x: 63, y: 52 },
      { label: "Ashtray", detail: "Cigar ash has fallen across a line about fighting on beaches and landing grounds.", x: 76, y: 69 },
    ],
  },
];

const answerOptions = [
  "Winston Churchill",
  "Franklin D. Roosevelt",
  "Dwight D. Eisenhower",
  "Clement Attlee",
  "Charles de Gaulle",
  "Neville Chamberlain",
  "Alan Turing",
  "Joseph Stalin",
];

export const ensureDemoEpisode = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("episodes")
      .withIndex("by_slug", (q) => q.eq("slug", "demo-churchill"))
      .unique();

    const scenes = cloneDemoScenes();

    if (existing) {
      const shouldRefreshScenes = existing.scenes.length !== scenes.length || existing.scenes.some(hasSceneChanged);

      if (shouldRefreshScenes) {
        await ctx.db.patch(existing._id, { scenes, answerOptions });
      }
      return null;
    }

    await ctx.db.insert("episodes", {
      slug: "demo-churchill",
      figureName: "Winston Churchill",
      activeAt: Date.now(),
      isActive: true,
      difficulty: "iconic",
      scenes,
      answerOptions,
    });

    return null;
  },
});

export const getActive = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("episodes"),
      _creationTime: v.number(),
      slug: v.string(),
      activeAt: v.number(),
      isActive: v.boolean(),
      difficulty: v.union(v.literal("iconic"), v.literal("field"), v.literal("research")),
      scenes: v.array(sceneReturnValidator),
      answerOptions: v.array(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const episode = await ctx.db
      .query("episodes")
      .withIndex("by_isActive_and_activeAt", (q) => q.eq("isActive", true))
      .order("desc")
      .first();

    if (!episode) return null;

    return {
      _id: episode._id,
      _creationTime: episode._creationTime,
      slug: episode.slug,
      activeAt: episode.activeAt,
      isActive: episode.isActive,
      difficulty: episode.difficulty,
      scenes: episode.scenes,
      answerOptions: episode.answerOptions,
    };
  },
});

export const submitGuess = mutation({
  args: {
    episodeId: v.id("episodes"),
    playerName: v.string(),
    guess: v.string(),
    scenesRevealed: v.number(),
    hotspotsOpened: v.optional(v.number()),
    guessesUsed: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    walletAddress: v.optional(v.string()),
  },
  returns: v.object({
    isCorrect: v.boolean(),
    answer: v.optional(v.string()),
    score: v.optional(v.number()),
    elapsedMs: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const episode = await ctx.db.get(args.episodeId);
    if (!episode) throw new Error("Episode not found");

    const now = Date.now();
    const cleanPlayerName = args.playerName.trim().slice(0, 32) || "Anonymous";
    const cleanGuess = args.guess.trim();
    const memoriesViewed = clampInteger(args.scenesRevealed, 0, episode.scenes.length);
    const hotspotsOpened = clampInteger(args.hotspotsOpened ?? 0, 0, 100);
    const guessesUsed = clampInteger(args.guessesUsed ?? 1, 1, 5);
    const elapsedMs = Math.max(0, now - (args.startedAt ?? now));
    const score = computeScore({ memoriesViewed, hotspotsOpened, guessesUsed, elapsedMs });
    const isCorrect = cleanGuess.toLowerCase() === episode.figureName.toLowerCase();

    await ctx.db.insert("guesses", {
      episodeId: args.episodeId,
      playerName: cleanPlayerName,
      guess: cleanGuess,
      isCorrect,
      scenesRevealed: memoriesViewed,
      hotspotsOpened,
      guessesUsed,
      elapsedMs,
      score,
      guessedAt: now,
      walletAddress: args.walletAddress?.toLowerCase(),
    });

    return isCorrect ? { isCorrect, answer: episode.figureName, score, elapsedMs } : { isCorrect, score, elapsedMs };
  },
});

export const leaderboard = query({
  args: { episodeId: v.id("episodes"), playerName: v.optional(v.string()) },
  returns: v.object({
    entries: v.array(
      v.object({
        _id: v.id("guesses"),
        playerName: v.string(),
        guess: v.string(),
        scenesRevealed: v.number(),
        hotspotsOpened: v.number(),
        guessesUsed: v.number(),
        elapsedMs: v.number(),
        score: v.number(),
        guessedAt: v.number(),
      }),
    ),
    playerRank: v.union(
      v.null(),
      v.object({
        rank: v.number(),
        playerName: v.string(),
        scenesRevealed: v.number(),
        hotspotsOpened: v.number(),
        guessesUsed: v.number(),
        elapsedMs: v.number(),
        score: v.number(),
        guessedAt: v.number(),
      }),
    ),
    rankedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const correctGuesses = await ctx.db
      .query("guesses")
      .withIndex("by_episodeId_and_isCorrect_and_scenesRevealed_and_guessedAt", (q) =>
        q.eq("episodeId", args.episodeId).eq("isCorrect", true),
      )
      .take(250);

    const ranked = correctGuesses
      .map((entry) => ({
        _id: entry._id,
        playerName: entry.playerName,
        guess: entry.guess,
        scenesRevealed: entry.scenesRevealed,
        hotspotsOpened: entry.hotspotsOpened ?? 0,
        guessesUsed: entry.guessesUsed ?? 1,
        elapsedMs: entry.elapsedMs ?? 0,
        score:
          entry.score ??
          computeScore({
            memoriesViewed: entry.scenesRevealed,
            hotspotsOpened: entry.hotspotsOpened ?? 0,
            guessesUsed: entry.guessesUsed ?? 1,
            elapsedMs: entry.elapsedMs ?? 0,
          }),
        guessedAt: entry.guessedAt,
      }))
      .sort(compareRankedEntries);

    const cleanPlayerName = args.playerName?.trim().toLowerCase();
    const playerIndex = cleanPlayerName
      ? ranked.findIndex((entry) => entry.playerName.trim().toLowerCase() === cleanPlayerName)
      : -1;
    const playerEntry = playerIndex >= 0 ? ranked[playerIndex] : null;

    return {
      entries: ranked.slice(0, 25),
      playerRank: playerEntry
        ? {
            rank: playerIndex + 1,
            playerName: playerEntry.playerName,
            scenesRevealed: playerEntry.scenesRevealed,
            hotspotsOpened: playerEntry.hotspotsOpened,
            guessesUsed: playerEntry.guessesUsed,
            elapsedMs: playerEntry.elapsedMs,
            score: playerEntry.score,
            guessedAt: playerEntry.guessedAt,
          }
        : null,
      rankedCount: ranked.length,
    };
  },
});

function cloneDemoScenes() {
  return demoScenes.map((scene) => ({
    ...scene,
    palette: [...scene.palette],
    detailImageKeys: [...scene.detailImageKeys],
    clues: scene.clues.map((clue) => ({ ...clue })),
  }));
}

function hasSceneChanged(scene: { imageKey?: string; detailImageKeys?: string[]; mediaKind?: string; motionPrompt?: string }, index: number): boolean {
  const demoScene = demoScenes[index];
  if (!demoScene) return true;
  return (
    scene.imageKey !== demoScene.imageKey ||
    scene.mediaKind !== demoScene.mediaKind ||
    scene.motionPrompt !== demoScene.motionPrompt ||
    (scene.detailImageKeys ?? []).join("|") !== demoScene.detailImageKeys.join("|")
  );
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.floor(value), min), max);
}

function computeScore(args: { memoriesViewed: number; hotspotsOpened: number; guessesUsed: number; elapsedMs: number }): number {
  const timePenalty = Math.floor(args.elapsedMs / TIME_BUCKET_MS) * TIME_BUCKET_PENALTY;
  const rawScore =
    BASE_SCORE -
    args.memoriesViewed * MEMORY_PENALTY -
    args.hotspotsOpened * HOTSPOT_PENALTY -
    (args.guessesUsed - 1) * GUESS_PENALTY -
    timePenalty;

  return Math.max(0, rawScore);
}

function compareRankedEntries(
  left: {
    scenesRevealed: number;
    hotspotsOpened: number;
    guessesUsed: number;
    elapsedMs: number;
    score: number;
    guessedAt: number;
  },
  right: {
    scenesRevealed: number;
    hotspotsOpened: number;
    guessesUsed: number;
    elapsedMs: number;
    score: number;
    guessedAt: number;
  },
): number {
  return (
    right.score - left.score ||
    left.scenesRevealed - right.scenesRevealed ||
    left.hotspotsOpened - right.hotspotsOpened ||
    left.guessesUsed - right.guessesUsed ||
    left.elapsedMs - right.elapsedMs ||
    left.guessedAt - right.guessedAt
  );
}
