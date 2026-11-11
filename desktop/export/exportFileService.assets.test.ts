// @vitest-environment node
import { promises as fs, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InvalidPayloadError } from "../files/projectFileService";
import { createExportFileService, MAX_EXPORT_ASSET_BYTES, nodeExportFileOps, type ExportFileOps } from "./exportFileService";

/**
 * BC-07.3: packaged images in a separate-files export, on real folders.
 * The service writes them into an "assets" folder inside the chosen folder,
 * stages and rolls back like the text files, and refuses anything that
 * isn't one of the engine's own image names and signatures.
 */

const OWNER = 3;
const fixture = (name: string) => new Uint8Array(readFileSync(path.join(process.cwd(), "test", "fixtures", "images", name)));
const PNG = fixture("upload-40x30.png");
const JPEG = fixture("upload-32x24.jpg");
const HTML = '<!DOCTYPE html><img src="assets/image-001.png"><img src="assets/image-002.jpg">\n';
const CSS = "img { display: block; }\n";

let dir: string;
let folderAnswer: string | null;

function setup(ops: ExportFileOps = nodeExportFileOps) {
  return createExportFileService({
    defaultFolder: () => dir,
    showSaveHtmlDialog: async () => path.join(dir, "page.html"),
    showFolderDialog: async () => folderAnswer,
    ops,
    writeHooks: { sleep: () => Promise.resolve(), replaceRetryDelaysMs: [] },
  });
}
type Service = ReturnType<typeof setup>;

async function chooseFolder(service: Service, folder: string) {
  folderAnswer = folder;
  const chosen = await service.chooseDestination(OWNER, { mode: "separate", suggestedName: "Site" });
  if (chosen.status !== "chosen") throw new Error(JSON.stringify(chosen));
  return chosen.destination.token;
}

const site = (assets = [{ path: "assets/image-001.png", bytes: PNG }, { path: "assets/image-002.jpg", bytes: JPEG }]) => [
  { path: "index.html", content: HTML },
  { path: "styles.css", content: CSS },
  ...assets,
];

