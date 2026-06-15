import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <title>WhoWare — Daily History Guessing Game</title>
        <meta name="description" content="Step into panoramic memories from a historical figure's life. Inspect clues. Guess the identity. Wordle meets immersive history." />

        <meta property="og:type" content="website" />
        <meta property="og:title" content="WhoWare — Daily History Guessing Game" />
        <meta property="og:description" content="Step into panoramic memories from a historical figure's life. Inspect clues. Guess the identity. New puzzle every day at midnight UTC." />
        <meta property="og:image" content="/og-image.png" />
        <meta property="og:url" content="https://whoware.app" />
        <meta property="og:site_name" content="WhoWare" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="WhoWare — Daily History Guessing Game" />
        <meta name="twitter:description" content="Step into panoramic memories from a historical figure's life. Inspect clues. Guess the identity." />
        <meta name="twitter:image" content="/og-image.png" />

        <meta name="theme-color" content="#070A12" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />

        <link rel="canonical" href="https://whoware.app" />

        <ScrollViewStyleReset />
      </head>
      <body style={{ backgroundColor: "#080D1A" }}>{children}</body>
    </html>
  );
}
