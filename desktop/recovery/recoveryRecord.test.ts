// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DEFAULT_RECOVERY_LIMITS,
  encodeRecord,
  parseHeader,
  recordIdOf,
  RECOVERY_RECORD_FORMAT,
  RECOVERY_RECORD_VERSION,
  selectRecordsToEvict,
  sessionIdOf,
  type RecoveryHeader,
  type RetentionEntry,
} from "./recoveryRecord";

const SESSION = "a".repeat(32);
const OTHER = "b".repeat(32);
const THIRD = "c".repeat(32);

function header(overrides: Partial<RecoveryHeader> = {}): RecoveryHeader {
  return {
    format: RECOVERY_RECORD_FORMAT,
    recoveryVersion: RECOVERY_RECORD_VERSION,
    recordId: recordIdOf(SESSION, 3),
    sessionId: SESSION,
    generation: 3,
    projectId: "project-1",
    projectName: "Website",
    savedAt: "2026-10-28T09:00:00.000Z",
    source: { kind: "file", fileName: "Website.layoutry" },
    textBytes: 10,
    sha256: "0".repeat(64),
    association: {
      path: "C:\\Work\\Website.layoutry",
      size: 9,
      sha256: "1".repeat(64),
    },
    ...overrides,
  };
}

describe("record header", () => {
  it("round-trips through the one-line header", () => {
    const bytes = encodeRecord(header(), "0123456789");
    const text = bytes.toString("utf8");
    const newline = text.indexOf("\n");
    expect(text.slice(newline + 1)).toBe("0123456789");
    expect(parseHeader(text.slice(0, newline))).toEqual({
      ok: true,
      header: header(),
    });
  });

  it("keeps the header on one line even for names with line breaks", () => {
    const text = encodeRecord(header({ projectName: "a\nb" }), "x").toString(
      "utf8",
    );
    expect(text.split("\n")).toHaveLength(2);
  });

  it.each([
    ["not JSON", "{"],
    [
      "another format",
      JSON.stringify({ ...header(), format: "layoutry-project" }),
    ],
    [
      "a record id that doesn't match",
      JSON.stringify({ ...header(), recordId: recordIdOf(SESSION, 4) }),
    ],
    [
      "a path-like session id",
      JSON.stringify({ ...header(), sessionId: "../x" }),
    ],
    ["a missing hash", JSON.stringify({ ...header(), sha256: undefined })],
    [
      "an invalid source",
      JSON.stringify({ ...header(), source: { kind: "cloud" } }),
    ],
    [
      "an invalid association",
      JSON.stringify({ ...header(), association: { path: 7 } }),
    ],
    ["an invalid date", JSON.stringify({ ...header(), savedAt: "yesterday" })],
  ])("rejects %s", (_label, line) => {
    expect(parseHeader(line)).toEqual({ ok: false, reason: "unreadable" });
  });

  it("recognizes a record from a newer Layoutry instead of calling it damaged", () => {
    expect(
      parseHeader(JSON.stringify({ ...header(), recoveryVersion: 2 })),
    ).toEqual({ ok: false, reason: "unsupported-version" });
  });

  it("derives the session from a record id, and nothing from anything else", () => {
    expect(sessionIdOf(recordIdOf(SESSION, 12))).toBe(SESSION);
    expect(sessionIdOf("..\\evil-1")).toBeNull();
    expect(sessionIdOf(`${SESSION}-0`)).toBeNull();
  });
});

function entry(
  sessionId: string,
  generation: number,
  options: { projectId?: string; bytes?: number; savedAt?: number } = {},
): RetentionEntry {
  return {
    recordId: recordIdOf(sessionId, generation),
    sessionId,
    projectId: options.projectId ?? "p",
    generation,
    savedAt: options.savedAt ?? generation * 1000,
    bytes: options.bytes ?? 10,
  };
}

