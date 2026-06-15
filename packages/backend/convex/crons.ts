import { cronJobs } from "convex/server";
import { api, internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "daily:open-expired-drops",
  { minutes: 5 },
  internal.daily.openExpired,
);

crons.interval(
  "daily:close-expired-windows",
  { minutes: 5 },
  internal.daily.closeExpired,
);

crons.interval(
  "notifications:dispatch-pending",
  { minutes: 5 },
  internal.notifications.dispatchPending,
);

crons.daily(
  "autonomous-generation",
  { hourUTC: 0, minuteUTC: 0 },
  api.catalog.autonomousGenerateEpisode,
  { slug: "daily-auto" }
);

export default crons;
