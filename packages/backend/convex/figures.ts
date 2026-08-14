import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { canRevealAnswerFor } from "./revealGating";

export const MAX_SEARCH_RESULTS = 10;

const figureTier = v.union(v.literal("iconic"), v.literal("field"), v.literal("research"));
const figureDifficulty = v.union(v.literal("iconic"), v.literal("field"), v.literal("research"));

export interface FigureSeed {
  canonicalName: string;
  aliases: string[];
  era: string;
  region: string;
  tier: "iconic" | "field" | "research";
  tags: string[];
  difficulty: "iconic" | "field" | "research";
  relatedFigures?: string[];
}

const seedCatalogData: FigureSeed[] = [
  {
    canonicalName: "Winston Churchill",
    aliases: ["Churchill", "Winston Spencer Churchill", "Sir Winston Churchill"],
    era: "20th century",
    region: "Britain",
    tier: "iconic",
    tags: ["wartime", "prime minister", "orator", "world war 2"],
    difficulty: "iconic",
    relatedFigures: ["Alan Turing", "Mahatma Gandhi", "Napoleon Bonaparte"],
  },
  {
    canonicalName: "Cleopatra",
    aliases: ["Cleopatra VII", "Cleopatra VII Philopator", "Queen of Egypt"],
    era: "1st century BCE",
    region: "Egypt",
    tier: "iconic",
    tags: ["pharaoh", "ptolemaic", "rome", "diplomat"],
    difficulty: "iconic",
    relatedFigures: ["Hatshepsut", "Julius Caesar", "Hypatia of Alexandria"],
  },
  {
    canonicalName: "Leonardo da Vinci",
    aliases: ["Leonardo", "da Vinci", "Leonardo di ser Piero da Vinci"],
    era: "Renaissance",
    region: "Italy",
    tier: "iconic",
    tags: ["polymath", "painter", "inventor", "anatomist"],
    difficulty: "iconic",
    relatedFigures: ["Galileo Galilei", "Hypatia of Alexandria", "Nikola Tesla"],
  },
  {
    canonicalName: "Marie Curie",
    aliases: ["Curie", "Maria Skłodowska", "Madame Curie"],
    era: "19th–20th century",
    region: "Poland / France",
    tier: "iconic",
    tags: ["physicist", "chemist", "nobel", "radioactivity"],
    difficulty: "iconic",
    relatedFigures: ["Albert Einstein", "Rosalind Franklin", "Ada Lovelace"],
  },
  {
    canonicalName: "Mahatma Gandhi",
    aliases: ["Gandhi", "Mohandas Karamchand Gandhi", "Mahatma", "Bapu"],
    era: "19th–20th century",
    region: "India",
    tier: "iconic",
    tags: ["independence", "nonviolence", "satyagraha", "civil rights"],
    difficulty: "iconic",
  },
  {
    canonicalName: "Albert Einstein",
    aliases: ["Einstein"],
    era: "20th century",
    region: "Germany / USA",
    tier: "iconic",
    tags: ["physicist", "relativity", "nobel"],
    difficulty: "iconic",
    relatedFigures: ["Marie Curie", "Nikola Tesla", "Srinivasa Ramanujan"],
  },
  {
    canonicalName: "Nelson Mandela",
    aliases: ["Mandela", "Madiba"],
    era: "20th century",
    region: "South Africa",
    tier: "iconic",
    tags: ["anti-apartheid", "president", "activist"],
    difficulty: "iconic",
  },
  {
    canonicalName: "Joan of Arc",
    aliases: ["Jeanne d'Arc", "The Maid of Orléans"],
    era: "15th century",
    region: "France",
    tier: "iconic",
    tags: ["military", "martyr", "saint", "hundred years war"],
    difficulty: "iconic",
  },
  {
    canonicalName: "Napoleon Bonaparte",
    aliases: ["Napoleon", "Napoleon I", "Bonaparte"],
    era: "18th–19th century",
    region: "France",
    tier: "iconic",
    tags: ["emperor", "military", "napoleonic wars"],
    difficulty: "iconic",
  },
  {
    canonicalName: "Harriet Tubman",
    aliases: ["Moses", "Araminta Ross"],
    era: "19th century",
    region: "United States",
    tier: "iconic",
    tags: ["abolitionist", "underground railroad", "civil war"],
    difficulty: "iconic",
  },
  {
    canonicalName: "Ada Lovelace",
    aliases: ["Augusta Ada King", "Countess of Lovelace"],
    era: "19th century",
    region: "Britain",
    tier: "field",
    tags: ["mathematician", "computing", "analytical engine"],
    difficulty: "field",
    relatedFigures: ["Alan Turing", "Grace Hopper", "Marie Curie"],
  },
  {
    canonicalName: "Alan Turing",
    aliases: ["Turing"],
    era: "20th century",
    region: "Britain",
    tier: "iconic",
    tags: ["mathematician", "cryptanalyst", "computing", "bletchley"],
    difficulty: "iconic",
    relatedFigures: ["Ada Lovelace", "Grace Hopper", "Winston Churchill"],
  },
  {
    canonicalName: "Florence Nightingale",
    aliases: ["The Lady with the Lamp"],
    era: "19th century",
    region: "Britain",
    tier: "field",
    tags: ["nurse", "statistician", "reformer", "crimean war"],
    difficulty: "field",
  },
  {
    canonicalName: "Ibn Battuta",
    aliases: ["Abu Abdullah Muhammad ibn Battuta"],
    era: "14th century",
    region: "Morocco / wider Islamic world",
    tier: "field",
    tags: ["traveler", "geographer", "rihla"],
    difficulty: "field",
  },
  {
    canonicalName: "Zheng He",
    aliases: ["Ma He", "Sanbao"],
    era: "15th century",
    region: "China",
    tier: "field",
    tags: ["admiral", "explorer", "ming dynasty"],
    difficulty: "field",
  },
  {
    canonicalName: "Frida Kahlo",
    aliases: ["Magdalena Carmen Frida Kahlo y Calderón"],
    era: "20th century",
    region: "Mexico",
    tier: "iconic",
    tags: ["painter", "surrealism", "self-portrait", "activist"],
    difficulty: "iconic",
  },
  {
    canonicalName: "Mansa Musa",
    aliases: ["Musa I of Mali", "Kankan Musa"],
    era: "14th century",
    region: "West Africa",
    tier: "field",
    tags: ["emperor", "mali empire", "gold", "hajj", "timbuktu"],
    difficulty: "field",
  },
  {
    canonicalName: "Hatshepsut",
    aliases: ["Maatkare", "Khnumt-Amun Hatshepsut"],
    era: "15th century BCE",
    region: "Egypt",
    tier: "field",
    tags: ["pharaoh", "female ruler", "deir el-bahri", "trade expedition"],
    difficulty: "field",
  },
  {
    canonicalName: "Nikola Tesla",
    aliases: ["Tesla"],
    era: "19th–20th century",
    region: "Serbia / USA",
    tier: "iconic",
    tags: ["inventor", "electrical engineer", "alternating current", "wardenclyffe"],
    difficulty: "iconic",
    relatedFigures: ["Albert Einstein", "Leonardo da Vinci", "Hedy Lamarr"],
  },
  {
    canonicalName: "Sima Qian",
    aliases: ["Grand Historian Sima"],
    era: "2nd century BCE",
    region: "China",
    tier: "research",
    tags: ["historian", "han dynasty", "shiji", "records of the grand historian"],
    difficulty: "research",
  },
  {
    canonicalName: "Toussaint Louverture",
    aliases: ["François-Dominique Toussaint", "Black Napoleon"],
    era: "18th–19th century",
    region: "Haiti",
    tier: "field",
    tags: ["revolutionary", "haitian revolution", "abolition", "general"],
    difficulty: "field",
  },
  {
    canonicalName: "Rosalind Franklin",
    aliases: ["Franklin"],
    era: "20th century",
    region: "Britain",
    tier: "field",
    tags: ["chemist", "crystallographer", "DNA", "photo 51"],
    difficulty: "field",
  },
  {
    canonicalName: "Suleiman the Magnificent",
    aliases: ["Suleiman I", "Kanuni", "The Lawgiver"],
    era: "16th century",
    region: "Ottoman Empire",
    tier: "field",
    tags: ["sultan", "ottoman", "conquest", "architecture"],
    difficulty: "field",
  },
  {
    canonicalName: "Hypatia of Alexandria",
    aliases: ["Hypatia"],
    era: "4th–5th century",
    region: "Egypt / Roman Empire",
    tier: "research",
    tags: ["mathematician", "philosopher", "astronomer", "neoplatonist"],
    difficulty: "research",
  },
  {
    canonicalName: "Simón Bolívar",
    aliases: ["El Libertador", "Simón José Antonio de la Santísima Trinidad Bolívar"],
    era: "19th century",
    region: "South America",
    tier: "iconic",
    tags: ["liberator", "revolutionary", "gran colombia", "independence"],
    difficulty: "iconic",
  },
  {
    canonicalName: "Murasaki Shikibu",
    aliases: ["Lady Murasaki"],
    era: "11th century",
    region: "Japan",
    tier: "research",
    tags: ["novelist", "poet", "tale of genji", "heian court"],
    difficulty: "research",
  },
  {
    canonicalName: "Rumi",
    aliases: ["Jalal ad-Din Muhammad Rumi", "Mevlana"],
    era: "13th century",
    region: "Persia / Anatolia",
    tier: "field",
    tags: ["poet", "sufi", "mystic", "masnavi", "whirling dervishes"],
    difficulty: "field",
  },
  {
    canonicalName: "Grace Hopper",
    aliases: ["Amazing Grace", "Grace Brewster Murray Hopper"],
    era: "20th century",
    region: "United States",
    tier: "field",
    tags: ["computer scientist", "navy", "COBOL", "compiler", "debugging"],
    difficulty: "field",
  },
  {
    canonicalName: "Shaka Zulu",
    aliases: ["Shaka kaSenzangakhona", "King Shaka"],
    era: "19th century",
    region: "Southern Africa",
    tier: "field",
    tags: ["king", "zulu kingdom", "military reformer", "iklwa"],
    difficulty: "field",
  },
  {
    canonicalName: "Srinivasa Ramanujan",
    aliases: ["Ramanujan"],
    era: "19th–20th century",
    region: "India",
    tier: "field",
    tags: ["mathematician", "number theory", "cambridge", "self-taught"],
    difficulty: "field",
  },
  {
    canonicalName: "Queen Nzinga",
    aliases: ["Nzinga Mbande", "Ana de Sousa Nzinga Mbande"],
    era: "17th century",
    region: "Angola",
    tier: "research",
    tags: ["queen", "ndongo", "matamba", "resistance", "diplomat"],
    difficulty: "research",
  },
  {
    canonicalName: "Nikolaus Otto",
    aliases: ["Nicolaus August Otto"],
    era: "19th century",
    region: "Germany",
    tier: "research",
    tags: ["engineer", "internal combustion engine", "four-stroke", "inventor"],
    difficulty: "research",
  },
  {
    canonicalName: "Pachacuti",
    aliases: ["Pachacutec", "Pachacuti Inca Yupanqui"],
    era: "15th century",
    region: "Peru",
    tier: "research",
    tags: ["emperor", "inca", "machu picchu", "cusco", "expansion"],
    difficulty: "research",
  },
  {
    canonicalName: "Hedy Lamarr",
    aliases: ["Hedwig Eva Maria Kiesler"],
    era: "20th century",
    region: "Austria / USA",
    tier: "field",
    tags: ["actress", "inventor", "frequency hopping", "wifi", "torpedoes"],
    difficulty: "field",
  },
];