describe("retention", () => {
  const limits = {
    snapshotsPerProject: 5,
    maxTotalBytes: 1000,
    maxRecords: 100,
  };

  it("keeps the writing session's five newest snapshots of a project", () => {
    const records = [1, 2, 3, 4, 5, 6, 7].map((g) => entry(SESSION, g));
    expect(
      selectRecordsToEvict(records, {
        ownSessionId: SESSION,
        liveSessionIds: new Set([SESSION]),
        keep: recordIdOf(SESSION, 7),
        limits,
      }).sort(),
    ).toEqual([recordIdOf(SESSION, 1), recordIdOf(SESSION, 2)].sort());
  });

  it("counts per project: two projects in one session keep five each", () => {
    const records = [
      ...[1, 2, 3, 4, 5].map((g) => entry(SESSION, g, { projectId: "p" })),
      ...[6, 7, 8, 9, 10].map((g) => entry(SESSION, g, { projectId: "q" })),
    ];
    expect(
      selectRecordsToEvict(records, {
        ownSessionId: SESSION,
        liveSessionIds: new Set([SESSION]),
        keep: recordIdOf(SESSION, 10),
        limits,
      }),
    ).toEqual([]);
  });

  it("over budget, removes the oldest redundant snapshots first and never a project's newest", () => {
    const records = [
      ...[1, 2, 3].map((g) => entry(OTHER, g, { bytes: 300, savedAt: g })),
      entry(SESSION, 1, { bytes: 300, savedAt: 10 }),
    ];
    // 1200 bytes > 1000: OTHER-1 (third newest) goes first, then OTHER-2.
    expect(
      selectRecordsToEvict(records, {
        ownSessionId: SESSION,
        liveSessionIds: new Set([SESSION]),
        keep: recordIdOf(SESSION, 1),
        limits,
      }),
    ).toEqual([recordIdOf(OTHER, 1)]);
    const tighter = { ...limits, maxTotalBytes: 650 };
    expect(
      selectRecordsToEvict(records, {
        ownSessionId: SESSION,
        liveSessionIds: new Set([SESSION]),
        keep: recordIdOf(SESSION, 1),
        limits: tighter,
      }),
    ).toEqual([recordIdOf(OTHER, 1), recordIdOf(OTHER, 2)]);
  });

  it("never deletes the only snapshot of a project, even far over budget", () => {
    const records = [
      entry(OTHER, 1, { bytes: 5000 }),
      entry(SESSION, 1, { bytes: 5000 }),
    ];
    expect(
      selectRecordsToEvict(records, {
        ownSessionId: SESSION,
        liveSessionIds: new Set([SESSION]),
        keep: recordIdOf(SESSION, 1),
        limits,
      }),
    ).toEqual([]);
  });

  it("never touches another running session's snapshots", () => {
    const records = [
      ...[1, 2, 3].map((g) => entry(THIRD, g, { bytes: 400 })),
      entry(SESSION, 1, { bytes: 400 }),
    ];
    expect(
      selectRecordsToEvict(records, {
        ownSessionId: SESSION,
        liveSessionIds: new Set([SESSION, THIRD]),
        keep: recordIdOf(SESSION, 1),
        limits,
      }),
    ).toEqual([]);
  });

  it("enforces the record-count bound too", () => {
    const records = [1, 2, 3, 4].map((g) => entry(OTHER, g));
    expect(
      selectRecordsToEvict([...records, entry(SESSION, 1)], {
        ownSessionId: SESSION,
        liveSessionIds: new Set([SESSION]),
        keep: recordIdOf(SESSION, 1),
        limits: { ...limits, maxRecords: 3 },
      }),
    ).toEqual([recordIdOf(OTHER, 1), recordIdOf(OTHER, 2)]);
  });

  it("documents the shipped limits", () => {
    expect(DEFAULT_RECOVERY_LIMITS).toEqual({
      snapshotsPerProject: 5,
      maxTotalBytes: 256 * 1024 * 1024,
      maxRecords: 100,
    });
  });
});