const read = (...parts: string[]) => fs.readFile(path.join(dir, ...parts));
const list = async (...parts: string[]) => (await fs.readdir(path.join(dir, ...parts))).sort();

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "layoutry-export-assets-"));
  folderAnswer = null;
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("separate-files export with packaged images (BC-07.3)", () => {
  it("creates assets/ and writes every image's exact bytes; the result names them", async () => {
    const service = setup();
    const token = await chooseFolder(service, dir);
    const written = await service.write(OWNER, { token, files: site(), overwrite: false });
    expect(written).toEqual({ status: "saved", label: path.basename(dir), fileNames: ["assets/image-001.png", "assets/image-002.jpg", "styles.css", "index.html"] });
    expect(await list()).toEqual(["assets", "index.html", "styles.css"]);
    expect(await list("assets")).toEqual(["image-001.png", "image-002.jpg"]);
    expect(Buffer.from(await read("assets", "image-001.png")).equals(Buffer.from(PNG))).toBe(true);
    expect(Buffer.from(await read("assets", "image-002.jpg")).equals(Buffer.from(JPEG))).toBe(true);
    expect((await read("index.html")).toString("utf8")).toBe(HTML);
  });

  it("an existing assets folder is reused; its other files are never touched", async () => {
    await fs.mkdir(path.join(dir, "assets"));
    await fs.writeFile(path.join(dir, "assets", "logo.svg"), "<svg/>");
    const service = setup();
    const token = await chooseFolder(service, dir);
    expect((await service.write(OWNER, { token, files: site(), overwrite: false })).status).toBe("saved");
    expect(await list("assets")).toEqual(["image-001.png", "image-002.jpg", "logo.svg"]);
    expect((await read("assets", "logo.svg")).toString("utf8")).toBe("<svg/>");
  });

  it("existing images are a conflict, listed by name, and nothing is written until Replace", async () => {
    await fs.mkdir(path.join(dir, "assets"));
    await fs.writeFile(path.join(dir, "assets", "image-002.jpg"), "old");
    const service = setup();
    const token = await chooseFolder(service, dir);
    expect(await service.write(OWNER, { token, files: site(), overwrite: false })).toEqual({ status: "conflict", label: path.basename(dir), existing: ["assets/image-002.jpg"] });
    expect(await list()).toEqual(["assets"]);
    expect((await read("assets", "image-002.jpg")).toString("utf8")).toBe("old");
    expect((await service.write(OWNER, { token, files: site(), overwrite: true })).status).toBe("saved");
    expect(Buffer.from(await read("assets", "image-002.jpg")).equals(Buffer.from(JPEG))).toBe(true);
  });

  it("a failure while replacing puts everything back and removes the assets folder it created", async () => {
    let renames = 0;
    const failing: ExportFileOps = {
      ...nodeExportFileOps,
      rename: async (from, to) => {
        renames += 1;
        // Images go first; fail on index.html, the last file.
        if (path.basename(to) === "index.html") throw Object.assign(new Error("denied"), { code: "EACCES" });
        return nodeExportFileOps.rename(from, to);
      },
    };
    await fs.writeFile(path.join(dir, "styles.css"), "old css");
    const service = setup(failing);
    const token = await chooseFolder(service, dir);
    const result = await service.write(OWNER, { token, files: site(), overwrite: true });
    expect(result).toMatchObject({ status: "error", error: { code: "permission-denied", message: expect.stringContaining("put back") } });
    expect(renames).toBeGreaterThanOrEqual(4);
    expect(await list()).toEqual(["styles.css"]);
    expect((await read("styles.css")).toString("utf8")).toBe("old css");
  });

  it("a failure while staging leaves no temporary files and no new assets folder", async () => {
    let creates = 0;
    const failing: ExportFileOps = {
      ...nodeExportFileOps,
      createExclusive: async (filePath) => {
        creates += 1;
        if (creates === 2) throw Object.assign(new Error("full"), { code: "ENOSPC" });
        return nodeExportFileOps.createExclusive(filePath);
      },
    };
    const service = setup(failing);
    const token = await chooseFolder(service, dir);
    expect(await service.write(OWNER, { token, files: site(), overwrite: false })).toMatchObject({ status: "error", error: { code: "disk-full" } });
    expect(await list()).toEqual([]);
  });

  it("refuses an assets folder that is a junction or a file, before reading or writing through it", async () => {
    const elsewhere = await fs.mkdtemp(path.join(os.tmpdir(), "layoutry-export-elsewhere-"));
    try {
      await fs.symlink(elsewhere, path.join(dir, "assets"), "junction");
      const service = setup();
      const token = await chooseFolder(service, dir);
      expect(await service.write(OWNER, { token, files: site(), overwrite: true })).toMatchObject({ status: "error", error: { code: "symbolic-link" } });
      expect(await fs.readdir(elsewhere)).toEqual([]);
    } finally {
      await fs.rm(elsewhere, { recursive: true, force: true });
    }
    await fs.rm(path.join(dir, "assets"), { force: true, recursive: true });
    await fs.writeFile(path.join(dir, "assets"), "a file");
    const service = setup();
    const token = await chooseFolder(service, dir);
    expect(await service.write(OWNER, { token, files: site(), overwrite: true })).toMatchObject({ status: "error", error: { code: "not-a-folder" } });
    expect((await read("assets")).toString("utf8")).toBe("a file");
  });

  describe("payload validation at the process boundary", () => {
    it.each([
      ["a traversal name", "assets/../evil.png", PNG],
      ["a nested traversal", "assets/image-001.png/../../x.png", PNG],
      ["a user-style name", "assets/photo.png", PNG],
      ["an executable extension", "assets/image-001.exe", PNG],
      ["a Windows separator", "assets\\image-001.png", PNG],
      ["an absolute path", "C:/image-001.png", PNG],
      ["bytes that aren't a PNG", "assets/image-001.png", JPEG],
      ["HTML posing as an image", "assets/image-001.gif", new TextEncoder().encode("<script>alert(1)</script>")],
      ["an empty image", "assets/image-001.png", new Uint8Array()],
    ])("refuses %s", async (_name, assetPath, bytes) => {
      const service = setup();
      const token = await chooseFolder(service, dir);
      await expect(service.write(OWNER, { token, files: site([{ path: assetPath, bytes }]), overwrite: true })).rejects.toThrow(InvalidPayloadError);
      expect(await list()).toEqual([]);
    });

    it("refuses duplicates, oversize images, extra keys and text sent as an image", async () => {
      const service = setup();
      const token = await chooseFolder(service, dir);
      const write = (assets: unknown[]) => service.write(OWNER, { token, files: [...site([]), ...assets], overwrite: true });
      await expect(write([{ path: "assets/image-001.png", bytes: PNG }, { path: "assets/image-001.png", bytes: PNG }])).rejects.toThrow(/duplicate/);
      const huge = new Uint8Array(MAX_EXPORT_ASSET_BYTES + 1);
      huge.set(PNG.subarray(0, 8));
      await expect(write([{ path: "assets/image-001.png", bytes: huge }])).rejects.toThrow(/size/);
      await expect(write([{ path: "assets/image-001.png", bytes: PNG, content: "x" }])).rejects.toThrow(InvalidPayloadError);
      await expect(write([{ path: "assets/image-001.png", bytes: Array.from(PNG) }])).rejects.toThrow(/Uint8Array/);
      await expect(write([{ path: "assets/image-001.png", content: "x" }])).rejects.toThrow(/unexpected export file name/);
      expect(await list()).toEqual([]);
    });

    it("a single-file destination never accepts images", async () => {
      const service = setup();
      const chosen = await service.chooseDestination(OWNER, { mode: "standalone", suggestedName: "index.html" });
      if (chosen.status !== "chosen") throw new Error("not chosen");
      await expect(
        service.write(OWNER, { token: chosen.destination.token, files: [{ path: "index.html", content: HTML }, { path: "assets/image-001.png", bytes: PNG }], overwrite: true }),
      ).rejects.toThrow(/exactly index\.html/);
      expect(await list()).toEqual([]);
    });
  });
});
