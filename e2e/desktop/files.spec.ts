import { expect, test, type Page } from "@playwright/test";
import { spawn } from "node:child_process";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  documentNodeCount,
  dragInsertContainer,
  electronBinary,
  fileDialogCalls,
  launchLayoutry,
  makeTempDir,
  REPO_ROOT,
  removeDir,
  requestWindowClose,
  scriptFileDialogs,
  spawnEnv,
  waitForExit,
  type LaunchedLayoutry,
} from "./support/layoutryApp";

/**
 * PROJECT-1.3 — native .layoutry files in the real Electron app. The
 * native Open/Save dialogs are scripted in the main process (deterministic);
 * everything else — preload, IPC, capability tokens, the atomic write on a
 * real disk, close coordination — is the real code path. The packaged
 * suite drives the genuine Windows dialogs.
 */

let layoutry: LaunchedLayoutry | undefined;
let folder: string;

test.beforeEach(async () => {
  folder = await makeTempDir("layoutry-files-e2e-");
});

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
  await removeDir(folder);
});

function status(page: Page) {
  return page.locator("[data-project-status]");
}

async function readProject(filePath: string) {
  const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
  if (typeof parsed !== "object" || parsed === null)
    throw new Error("not an object");
  const project: unknown = Reflect.get(parsed, "project");
  const document: unknown = Reflect.get(parsed, "document");
  return {
    format: Reflect.get(parsed, "format"),
    id:
      typeof project === "object" && project !== null
        ? Reflect.get(project, "id")
        : null,
    name:
      typeof project === "object" && project !== null
        ? Reflect.get(project, "name")
        : null,
    document,
  };
}

function projectFile(name: string, heading: string, id = "file-project-1") {
  return `${JSON.stringify(
    {
      format: "layoutry-project",
      formatVersion: 1,
      project: {
        id,
        name,
        createdAt: "2026-10-27T08:00:00.000Z",
        updatedAt: "2026-10-27T08:00:00.000Z",
      },
      document: {
        id: "page-root",
        tag: "page",
        children: [{ id: "heading-f", tag: "h1", text: heading }],
      },
    },
    null,
    2,
  )}\n`;
}

async function saveNow(page: Page) {
  await page.keyboard.press("Control+s");
  await expect(status(page)).toHaveAttribute("data-project-status", "saved");
}

test("Save writes a .layoutry file to the chosen folder; later saves reuse it; it reopens after a restart", async () => {
  const target = path.join(folder, "My Website.layoutry");
  layoutry = await launchLayoutry();
  const { app, page, userDataDir } = layoutry;
  await scriptFileDialogs(app, { save: [target] });
  const nodes = (await documentNodeCount(page)) + 1;
  await dragInsertContainer(page);
  await expect.poll(() => documentNodeCount(page)).toBe(nodes);

  await saveNow(page);
  const first = await readProject(target);
  expect(first).toMatchObject({
    format: "layoutry-project",
    name: "My Website",
  });
  await expect(page.locator("[data-project-source]")).toHaveText(
    /My Website\.layoutry/,
  );
  await expect(page.locator("[data-project-source]")).not.toHaveText(/[\\/]/);
  expect(await readdir(folder)).toEqual(["My Website.layoutry"]);

  // The second save goes straight to the same file: no dialog. (A rename
  // is a deterministic edit; it must be written on the next save.)
  await page.getByRole("button", { name: /Rename project/ }).click();
  await page
    .getByRole("textbox", { name: "Project name" })
    .fill("Renamed Site");
  await page.keyboard.press("Enter");
  await expect(status(page)).toHaveText("Unsaved changes");
  await saveNow(page);
  expect((await fileDialogCalls(app)).map((call) => call.kind)).toEqual([
    "save",
  ]);
  const second = await readProject(target);
  expect(second.id).toBe(first.id);
  expect(second.name).toBe("Renamed Site");
  expect(second.document).toEqual(first.document);
  expect(await readdir(folder)).toEqual(["My Website.layoutry"]);

  // Saved, so it closes without asking; reopen with the same profile.
  const child = app.process();
  await requestWindowClose(app).catch(() => undefined);
  expect(await waitForExit(child, 15_000)).toBe(0);
  layoutry = undefined;

  layoutry = await launchLayoutry({ userDataDir });
  await scriptFileDialogs(layoutry.app, { open: [target] });
  await layoutry.page.keyboard.press("Control+o");
  await expect(
    layoutry.page.getByRole("button", {
      name: "Project: Renamed Site. Rename project",
    }),
  ).toBeVisible();
  await expect.poll(() => documentNodeCount(layoutry!.page)).toBe(nodes);
  await expect(status(layoutry.page)).toHaveText("Saved");
});

