// @vitest-environment node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readProjectFile } from "../files/projectFileSystem";
import { createRecoveryStore } from "./recoveryStore";

/**
 * PROJECT-1.5 legacy compatibility: a desktop recovery record written by
 * PROJECT-1.4 and a native file as PROJECT-1.3 saves them, frozen in
 * test/fixtures/persistence, must stay readable by today's main process.
 */

const FIXTURES = path.join(
  __dirname,
  "..",
  "..",
  "test",
  "fixtures",
  "persistence",
);
const RECORD = "22222222222222222222222222222222-4.layoutry-recovery";

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "layoutry-legacy-recovery-"));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("desktop records from earlier checkpoints", () => {
  it("lists and reads a PROJECT-1.4 recovery record byte for byte", async () => {
    await fs.copyFile(path.join(FIXTURES, RECORD), path.join(dir, RECORD));
    const store = createRecoveryStore({ directory: dir });
    await store.prepare();

    const [entry] = await store.list();
    expect(entry).toMatchObject({
      status: "ok",
      header: {
        recoveryVersion: 1,
        recordId: "22222222222222222222222222222222-4",
        projectName: "Native Site",
        source: { kind: "file", fileName: "Native Site.layoutry" },
        association: {
          path: path.win32.join(
            "C:\\",
            "Users",
            "Tester",
            "Documents",
            "Native Site.layoutry",
          ),
        },
      },
    });
    const read = await store.read("22222222222222222222222222222222-4");
    expect(read.text).toContain("Typed just before the crash");
    // Reading never rewrites the record.
    expect(await fs.readFile(path.join(dir, RECORD))).toEqual(
      await fs.readFile(path.join(FIXTURES, RECORD)),
    );
  });

  it("opens a PROJECT-1.3 native project file", async () => {
    const read = await readProjectFile(
      path.join(FIXTURES, "native-site-original-1.3.layoutry"),
    );
    expect(JSON.parse(read.text)).toMatchObject({
      format: "layoutry-project",
      formatVersion: 1,
      project: { name: "Native Site" },
    });
  });
});