function buildSearchIndex(seed: FigureSeed): string {
  return [seed.canonicalName, ...seed.aliases].join(" ").toLowerCase();
}

export const seedCatalog = mutation({
  args: {},
  returns: v.object({ upserted: v.number() }),
  handler: async (ctx) => {
    let upserted = 0;
    for (const seed of seedCatalogData) {
      const existing = await ctx.db
        .query("figures")
        .withIndex("by_canonicalName", (q) => q.eq("canonicalName", seed.canonicalName))
        .first();

      const record = {
        canonicalName: seed.canonicalName,
        aliases: seed.aliases,
        era: seed.era,
        region: seed.region,
        tier: seed.tier,
        tags: seed.tags,
        difficulty: seed.difficulty,
        searchIndex: buildSearchIndex(seed),
        relatedFigures: seed.relatedFigures ?? [],
      };

      if (existing) {
        await ctx.db.patch(existing._id, record);
      } else {
        await ctx.db.insert("figures", record);
      }
      upserted += 1;
    }
    return { upserted };
  },
});

const figurePublicShape = v.object({
  _id: v.id("figures"),
  _creationTime: v.number(),
  searchIndex: v.string(),
  canonicalName: v.string(),
  aliases: v.array(v.string()),
  era: v.string(),
  region: v.string(),
  tier: figureTier,
  tags: v.array(v.string()),
  difficulty: figureDifficulty,
  relatedFigures: v.array(v.string()),
});