test("cancelling the Save dialog writes nothing and keeps the changes unsaved", async () => {
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  await scriptFileDialogs(app, { save: [null] });
  await dragInsertContainer(page);
  await page.keyboard.press("Control+s");
  await expect.poll(async () => (await fileDialogCalls(app)).length).toBe(1);
  await expect(status(page)).toHaveText("Unsaved changes");
  expect(await readdir(folder)).toEqual([]);
});

test("Save As writes a new file with a new identity and keeps the original as it was", async () => {
  const original = path.join(folder, "Original.layoutry");
  const copy = path.join(folder, "Copy.layoutry");
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  await scriptFileDialogs(app, { save: [original, copy] });
  await saveNow(page);
  const originalText = await readFile(original, "utf8");
  await dragInsertContainer(page);

  await page.keyboard.press("Control+Shift+s");
  await expect(page.locator("[data-project-source]")).toHaveText(
    /Copy\.layoutry/,
  );
  await expect(status(page)).toHaveText("Saved");
  expect(await readFile(original, "utf8")).toBe(originalText);
  expect((await readProject(copy)).id).not.toBe(
    (await readProject(original)).id,
  );
});

test("a file changed outside Layoutry is never overwritten without confirmation", async () => {
  const target = path.join(folder, "Shared.layoutry");
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  await scriptFileDialogs(app, { save: [target] });
  await saveNow(page);

  const external = projectFile("Edited elsewhere", "Changed by a colleague");
  await writeFile(target, external);
  await dragInsertContainer(page);
  await page.keyboard.press("Control+s");

  const conflict = page.getByRole("dialog", {
    name: "File Changed Outside Layoutry",
  });
  await expect(conflict).toBeVisible();
  await conflict.getByRole("button", { name: "Cancel" }).click();
  expect(await readFile(target, "utf8")).toBe(external);
  await expect(status(page)).toHaveText("Unsaved changes");

  await page.keyboard.press("Control+s");
  await conflict.getByRole("button", { name: "Overwrite" }).click();
  await expect(status(page)).toHaveText("Saved");
  expect(await readFile(target, "utf8")).not.toBe(external);
});

test("a file deleted outside Layoutry is reported, and can be saved again", async () => {
  const target = path.join(folder, "Gone.layoutry");
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  await scriptFileDialogs(app, { save: [target] });
  await saveNow(page);
  await rm(target);
  await dragInsertContainer(page);

  await page.keyboard.press("Control+s");
  const conflict = page.getByRole("dialog", { name: "File Moved or Deleted" });
  await expect(conflict).toBeVisible();
  await conflict.getByRole("button", { name: "Save Here Anyway" }).click();
  await expect(status(page)).toHaveText("Saved");
  expect((await readProject(target)).format).toBe("layoutry-project");
});

