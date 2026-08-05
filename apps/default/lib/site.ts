/**
 * Canonical public site URL for OG/Twitter tags, share sheets, and sitemap.
 * Set EXPO_PUBLIC_SITE_URL in Vercel (and local .env) to the production host.
 */
export const SITE_URL = (
  process.env.EXPO_PUBLIC_SITE_URL ?? "https://whoware.vercel.app"
).replace(/\/$/, "");

export const SITE_NAME = "WhoWare";
export const SITE_TITLE = "WhoWare — Daily Embodied History Ritual";
export const SITE_DESCRIPTION =
  "Step into panoramic memories from a historical figure's life. Inspect clues hidden in each scene. Name the identity before your guesses run out. A new puzzle every day.";
export const SITE_OG_DESCRIPTION =
  "Someone changed history from this room. Step into panoramic memories, inspect clues, and name the figure. A new historical mystery every day.";
export const SITE_TWITTER_DESCRIPTION =
  "Step into panoramic memories from a historical figure's life. Inspect clues. Name the figure. New puzzle every day.";

export const OG_IMAGE_PATH = "/og-image.png";
export const OG_IMAGE_URL = `${SITE_URL}${OG_IMAGE_PATH}`;
