import { expect, test, type Page } from "@playwright/test";
import { spawn } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  documentNodeCount,
  dragInsertContainer,
  makeTempDir,
  removeDir,
  spawnEnv,
  waitForExit,
} from "../desktop/support/layoutryApp";
import {
  answerFileDialog,
  answerReplaceConfirmation,
} from "./support/fileDialogs";
import {
  extractedExe,
  launchPackaged,
  type PackagedLayoutry,
} from "./support/packagedApp";

/**
 * PROJECT-1.3 in the real packaged Layoutry.exe, with the genuine Windows
 * Open/Save dialogs (driven through UI Automation, not mocked), real disk
 * writes, command-line opening and second-instance forwarding.
 */

let layoutry: PackagedLayoutry | undefined;
let folder: string;

test.beforeEach(async () => {
  folder = await makeTempDir("layoutry-packaged-files-");
});

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
  await removeDir(folder);
});

function status(page: Page) {
  return page.locator("[data-project-status]");
}

async function projectOnDisk(filePath: string) {
  const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
  if (typeof parsed !== "object" || parsed === null)
    throw new Error("not JSON object");
  const project: unknown = Reflect.get(parsed, "project");
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
  };
}

function projectText(name: string, heading: string) {
  return JSON.stringify({
    format: "layoutry-project",
    formatVersion: 1,
    project: {
      id: "packaged-file-1",
      name,
      createdAt: "2026-10-27T08:00:00.000Z",
      updatedAt: "2026-10-27T08:00:00.000Z",
    },
    document: {
      id: "page-root",
      tag: "page",
      children: [{ id: "heading-p", tag: "h1", text: heading }],
    },
  });
}

test("Save and Open through the real Windows dialogs, including Windows' own replace confirmation", async () => {
  const target = path.join(folder, "Packaged Website.layoutry");
  // Safety net: opening a file from the test folder makes it the dialogs'
  // default folder, so nothing can land in the real Documents folder.
  const seed = path.join(folder, "Seed.layoutry");
  await writeFile(seed, projectText("Seed", "Seed project"));
  layoutry = await launchPackaged(extractedExe(), { args: [seed] });
  const { page, pid } = layoutry;
  await expect(page.locator("[data-document-surface] h1")).toHaveText(
    "Seed project",
  );
  await page.keyboard.press("Control+n");
  await expect(page.locator("[data-document-surface] h1")).toHaveCount(0);
  const nodes = (await documentNodeCount(page)) + 1;
  await dragInsertContainer(page);

  // Cancel first: nothing is written, the work stays unsaved.
  await page.keyboard.press("Control+s");
  expect(answerFileDialog(pid, null)).toMatchObject({
    found: true,
    title: "Save Project",
  });
  await expect(status(page)).toHaveText("Unsaved changes");
  expect(await readdir(folder)).toEqual(["Seed.layoutry"]);

  await page.keyboard.press("Control+s");
  expect(answerFileDialog(pid, target).found).toBe(true);
  await expect(status(page)).toHaveText("Saved");
  await expect(page.locator("[data-project-source]")).toHaveText(
    /Packaged Website\.layoutry/,
  );
  const saved = await projectOnDisk(target);
  expect(saved).toMatchObject({
    format: "layoutry-project",
    name: "Packaged Website",
  });
  expect((await readdir(folder)).sort()).toEqual([
    "Packaged Website.layoutry",
    "Seed.layoutry",
  ]);

  // Save As onto the same file: Windows itself asks before replacing it.
  await page.keyboard.press("Control+Shift+s");
  expect(answerFileDialog(pid, target).found).toBe(true);
  const confirmation = answerReplaceConfirmation(pid, true);
  expect(confirmation.found).toBe(true);
  expect(confirmation.text).toContain("Packaged Website.layoutry");
  await expect(status(page)).toHaveText("Saved");
  expect((await projectOnDisk(target)).id).not.toBe(saved.id);
  expect((await readdir(folder)).sort()).toEqual([
    "Packaged Website.layoutry",
    "Seed.layoutry",
  ]);

  // Start over, then open the file through the real Open dialog.
  await page.keyboard.press("Control+n");
  await expect(page.locator("[data-document-surface] h1")).toHaveCount(0);
  await page.keyboard.press("Control+o");
  expect(answerFileDialog(pid, target)).toMatchObject({
    found: true,
    title: "Open Project",
  });
  await expect(
    page.getByRole("button", {
      name: "Project: Packaged Website. Rename project",
    }),
  ).toBeVisible();
  await expect.poll(() => documentNodeCount(page)).toBe(nodes);
});

test("Layoutry.exe opens a .layoutry file named on its command line", async () => {
  const target = path.join(folder, "Double Clicked.layoutry");
  await writeFile(
    target,
    projectText("Double Clicked", "Opened like a double-click"),
  );
  layoutry = await launchPackaged(extractedExe(), { args: [target] });
  await expect(layoutry.page.locator("[data-document-surface] h1")).toHaveText(
    "Opened like a double-click",
  );
  await expect(layoutry.page.locator("[data-project-source]")).toHaveText(
    /Double Clicked\.layoutry/,
  );
});

test("a second Layoutry.exe launch hands its file to the running editor", async () => {
  const userDataDir = await makeTempDir("layoutry-packaged-forward-");
  const target = path.join(folder, "Forwarded.layoutry");
  await writeFile(
    target,
    projectText("Forwarded", "Forwarded from a second launch"),
  );
  try {
    layoutry = await launchPackaged(extractedExe(), { userDataDir });
    const second = spawn(
      extractedExe(),
      [`--user-data-dir=${userDataDir}`, target],
      {
        cwd: os.tmpdir(),
        env: spawnEnv(),
        stdio: "ignore",
      },
    );
    expect(await waitForExit(second, 20_000)).toBe(0);
    await expect(
      layoutry.page.locator("[data-document-surface] h1"),
    ).toHaveText("Forwarded from a second launch");
  } finally {
    await layoutry?.dispose();
    layoutry = undefined;
    await removeDir(userDataDir);
  }
});

test("the packaged bridge exposes only the fixed API and refuses forged access", async () => {
  layoutry = await launchPackaged(extractedExe());
  const probe = await layoutry.page.evaluate(async () => {
    const bridge: unknown = Reflect.get(window, "layoutryDesktop");
    if (typeof bridge !== "object" || bridge === null) return null;
    const write: unknown = Reflect.get(bridge, "writeProjectFile");
    if (typeof write !== "function") return null;
    const forged: unknown = await write(
      "0123456789abcdef0123456789abcdef",
      '{"format":"layoutry-project","formatVersion":1}',
      true,
    );
    const notAProject = await Promise.resolve()
      .then(() => write("0123456789abcdef0123456789abcdef", "not json", true))
      .then(
        () => "accepted",
        () => "rejected",
      );
    return {
      keys: Object.keys(bridge).length,
      frozen: Object.isFrozen(bridge),
      forged,
      notAProject,
      nodeGlobals: ["require", "process", "Buffer"].map(
        (name) => typeof Reflect.get(window, name),
      ),
    };
  });
  // 9 file/window functions + apiVersion (PROJECT-1.3) + 5 recovery
  // functions (PROJECT-1.4) + 2 code export functions (EXPORT-1.4).
  expect(probe).toMatchObject({
    keys: 17,
    frozen: true,
    forged: { status: "error", error: { code: "invalid-token" } },
    notAProject: "rejected",
    nodeGlobals: ["undefined", "undefined", "undefined"],
  });
});
