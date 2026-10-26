// @vitest-environment node
import { describe, expect, it } from "vitest";
import { FILE_TOKEN_PATTERN, FileCapabilityRegistry } from "./fileCapabilities";
import { projectFilesFromArguments } from "./launchArguments";

const PATH = "C:\\Projects\\Website.layoutry";

describe("FileCapabilityRegistry", () => {
  it("issues random, opaque 128-bit tokens", () => {
    const registry = new FileCapabilityRegistry();
    const a = registry.issue(1, PATH, null);
    const b = registry.issue(1, PATH, null);
    expect(a).toMatch(FILE_TOKEN_PATTERN);
    expect(a).not.toBe(b);
    expect(a).not.toContain("Website");
  });

  it("resolves a token only for the window it was issued to", () => {
    const registry = new FileCapabilityRegistry();
    const token = registry.issue(1, PATH, null);
    expect(registry.resolve(1, token)).toMatchObject({
      filePath: PATH,
      fileName: "Website.layoutry",
    });
    expect(registry.resolve(2, token)).toBeNull();
  });

  it.each([
    "",
    "../../etc/passwd",
    "C:\\Windows\\win.ini",
    "A".repeat(32),
    "0".repeat(31),
  ])("rejects a forged or malformed token %j", (token) => {
    const registry = new FileCapabilityRegistry();
    registry.issue(1, PATH, null);
    expect(registry.resolve(1, token)).toBeNull();
  });

  it("forgets released tokens and every token of a closed window", () => {
    const registry = new FileCapabilityRegistry();
    const kept = registry.issue(1, PATH, null);
    const released = registry.issue(1, PATH, null);
    registry.release(1, released);
    expect(registry.resolve(1, released)).toBeNull();
    expect(registry.resolve(1, kept)).not.toBeNull();
    registry.revokeOwner(1);
    expect(registry.resolve(1, kept)).toBeNull();
  });

  it("keeps at most 32 tokens per window, dropping the oldest", () => {
    const registry = new FileCapabilityRegistry();
    const first = registry.issue(1, PATH, null);
    for (let i = 0; i < 32; i += 1) registry.issue(1, PATH, null);
    expect(registry.count(1)).toBe(32);
    expect(registry.resolve(1, first)).toBeNull();
  });

  it("records the version last written", () => {
    const registry = new FileCapabilityRegistry();
    const token = registry.issue(1, PATH, null);
    registry.recordVersion(1, token, { size: 3, sha256: "abc" });
    expect(registry.resolve(1, token)?.fingerprint).toEqual({
      size: 3,
      sha256: "abc",
    });
  });
});

describe("projectFilesFromArguments", () => {
  it("finds .layoutry files and resolves relative paths against the launch folder", () => {
    expect(
      projectFilesFromArguments(
        [
          "C:\\Apps\\Layoutry.exe",
          "Site.layoutry",
          "--user-data-dir=C:\\x",
          "D:\\Work\\Shop.LAYOUTRY",
        ],
        "C:\\Users\\me\\Desktop",
      ),
    ).toEqual([
      "C:\\Users\\me\\Desktop\\Site.layoutry",
      "D:\\Work\\Shop.LAYOUTRY",
    ]);
  });

  it("ignores switches, other files, the app path and duplicates", () => {
    expect(
      projectFilesFromArguments(
        [
          "electron.exe",
          "C:\\repo",
          "--flag=a.layoutry",
          "notes.txt",
          "a.layoutry",
          "a.layoutry",
        ],
        "C:\\w",
      ),
    ).toEqual(["C:\\w\\a.layoutry"]);
  });
});
