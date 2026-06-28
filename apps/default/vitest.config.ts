import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.expo/**", "convex/_generated/**"],
    passWithNoTests: true,
    alias: {
      "@/convex/scoring": path.resolve(__dirname, "../../packages/backend/convex/scoring.ts"),
    },
  },
  resolve: {
    alias: {
      "@/convex/scoring": path.resolve(__dirname, "../../packages/backend/convex/scoring.ts"),
    },
  },
});
