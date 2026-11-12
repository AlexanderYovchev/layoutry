/** The longest start time Layoutry accepts: 24 hours. */
export const MAX_VIDEO_START_SECONDS = 24 * 60 * 60;

function bounded(seconds: number): number | undefined {
  return Number.isSafeInteger(seconds) && seconds >= 0 && seconds <= MAX_VIDEO_START_SECONDS ? seconds : undefined;
}

/**
 * A start time as written in a provider URL: "90", "90s", "1m30s",
 * "1h2m3s" (YouTube t=, Vimeo #t=, Loom t=, Wistia time=). Anything else,
 * including negative, fractional or absurdly large values, is undefined.
 */
export function parseProviderTime(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  const value = raw.trim().toLowerCase();
  if (/^\d{1,6}$/.test(value)) return bounded(Number(value));
  const match = /^(?:(\d{1,3})h)?(?:(\d{1,4})m)?(?:(\d{1,6})s)?$/.exec(value);
  if (!match || value === "") return undefined;
  const [, hours = "0", minutes = "0", seconds = "0"] = match;
  return bounded(Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds));
}

/**
 * A start time typed in the Inspector: "90", "1:30", "1:02:03", or the
 * provider forms above. Returns undefined when it isn't a valid time.
 */
export function parseStartTimeInput(raw: string): number | undefined {
  const value = raw.trim();
  const clock = /^(?:(\d{1,3}):)?(\d{1,3}):(\d{2})$/.exec(value);
  if (clock) {
    const [, hours = "0", minutes, seconds] = clock;
    if (Number(seconds) > 59 || (hours !== "0" && Number(minutes) > 59)) return undefined;
    return bounded(Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds));
  }
  return parseProviderTime(value);
}

/** 90 -> "1:30", 3723 -> "1:02:03". */
export function formatStartTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${rest}` : `${minutes}:${rest}`;
}
