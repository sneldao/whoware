import convexPlugin from "@convex-dev/eslint-plugin";
import tseslint from "typescript-eslint";

export default [
    {
        ignores: [
            "**/node_modules/**",
            "**/.expo/**",
            "**/dist/**",
            "**/build/**",
            "**/coverage/**",
            "**/convex/_generated/**",
            "../../packages/backend/convex/_generated/**",
        ],
    },
    ...tseslint.configs.recommended,
    ...convexPlugin.configs.recommended,
    {
        files: ["metro.config.js"],
        rules: {
            "@typescript-eslint/no-require-imports": "off",
        },
    },
];
