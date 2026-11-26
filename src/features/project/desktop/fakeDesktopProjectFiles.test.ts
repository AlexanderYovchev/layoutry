import { describe, expect, it } from "vitest";
import { createFakeDesktopProjectFiles } from "@/features/project/desktop/fakeDesktopProjectFiles";

/** The test double must apply the main process's BC-05.4 rule, including BC-17.2 revisions. */
describe("fake desktop bridge: older-format protection (BC-05.4, BC-17.2)", () => {
  const text = (formatVersion: number, formatRevision?: number) =>
    JSON.stringify({
      format: "layoutry-project",
      formatVersion,
      ...(formatRevision === undefined ? {} : { formatRevision }),
    });

  async function opened(original: string) {
    const fake = createFakeDesktopProjectFiles();
    fake.disk.set("Site.layoutry", original);
    fake.script.open = "Site.layoutry";
    const result = await fake.bridge.openProjectFile();
    if (result.status !== "opened") throw new Error(result.status);
    return { fake, token: result.file.token };
  }

  it("asks before raising the revision within format 4, and writes only on consent", async () => {
    const { fake, token } = await opened(text(4, 0));
    expect(
      await fake.bridge.writeProjectFile(token, text(4, 1), false, false),
    ).toEqual({
      status: "older-format",
      fileName: "Site.layoutry",
      formatVersion: 4,
    });
    expect(fake.disk.get("Site.layoutry")).toBe(text(4, 0));
    expect(
      await fake.bridge.writeProjectFile(token, text(4, 1), false, true),
    ).toEqual({ status: "saved", fileName: "Site.layoutry" });
  });

  it("asks before turning a format 3 file into format 4, and saves the same revision straight back", async () => {
    const legacy = await opened(text(3));
    expect(
      (
        await legacy.fake.bridge.writeProjectFile(
          legacy.token,
          text(4, 0),
          false,
          false,
        )
      ).status,
    ).toBe("older-format");
    const current = await opened(text(4, 0));
    expect(
      (
        await current.fake.bridge.writeProjectFile(
          current.token,
          text(4, 0),
          false,
          false,
        )
      ).status,
    ).toBe("saved");
  });
});
