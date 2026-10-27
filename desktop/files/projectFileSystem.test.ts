// @vitest-environment node
import { spawn, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MAX_PROJECT_FILE_BYTES,
  ProjectFileError,
  fingerprintOf,
  nodeProjectFileOps,
  readProjectFile,
  writeProjectFileAtomically,
  type ProjectFileOps,
} from "./projectFileSystem";

const ORIGINAL =
  '{"format":"layoutry-project","formatVersion":1,"v":"original"}\n';
const UPDATED =
  '{"format":"layoutry-project","formatVersion":1,"v":"updated"}\n';
const noSleep = { sleep: () => Promise.resolve() };

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "layoutry-files-"));
  file = path.join(dir, "Website.layoutry");
});

afterEach(async () => {
  await fs.chmod(file, 0o666).catch(() => undefined);
  await fs.rm(dir, { recursive: true, force: true });
});

async function errorOf(promise: Promise<unknown>): Promise<ProjectFileError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  if (!(error instanceof ProjectFileError))
    throw new Error(`expected a ProjectFileError, got ${String(error)}`);
  return error;
}

/** The folder holds exactly the project file: no temporary files left behind. */
async function expectOnlyProjectFile() {
  expect(await fs.readdir(dir)).toEqual(["Website.layoutry"]);
}

function errno(code: string): Error {
  return Object.assign(new Error(code), { code });
}

describe("readProjectFile", () => {
  it("skips a UTF-8 byte order mark but fingerprints the bytes on disk", async () => {
    const bytes = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(ORIGINAL),
    ]);
    await fs.writeFile(file, bytes);
    const read = await readProjectFile(file);
    expect(read.text).toBe(ORIGINAL);
    expect(read.fingerprint).toEqual(fingerprintOf(bytes));
  });

  it("refuses bytes that aren't UTF-8 instead of replacing them with U+FFFD", async () => {
    const bytes = Buffer.from(
      ORIGINAL.replace("original", "origénal"),
      "latin1",
    );
    await fs.writeFile(file, bytes);
    const error = await errorOf(readProjectFile(file));
    expect(error.code).toBe("invalid-encoding");
    expect(error.message).not.toContain(dir);
  });

  it("reads the text and fingerprints the content", async () => {
    await fs.writeFile(file, ORIGINAL);
    const read = await readProjectFile(file);
    expect(read.text).toBe(ORIGINAL);
    expect(read.fingerprint).toEqual(fingerprintOf(Buffer.from(ORIGINAL)));
  });

  it.each([
    ["a relative path", "Website.layoutry"],
    ["another extension", "C:\\Windows\\win.ini"],
    ["a bare extension", "C:\\.layoutry"],
    ["a NUL byte", "C:\\a\0.layoutry"],
  ])("refuses %s before touching the disk", async (_label, candidate) => {
    expect((await errorOf(readProjectFile(candidate))).code).toBe(
      "invalid-path",
    );
  });

  it("reports a missing file", async () => {
    expect((await errorOf(readProjectFile(file))).code).toBe("not-found");
  });

  it("refuses a folder named like a project", async () => {
    await fs.mkdir(file);
    expect((await errorOf(readProjectFile(file))).code).toBe("not-a-file");
  });

  it("refuses an oversized file without reading it", async () => {
    let read = false;
    const ops: ProjectFileOps = {
      ...nodeProjectFileOps,
      lstat: async () => ({
        size: MAX_PROJECT_FILE_BYTES + 1,
        isFile: () => true,
        isSymbolicLink: () => false,
      }),
      readFile: async () => {
        read = true;
        return Buffer.from("");
      },
    };
    expect((await errorOf(readProjectFile(file, ops))).code).toBe("too-large");
    expect(read).toBe(false);
  });

  it("refuses to follow a junction or symbolic link", async () => {
    // A directory junction needs no admin rights on Windows.
    const target = path.join(dir, "real.layoutry");
    await fs.mkdir(target);
    await fs.symlink(target, file, "junction");
    expect((await errorOf(readProjectFile(file))).code).toBe("symbolic-link");
  });

  it("never echoes the full path in messages", async () => {
    const error = await errorOf(readProjectFile(file));
    expect(error.message).toContain("Website.layoutry");
    expect(error.message).not.toContain(dir);
  });
});

