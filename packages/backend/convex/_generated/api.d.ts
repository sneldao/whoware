/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as archive from "../archive.js";
import type * as auth from "../auth.js";
import type * as catalog from "../catalog.js";
import type * as crons from "../crons.js";
import type * as daily from "../daily.js";
import type * as delegation from "../delegation.js";
import type * as episodes from "../episodes.js";
import type * as figures from "../figures.js";
import type * as functions from "../functions.js";
import type * as http from "../http.js";
import type * as inco from "../inco.js";
import type * as mantle from "../mantle.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as paywall from "../paywall.js";
import type * as practice from "../practice.js";
import type * as props from "../props.js";
import type * as rateLimit from "../rateLimit.js";
import type * as revealGating from "../revealGating.js";
import type * as runs from "../runs.js";
import type * as scoring from "../scoring.js";
import type * as venice from "../venice.js";
import type * as walletAuth from "../walletAuth.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  archive: typeof archive;
  auth: typeof auth;
  catalog: typeof catalog;
  crons: typeof crons;
  daily: typeof daily;
  delegation: typeof delegation;
  episodes: typeof episodes;
  figures: typeof figures;
  functions: typeof functions;
  http: typeof http;
  inco: typeof inco;
  mantle: typeof mantle;
  migrations: typeof migrations;
  notifications: typeof notifications;
  paywall: typeof paywall;
  practice: typeof practice;
  props: typeof props;
  rateLimit: typeof rateLimit;
  revealGating: typeof revealGating;
  runs: typeof runs;
  scoring: typeof scoring;
  venice: typeof venice;
  walletAuth: typeof walletAuth;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  actionCache: import("@convex-dev/action-cache/_generated/component.js").ComponentApi<"actionCache">;
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  pushNotifications: import("@convex-dev/expo-push-notifications/_generated/component.js").ComponentApi<"pushNotifications">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
  agent: import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">;
  rag: import("@convex-dev/rag/_generated/component.js").ComponentApi<"rag">;
  crons: import("@convex-dev/crons/_generated/component.js").ComponentApi<"crons">;
  shardedCounter: import("@convex-dev/sharded-counter/_generated/component.js").ComponentApi<"shardedCounter">;
  aggregate: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"aggregate">;
};
