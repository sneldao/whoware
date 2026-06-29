/**
 * Structured logger that routes to console in development and no-ops
 * (or a future telemetry sink) in production. Replaces bare `console.*`
 * calls and empty `catch {}` blocks across the app.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.warn("enterSceneMutation failed", e);
 *   logger.error("mint failed", e);
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const IS_DEV: boolean =
  typeof __DEV__ !== "undefined"
    ? __DEV__
    : process.env.NODE_ENV !== "production";

function log(level: LogLevel, context: string, error?: unknown) {
  if (!IS_DEV && (level === "debug" || level === "info")) return;

  const prefix = `[${context}]`;
  if (error !== undefined) {
    // eslint-disable-next-line no-console
    console[level](prefix, error);
  } else {
    // eslint-disable-next-line no-console
    console[level](prefix);
  }
}

export const logger = {
  debug: (context: string, error?: unknown) => log("debug", context, error),
  info: (context: string, error?: unknown) => log("info", context, error),
  warn: (context: string, error?: unknown) => log("warn", context, error),
  error: (context: string, error?: unknown) => log("error", context, error),
};
