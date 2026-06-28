import { theme } from "@/lib/theme";
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <title>WhoWare — Daily Embodied History Ritual</title>
        <meta name="description" content="Step into panoramic memories from a historical figure's life. Inspect clues hidden in each scene. Name the identity before your guesses run out. A new puzzle every day." />

        <meta property="og:type" content="website" />
        <meta property="og:title" content="WhoWare — Daily Embodied History Ritual" />
        <meta property="og:description" content="Someone changed history from this room. Step into panoramic memories, inspect clues, and name the figure. A new historical mystery every day." />
        <meta property="og:image" content="https://whoware.vercel.app/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="https://whoware.vercel.app" />
        <meta property="og:site_name" content="WhoWare" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="WhoWare — Daily Embodied History Ritual" />
        <meta name="twitter:description" content="Step into panoramic memories from a historical figure's life. Inspect clues. Name the figure. New puzzle every day." />
        <meta name="twitter:image" content="https://whoware.vercel.app/og-image.png" />

        <meta name="theme-color" content={theme.canvas} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        <link rel="icon" type="image/png" href="/favicon.png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        <link rel="canonical" href="https://whoware.vercel.app" />

        <ScrollViewStyleReset />
      </head>
      <body style={{ backgroundColor: "#080D1A" }}>{children}</body>
    </html>
  );
}