describe("writeProjectFileAtomically", () => {
  it("creates a new file and returns its fingerprint", async () => {
    const fingerprint = await writeProjectFileAtomically(file, ORIGINAL, {
      kind: "any",
    });
    expect(await fs.readFile(file, "utf8")).toBe(ORIGINAL);
    expect(fingerprint).toEqual(fingerprintOf(Buffer.from(ORIGINAL)));
    await expectOnlyProjectFile();
  });

  it("replaces the version it expects", async () => {
    await fs.writeFile(file, ORIGINAL);
    await writeProjectFileAtomically(file, UPDATED, {
      kind: "unchanged",
      fingerprint: fingerprintOf(Buffer.from(ORIGINAL)),
    });
    expect(await fs.readFile(file, "utf8")).toBe(UPDATED);
    await expectOnlyProjectFile();
  });

  it("refuses to overwrite a change made outside Layoutry", async () => {
    await fs.writeFile(file, "changed by another program");
    const error = await errorOf(
      writeProjectFileAtomically(file, UPDATED, {
        kind: "unchanged",
        fingerprint: fingerprintOf(Buffer.from(ORIGINAL)),
      }),
    );
    expect(error.code).toBe("modified-externally");
    expect(await fs.readFile(file, "utf8")).toBe("changed by another program");
    await expectOnlyProjectFile();
  });

  it("detects a same-size, same-time replacement by content, not timestamps", async () => {
    await fs.writeFile(file, ORIGINAL);
    const { mtime } = await fs.stat(file);
    const sameLength = ORIGINAL.replace("original", "ORIGINAL");
    await fs.writeFile(file, sameLength);
    await fs.utimes(file, mtime, mtime);
    const error = await errorOf(
      writeProjectFileAtomically(file, UPDATED, {
        kind: "unchanged",
        fingerprint: fingerprintOf(Buffer.from(ORIGINAL)),
      }),
    );
    expect(error.code).toBe("modified-externally");
  });

  it("re-checks right before the replace: a change made while the new version was being written still wins", async () => {
    // PROJECT-1.5: another program saves the file after the first check,
    // while Layoutry is still writing and flushing its temporary file.
    await fs.writeFile(file, ORIGINAL);
    const ops: ProjectFileOps = {
      ...nodeProjectFileOps,
      createExclusive: async (tempPath) => {
        const real = await nodeProjectFileOps.createExclusive(tempPath);
        return {
          ...real,
          sync: async () => {
            await real.sync();
            await fs.writeFile(file, "saved by another program meanwhile");
          },
        };
      },
    };
    const error = await errorOf(
      writeProjectFileAtomically(
        file,
        UPDATED,
        {
          kind: "unchanged",
          fingerprint: fingerprintOf(Buffer.from(ORIGINAL)),
        },
        ops,
      ),
    );
    expect(error.code).toBe("modified-externally");
    expect(await fs.readFile(file, "utf8")).toBe(
      "saved by another program meanwhile",
    );
    await expectOnlyProjectFile();
  });

  it("re-checks right before the replace: a file deleted meanwhile is reported, not recreated", async () => {
    await fs.writeFile(file, ORIGINAL);
    const ops: ProjectFileOps = {
      ...nodeProjectFileOps,
      createExclusive: async (tempPath) => {
        const real = await nodeProjectFileOps.createExclusive(tempPath);
        return {
          ...real,
          close: async () => {
            await real.close();
            await fs.unlink(file);
          },
        };
      },
    };
    const error = await errorOf(
      writeProjectFileAtomically(
        file,
        UPDATED,
        {
          kind: "unchanged",
          fingerprint: fingerprintOf(Buffer.from(ORIGINAL)),
        },
        ops,
      ),
    );
    expect(error.code).toBe("missing");
    expect(await fs.readdir(dir)).toEqual([]);
  });

  it("reports a file deleted outside Layoutry instead of recreating it silently", async () => {
    const error = await errorOf(
      writeProjectFileAtomically(file, UPDATED, {
        kind: "unchanged",
        fingerprint: fingerprintOf(Buffer.from(ORIGINAL)),
      }),
    );
    expect(error.code).toBe("missing");
    expect(await fs.readdir(dir)).toEqual([]);
  });

  it("overwrites anything only with an explicit 'any' expectation", async () => {
    await fs.writeFile(file, "changed by another program");
    await writeProjectFileAtomically(file, UPDATED, { kind: "any" });
    expect(await fs.readFile(file, "utf8")).toBe(UPDATED);
  });

  it("never writes through a link at the destination", async () => {
    const target = path.join(dir, "elsewhere.layoutry");
    await fs.mkdir(target);
    await fs.symlink(target, file, "junction");
    const error = await errorOf(
      writeProjectFileAtomically(file, UPDATED, { kind: "any" }),
    );
    expect(error.code).toBe("symbolic-link");
    expect(await fs.readdir(target)).toEqual([]);
  });

  it("uses unpredictable temporary names and never reuses an existing entry", async () => {
    await fs.writeFile(file, ORIGINAL);
    // An attacker (or a leftover) already holds the name: exclusive create fails.
    await fs.writeFile(
      path.join(dir, ".Website.fixed.layoutry-tmp"),
      "planted",
    );
    const error = await errorOf(
      writeProjectFileAtomically(
        file,
        UPDATED,
        { kind: "any" },
        nodeProjectFileOps,
        {
          randomSuffix: () => "fixed",
        },
      ),
    );
    expect(error.code).toBe("failed");
    expect(await fs.readFile(file, "utf8")).toBe(ORIGINAL);
    expect(
      await fs.readFile(path.join(dir, ".Website.fixed.layoutry-tmp"), "utf8"),
    ).toBe("planted");
  });

  describe("failure injection: the original always survives", () => {
    beforeEach(async () => {
      await fs.writeFile(file, ORIGINAL);
    });

    it.each([
      [
        "creating the temporary file (no permission)",
        { createExclusive: () => Promise.reject(errno("EACCES")) },
        "permission-denied",
      ],
      [
        "writing the contents (disk full)",
        {
          createExclusive: async (tempPath: string) => {
            const real = await nodeProjectFileOps.createExclusive(tempPath);
            return {
              ...real,
              write: async (bytes: Buffer) => {
                await real.write(bytes.subarray(0, 10));
                throw errno("ENOSPC");
              },
            };
          },
        },
        "disk-full",
      ],
      [
        "flushing to disk",
        {
          createExclusive: async (tempPath: string) => ({
            ...(await nodeProjectFileOps.createExclusive(tempPath)),
            sync: () => Promise.reject(errno("EIO")),
          }),
        },
        "failed",
      ],
      [
        "replacing (file locked by another program)",
        { rename: () => Promise.reject(errno("EBUSY")) },
        "locked",
      ],
      [
        "replacing (access denied, e.g. antivirus or a protected folder)",
        { rename: () => Promise.reject(errno("EPERM")) },
        "locked",
      ],
    ] satisfies [string, Partial<ProjectFileOps>, string][])(
      "fails while %s",
      async (_stage, overrides, code) => {
        const ops: ProjectFileOps = { ...nodeProjectFileOps, ...overrides };
        const error = await errorOf(
          writeProjectFileAtomically(
            file,
            UPDATED,
            { kind: "any" },
            ops,
            noSleep,
          ),
        );
        expect(error.code).toBe(code);
        expect(await fs.readFile(file, "utf8")).toBe(ORIGINAL);
        await expectOnlyProjectFile();
      },
    );

    it("rides out a briefly held lock (antivirus scan) by retrying the replace", async () => {
      let attempts = 0;
      const ops: ProjectFileOps = {
        ...nodeProjectFileOps,
        rename: async (from, to) => {
          attempts += 1;
          if (attempts < 3) throw errno("EPERM");
          return nodeProjectFileOps.rename(from, to);
        },
      };
      await writeProjectFileAtomically(
        file,
        UPDATED,
        { kind: "any" },
        ops,
        noSleep,
      );
      expect(attempts).toBe(3);
      expect(await fs.readFile(file, "utf8")).toBe(UPDATED);
      await expectOnlyProjectFile();
    });

    it("reports a read-back mismatch instead of claiming success", async () => {
      const ops: ProjectFileOps = {
        ...nodeProjectFileOps,
        rename: async (from, to) => {
          await nodeProjectFileOps.rename(from, to);
          await fs.writeFile(to, "tampered right after the replace");
        },
      };
      const error = await errorOf(
        writeProjectFileAtomically(
          file,
          UPDATED,
          { kind: "any" },
          ops,
          noSleep,
        ),
      );
      expect(error.code).toBe("verification-failed");
    });

    it("leaves the original byte-identical when the process dies mid-write", async () => {
      // Simulates a crash after a partial temporary write: the temporary file
      // is all that is affected, never the project file.
      const ops: ProjectFileOps = {
        ...nodeProjectFileOps,
        createExclusive: async (tempPath) => {
          const real = await nodeProjectFileOps.createExclusive(tempPath);
          return {
            ...real,
            write: async (bytes) => {
              await real.write(bytes.subarray(0, 5));
              throw new Error("simulated crash");
            },
          };
        },
      };
      await errorOf(
        writeProjectFileAtomically(
          file,
          UPDATED,
          { kind: "any" },
          ops,
          noSleep,
        ),
      );
      expect(await fs.readFile(file, "utf8")).toBe(ORIGINAL);
    });
  });

  describe("real Windows conditions", () => {
    let holder: ChildProcess | null = null;
    afterEach(() => {
      holder?.kill();
      holder = null;
    });

    it.runIf(process.platform === "win32")(
      "a file opened exclusively by another program is reported as locked and left intact",
      async () => {
        await fs.writeFile(file, ORIGINAL);
        holder = spawn(
          "powershell.exe",
          [
            "-NoProfile",
            "-Command",
            `$f = [System.IO.File]::Open('${file.replace(/'/g, "''")}', 'Open', 'ReadWrite', 'None'); Write-Output 'locked'; Start-Sleep -Seconds 30; $f.Close()`,
          ],
          { stdio: ["ignore", "pipe", "ignore"] },
        );
        await new Promise<void>((resolve) =>
          holder?.stdout?.once("data", () => resolve()),
        );

        const error = await errorOf(
          writeProjectFileAtomically(
            file,
            UPDATED,
            { kind: "any" },
            nodeProjectFileOps,
            {
              replaceRetryDelaysMs: [10, 10],
            },
          ),
        );
        // An exclusive open even blocks reading it back for the conflict check.
        expect(["locked", "permission-denied"]).toContain(error.code);
        holder.kill();
        await new Promise((resolve) => setTimeout(resolve, 300));
        expect(await fs.readFile(file, "utf8")).toBe(ORIGINAL);
        expect(
          (await fs.readdir(dir)).filter((name) =>
            name.endsWith(".layoutry-tmp"),
          ),
        ).toEqual([]);
      },
      20_000,
    );

    it.runIf(process.platform === "win32")(
      "a read-only file is not replaced",
      async () => {
        await fs.writeFile(file, ORIGINAL);
        await fs.chmod(file, 0o444);
        const error = await errorOf(
          writeProjectFileAtomically(
            file,
            UPDATED,
            { kind: "any" },
            nodeProjectFileOps,
            noSleep,
          ),
        );
        expect(["locked", "permission-denied"]).toContain(error.code);
        expect(await fs.readFile(file, "utf8")).toBe(ORIGINAL);
        await expectOnlyProjectFile();
      },
    );

    it("handles a 40 MB project and measures write and read time", async () => {
      const text = `{"format":"layoutry-project","formatVersion":1,"pad":"${"x".repeat(40 * 1024 * 1024)}"}`;
      const writeStart = performance.now();
      await writeProjectFileAtomically(file, text, { kind: "any" });
      const writeMs = performance.now() - writeStart;
      const readStart = performance.now();
      const read = await readProjectFile(file);
      const readMs = performance.now() - readStart;
      expect(read.text.length).toBe(text.length);
      console.log(
        `[file perf] 40 MB atomic write ${writeMs.toFixed(0)} ms, read ${readMs.toFixed(0)} ms`,
      );
      expect(writeMs).toBeLessThan(10_000);
    }, 30_000);
  });
});
