const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

// Load environment variables from monorepo root
require("@expo/env").loadProjectEnv(monorepoRoot, { force: true });

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Let Metro know where to resolve packages from
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(monorepoRoot, "node_modules"),
];

// Exclude the app's build-output directory from Metro's file crawl/watch.
// `expo export` writes copied node_module assets into apps/default/dist/ and
// then cleans them up, which crashes the Metro file watcher with ENOENT if it
// descends in. Scope this narrowly to the app's own dist/ so we do NOT block
// legitimate package dist/ folders (e.g. react-native-web/dist/index).
config.resolver.blockList = new RegExp(
    `^${projectRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/dist/.*`,
);

module.exports = config;