export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(figurePublicShape),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.floor(args.limit ?? MAX_SEARCH_RESULTS), 1), MAX_SEARCH_RESULTS);
    const trimmed = args.query.trim();

    if (!trimmed) {
      return await ctx.db.query("figures").order("asc").take(limit);
    }

    return await ctx.db
      .query("figures")
      .withSearchIndex("by_name", (q) => q.search("searchIndex", trimmed))
      .take(limit);
  },
});

/**
 * Returns figure options for the guess panel, scaled by difficulty:
 * - iconic: 10 options (harder to find the right name among well-known figures)
 * - field: 8 options
 * - research: 5 options (the challenge is knowing the name at all)
 * Always includes the correct figure if provided.
 */
export const searchForEpisode = query({
  args: {
    query: v.string(),
    episodeId: v.optional(v.id("episodes")),
  },
  returns: v.array(figurePublicShape),
  handler: async (ctx, args) => {
    const episode = args.episodeId ? await ctx.db.get(args.episodeId) : null;
    const difficulty = episode?.difficulty ?? "iconic";
    const limit = difficulty === "iconic" ? 10 : difficulty === "field" ? 8 : 5;
    const trimmed = args.query.trim();

    let results;
    if (!trimmed) {
      results = await ctx.db.query("figures").order("asc").take(limit);
    } else {
      results = await ctx.db
        .query("figures")
        .withSearchIndex("by_name", (q) => q.search("searchIndex", trimmed))
        .take(limit);
    }

    // Always ensure the correct figure is in the pool (if known)
    if (episode?.figureId) {
      const correctFigure = await ctx.db.get(episode.figureId);
      if (correctFigure && !results.some((r) => r._id === correctFigure._id)) {
        results = [correctFigure, ...results].slice(0, limit);
      }
    }

    return results;
  },
});

