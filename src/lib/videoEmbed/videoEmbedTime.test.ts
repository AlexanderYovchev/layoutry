import { describe, expect, it } from "vitest";
import { formatStartTime, MAX_VIDEO_START_SECONDS, parseProviderTime, parseStartTimeInput } from "./videoEmbedTime";

describe("video start times (BC-08.2)", () => {
  it.each([
    ["90", 90],
    ["90s", 90],
    ["1m30s", 90],
    ["1h2m3s", 3723],
    ["2m", 120],
    ["0", 0],
  ])("parseProviderTime(%j) = %d", (raw, seconds) => {
    expect(parseProviderTime(raw)).toBe(seconds);
  });

  it.each(["", "-5", "1.5", "abc", "1m30x", "s", "999999999", null, undefined])("parseProviderTime(%j) is undefined", (raw) => {
    expect(parseProviderTime(raw)).toBeUndefined();
  });

  it.each([
    ["1:30", 90],
    ["0:05", 5],
    ["1:02:03", 3723],
    ["75", 75],
    ["1m15s", 75],
  ])("parseStartTimeInput(%j) = %d", (raw, seconds) => {
    expect(parseStartTimeInput(raw)).toBe(seconds);
  });

  it.each(["1:60", "1:5", "1:61:00", "abc", "", "-1:00", "25:00:00"])("parseStartTimeInput(%j) is undefined", (raw) => {
    expect(parseStartTimeInput(raw)).toBeUndefined();
  });

  it("never exceeds 24 hours", () => {
    expect(parseProviderTime(String(MAX_VIDEO_START_SECONDS))).toBe(MAX_VIDEO_START_SECONDS);
    expect(parseProviderTime(String(MAX_VIDEO_START_SECONDS + 1))).toBeUndefined();
  });

  it("formats", () => {
    expect(formatStartTime(0)).toBe("0:00");
    expect(formatStartTime(90)).toBe("1:30");
    expect(formatStartTime(3723)).toBe("1:02:03");
  });
});