test("invalid, newer-version and wrong-type files are refused and change nothing", async () => {
  const cases: [string, string, RegExp][] = [
    ["Broken.layoutry", "{ not json", /can't be opened/],
    [
      "Future.layoutry",
      '{"format":"layoutry-project","formatVersion":99}',
      /newer version of Layoutry/,
    ],
    ["notes.txt", "hello", /isn't a valid Layoutry project file location/],
  ];
  for (const [name, text] of cases)
    await writeFile(path.join(folder, name), text);
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  await scriptFileDialogs(app, {
    open: cases.map(([name]) => path.join(folder, name)),
  });
  await dragInsertContainer(page);
  const nodes = await documentNodeCount(page);

  for (const [, , message] of cases) {
    await page.keyboard.press("Control+o");
    const error = page.getByRole("dialog").filter({ hasText: message });
    await expect(error).toBeVisible();
    await error.getByRole("button", { name: "OK" }).click();
    expect(await documentNodeCount(page)).toBe(nodes);
    await expect(status(page)).toHaveText("Unsaved changes");
  }
});

test("a .layoutry file named on the command line opens at startup", async () => {
  const target = path.join(folder, "From Explorer.layoutry");
  await writeFile(
    target,
    projectFile("From Explorer", "Opened from the command line"),
  );
  layoutry = await launchLayoutry({ extraArgs: [target] });
  await expect(layoutry.page.locator("[data-document-surface] h1")).toHaveText(
    "Opened from the command line",
  );
  await expect(layoutry.page.locator("[data-project-source]")).toHaveText(
    /From Explorer\.layoutry/,
  );
});

test("a second launch with a file forwards it to the running editor, asking about unsaved work first", async () => {
  const target = path.join(folder, "Forwarded.layoutry");
  await writeFile(
    target,
    projectFile("Forwarded", "Forwarded by a second launch"),
  );
  layoutry = await launchLayoutry();
  const { page, userDataDir } = layoutry;
  await dragInsertContainer(page);

  const second = spawn(
    electronBinary(),
    [REPO_ROOT, `--user-data-dir=${userDataDir}`, target],
    {
      cwd: REPO_ROOT,
      env: spawnEnv(),
      stdio: "ignore",
    },
  );
  expect(await waitForExit(second, 20_000)).toBe(0);

  const prompt = page.getByRole("dialog", { name: "Unsaved Changes" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "Don't Save" }).click();
  await expect(page.locator("[data-document-surface] h1")).toHaveText(
    "Forwarded by a second launch",
  );
});

test("closing with unsaved work: Save writes the file first, then the app exits", async () => {
  const target = path.join(folder, "Saved On Close.layoutry");
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  await scriptFileDialogs(app, { save: [target] });
  await dragInsertContainer(page);

  const child = app.process();
  await requestWindowClose(app);
  await page
    .getByRole("dialog", { name: "Unsaved Changes" })
    .getByRole("button", { name: "Save", exact: true })
    .click();
  expect(await waitForExit(child, 15_000)).toBe(0);
  layoutry = undefined;
  expect((await readProject(target)).name).toBe("Saved On Close");
});

test("closing with unsaved work: a cancelled Save dialog keeps the window open", async () => {
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  await scriptFileDialogs(app, { save: [null] });
  await dragInsertContainer(page);

  await requestWindowClose(app);
  await page
    .getByRole("dialog", { name: "Unsaved Changes" })
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect.poll(async () => (await fileDialogCalls(app)).length).toBe(1);
  await expect(status(page)).toHaveText("Unsaved changes");
  expect(
    await app.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows().length,
    ),
  ).toBe(1);
});

test("the page gets a fixed bridge: no paths, no ipcRenderer, forged tokens and bad payloads refused", async () => {
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  await scriptFileDialogs(app, { save: [null] });

  const probe = await page.evaluate(async () => {
    const bridge: unknown = Reflect.get(window, "layoutryDesktop");
    if (typeof bridge !== "object" || bridge === null) return null;
    const call = (name: string, ...args: unknown[]) => {
      const fn: unknown = Reflect.get(bridge, name);
      if (typeof fn !== "function") throw new Error(`missing ${name}`);
      return Promise.resolve()
        .then(() => fn(...args))
        .then(
          (value: unknown) => ({ ok: true, value }),
          (error: unknown) => ({ ok: false, value: String(error) }),
        );
    };
    return {
      keys: Object.keys(bridge).sort(),
      frozen: Object.isFrozen(bridge),
      ipcRenderer: typeof Reflect.get(window, "ipcRenderer"),
      forgedToken: await call(
        "writeProjectFile",
        "0123456789abcdef0123456789abcdef",
        '{"format":"layoutry-project","formatVersion":1}',
        true,
      ),
      pathAsToken: await call(
        "writeProjectFile",
        "C:\\Windows\\win.ini",
        '{"format":"layoutry-project","formatVersion":1}',
        true,
      ),
      notAProject: await call(
        "writeProjectFile",
        "0123456789abcdef0123456789abcdef",
        "MZ binary",
        true,
      ),
      wrongType: await call("writeProjectFile", "t", 42, true),
      traversalName: await call(
        "chooseSaveLocation",
        "..\\..\\Windows\\System32\\evil.layoutry",
      ),
    };
  });

  expect(probe).not.toBeNull();
  expect(probe?.keys).toEqual([
    "apiVersion",
    "chooseSaveLocation",
    "onCloseRequested",
    "onPendingProjectFile",
    "openProjectFile",
    "releaseProjectFile",
    "respondToCloseRequest",
    "setUnsavedChanges",
    "takePendingProjectFile",
    "writeProjectFile",
  ]);
  expect(probe?.frozen).toBe(true);
  expect(probe?.ipcRenderer).toBe("undefined");
  expect(probe?.forgedToken).toMatchObject({
    ok: true,
    value: { status: "error", error: { code: "invalid-token" } },
  });
  expect(probe?.pathAsToken.ok).toBe(false);
  expect(probe?.notAProject.ok).toBe(false);
  expect(probe?.wrongType.ok).toBe(false);
  // The Save dialog only ever suggested a bare file name in a normal folder.
  const [saveCall] = await fileDialogCalls(app);
  expect(path.basename(String(saveCall.defaultPath))).toBe("evil.layoutry");
  expect(String(saveCall.defaultPath)).not.toMatch(/System32/);
});

test("open and save latency for representative project sizes", async () => {
  test.setTimeout(180_000);
  const sizes = [
    { label: "500 elements", elements: 500, textLength: 20 },
    { label: "5,000 elements", elements: 5_000, textLength: 20 },
    { label: "5,000 elements, long texts", elements: 5_000, textLength: 2_000 },
  ];
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  const results: string[] = [];
  for (const size of sizes) {
    const source = path.join(
      folder,
      `perf-${size.elements}-${size.textLength}.layoutry`,
    );
    const copy = path.join(
      folder,
      `perf-${size.elements}-${size.textLength}-copy.layoutry`,
    );
    const children = Array.from({ length: size.elements }, (_, index) => ({
      id: `p-${index.toString(16).padStart(8, "0")}`,
      tag: "p",
      text: `${index} `.padEnd(size.textLength, "x"),
    }));
    const text = JSON.stringify({
      format: "layoutry-project",
      formatVersion: 1,
      project: {
        id: `perf-${size.elements}`,
        name: "Perf",
        createdAt: "2026-10-27T08:00:00.000Z",
        updatedAt: "2026-10-27T08:00:00.000Z",
      },
      document: { id: "page-root", tag: "page", children },
    });
    await writeFile(source, text);
    await scriptFileDialogs(app, { open: [source], save: [copy] });

    const openStart = Date.now();
    await page.keyboard.press("Control+o");
    const prompt = page.getByRole("dialog", { name: "Unsaved Changes" });
    // Previous size's project is saved; nothing to confirm.
    await expect(prompt).toBeHidden();
    await expect(page.locator("[data-project-source]")).toContainText(
      path.basename(source),
      { timeout: 60_000 },
    );
    await expect
      .poll(() => documentNodeCount(page), { timeout: 60_000 })
      .toBe(size.elements + 1);
    const openMs = Date.now() - openStart;

    const saveStart = Date.now();
    await page.keyboard.press("Control+Shift+s");
    await expect(page.locator("[data-project-source]")).toContainText(
      path.basename(copy),
      { timeout: 60_000 },
    );
    const saveMs = Date.now() - saveStart;
    const megabytes = (Buffer.byteLength(text) / 1024 / 1024).toFixed(1);
    results.push(
      `${size.label} (${megabytes} MB): open → rendered ${openMs} ms, Save As → written ${saveMs} ms`,
    );
  }
  console.log(`[desktop file perf]\n  ${results.join("\n  ")}`);
});