export const listAll = query({
  args: {},
  returns: v.array(figurePublicShape),
  handler: async (ctx) => {
    return await ctx.db.query("figures").order("asc").collect();
  },
});

export const get = query({
  args: { figureId: v.id("figures") },
  returns: v.union(figurePublicShape, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.figureId);
  },
});

const relationshipShape = v.object({
  canonicalName: v.string(),
  era: v.string(),
  region: v.string(),
  tier: v.string(),
  tags: v.array(v.string()),
  hasBeenFeatured: v.boolean(),
});

/**
 * Returns figures related to the given episode's figure — either via
 * the `relatedFigures` field on the figure record or by matching era
 * and region. Also indicates whether each related figure has been
 * featured in a past episode, so the UI can show "encountered" badges.
 *
 * Answer-leak guard: relatedFigures are chosen precisely because they
 * orbit the answer ("Churchill's circle: Turing, Gandhi…"), so this is
 * gated the same way as the bio — closed episode, or the caller's run
 * is resolved.
 */
export const getFigureRelationships = query({
  args: { episodeId: v.id("episodes"), identityId: v.optional(v.string()) },
  returns: v.union(v.array(relationshipShape), v.null()),
  handler: async (ctx, args) => {
    if (!(await canRevealAnswerFor(ctx, args.episodeId, args.identityId))) return null;

    const episode = await ctx.db.get(args.episodeId);
    if (!episode?.figureId) return null;

    const figure = await ctx.db.get(episode.figureId);
    if (!figure) return null;

    const relatedNames = figure.relatedFigures ?? [];
    if (relatedNames.length === 0) return null;

    // Resolve related figure names to figure records
    const related: Array<{
      canonicalName: string;
      era: string;
      region: string;
      tier: string;
      tags: string[];
      hasBeenFeatured: boolean;
    }> = [];

    for (const name of relatedNames) {
      const found = await ctx.db
        .query("figures")
        .withIndex("by_canonicalName", (q) => q.eq("canonicalName", name))
        .first();

      if (found) {
        // Check if this figure has been featured in a past episode
        const featuredEpisode = await ctx.db
          .query("episodes")
          .withIndex("by_figureId", (q) => q.eq("figureId", found._id))
          .first();

        related.push({
          canonicalName: found.canonicalName,
          era: found.era,
          region: found.region,
          tier: found.tier,
          tags: found.tags,
          hasBeenFeatured: Boolean(featuredEpisode),
        });
      }
    }

    return related.length > 0 ? related : null;
  },
});
