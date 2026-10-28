import { expect, test, type Page } from "@playwright/test";
import { mkdir, readdir, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  fileDialogCalls,
  launchLayoutry,
  makeTempDir,
  nonAppRequests,
  removeDir,
  scriptFileDialogs,
  type LaunchedLayoutry,
} from "./support/layoutryApp";

/**
 * EXPORT-1.4 — native code export in the real Electron app. The native
 * Save/folder dialogs are scripted in the main process (deterministic);
 * the preload, IPC validation, destination tokens and the staged multi-file
 * write on a real disk are the real code path. The packaged suite drives
 * the genuine Windows dialogs.
 */

let layoutry: LaunchedLayoutry | undefined;
let folder: string;

test.beforeEach(async () => {
  folder = await makeTempDir("layoutry-export-e2e-");
});

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
  await removeDir(folder);
});

function exportDialog(page: Page) {
  return page.getByRole("dialog", { name: "Export Code" });
}

async function openExport(page: Page) {
  await page.getByRole("button", { name: "Export Code" }).click();
  await expect(exportDialog(page).getByTestId("export-code")).toBeVisible();
}

/** Every generated file as the preview shows it, by name. */
async function previewFiles(page: Page): Promise<Map<string, string>> {
  const dialog = exportDialog(page);
  const files = new Map<string, string>();
  for (const tab of await dialog.getByRole("tab").all()) {
    await tab.click();
    const name = ((await tab.textContent()) ?? "").match(/^[a-z]+\.(html|css|js)/)?.[0] ?? "";
    files.set(name, (await dialog.getByTestId("export-code").textContent()) ?? "");
  }
  return files;
}

test("saves a single HTML file through the Save dialog: exactly the previewed code, project left unsaved", async () => {
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  const target = path.join(folder, "Landing.html");
  await scriptFileDialogs(app, { save: [target] });
  const statusBefore = await page.locator("[data-project-status]").getAttribute("data-project-status");

  await page.getByRole("menuitem", { name: "File" }).click();
  await page.getByRole("menuitem", { name: "Export Code…" }).click();
  const dialog = exportDialog(page);
  await expect(dialog.getByTestId("export-code")).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Download/ })).toHaveCount(0);
  const preview = await previewFiles(page);
  await dialog.getByRole("button", { name: "Save HTML File…" }).click();
  await expect(dialog.getByTestId("export-transfer-status")).toHaveText(`Saved Landing.html to “${path.basename(folder)}”.`);

  expect(await readdir(folder)).toEqual(["Landing.html"]);
  expect(await readFile(target, "utf8")).toBe(preview.get("index.html"));
  const calls = await fileDialogCalls(app);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ kind: "save", filters: [{ name: "HTML Page", extensions: ["html", "htm"] }] });
  expect(String(calls[0].defaultPath).endsWith("index.html")).toBe(true);
  // Exporting is not saving: the project's own state is unchanged.
  await expect(page.locator("[data-project-status]")).toHaveAttribute("data-project-status", statusBefore ?? "");
  expect((await readdir(folder)).some((name) => name.endsWith(".layoutry"))).toBe(false);
  // Offline: nothing went to the network (the app's own bundle loads from disk).
  expect((await nonAppRequests(app)).filter((url) => /^(https?|wss?|ftp):/i.test(url))).toEqual([]);
});

test("saves separate files into a chosen folder, asks before replacing existing ones, and never touches other files", async () => {
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  await writeFile(path.join(folder, "index.html"), "my old page");
  await writeFile(path.join(folder, "notes.txt"), "keep me");
  await scriptFileDialogs(app, { open: [folder, folder] });

  await openExport(page);
  const dialog = exportDialog(page);
  await dialog.getByLabel("Separate files").check();
  await expect(dialog.getByRole("tab", { name: /^styles\.css/ })).toBeVisible();
  const preview = await previewFiles(page);

  await dialog.getByRole("button", { name: "Save to Folder…" }).click();
  const prompt = dialog.getByRole("alertdialog");
  await expect(prompt).toContainText(`index.html already exists in “${path.basename(folder)}”. Replace it?`);
  expect(await readFile(path.join(folder, "index.html"), "utf8")).toBe("my old page");
  await prompt.getByRole("button", { name: "Keep existing files" }).click();
  await expect(dialog.getByTestId("export-transfer-status")).toHaveText("Nothing was saved. The existing files were left unchanged.");
  expect((await readdir(folder)).sort()).toEqual(["index.html", "notes.txt"]);

  await dialog.getByRole("button", { name: "Save to Folder…" }).click();
  await dialog.getByRole("alertdialog").getByRole("button", { name: "Replace" }).click();
  await expect(dialog.getByTestId("export-transfer-status")).toContainText(`to “${path.basename(folder)}”.`);
  const written = (await readdir(folder)).sort();
  expect(written).toEqual([...preview.keys(), "notes.txt"].sort());
  for (const [name, content] of preview) expect(await readFile(path.join(folder, name), "utf8")).toBe(content);
  expect(await readFile(path.join(folder, "notes.txt"), "utf8")).toBe("keep me");
  const calls = await fileDialogCalls(app);
  expect(calls.map((call) => call.kind)).toEqual(["open", "open"]);
});

test("a cancelled dialog saves nothing; a junction destination is refused", async () => {
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  const real = path.join(folder, "real");
  const link = path.join(folder, "link");
  await mkdir(real);
  await symlink(real, link, "junction");
  await scriptFileDialogs(app, { open: [null, link] });

  await openExport(page);
  const dialog = exportDialog(page);
  await dialog.getByLabel("Separate files").check();
  await expect(dialog.getByRole("tab", { name: /^styles\.css/ })).toBeVisible();
  await dialog.getByRole("button", { name: "Save to Folder…" }).click();
  await expect(dialog.getByTestId("export-transfer-status")).toHaveText("Save cancelled. Nothing was saved.");
  await dialog.getByRole("button", { name: "Save to Folder…" }).click();
  await expect(dialog.getByRole("alert").filter({ hasText: "shortcut link" })).toContainText("symbolic link or junction");
  expect(await readdir(real)).toEqual([]);
  expect((await readdir(folder)).sort()).toEqual(["link", "real"]);
});

test("the bridge refuses forged tokens, other names, traversal and project tokens on the export channel", async () => {
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  const projectTarget = path.join(folder, "Site.layoutry");
  await scriptFileDialogs(app, { open: [folder], save: [projectTarget] });

  const outcome = await page.evaluate(async () => {
    const bridge = Reflect.get(window, "layoutryDesktop") as Record<string, (...args: unknown[]) => Promise<unknown>>;
    const settle = (call: () => Promise<unknown>) =>
      call().then(
        (value) => ({ resolved: value }),
        (error: unknown) => ({ rejected: String(error) }),
      );
    const html = [{ path: "index.html", content: "<p>x</p>" }, { path: "styles.css", content: "p{}" }];
    const forged = await settle(() => bridge.writeExportFiles("0".repeat(32), html, true));
    const chosen = (await bridge.chooseExportDestination("separate", "Site")) as { destination: { token: string } };
    const token = chosen.destination.token;
    const traversal = await settle(() => bridge.writeExportFiles(token, [{ path: "..\\evil.html", content: "x" }, html[1]], true));
    const absolute = await settle(() => bridge.writeExportFiles(token, [{ path: "C:\\Windows\\evil.html", content: "x" }, html[1]], true));
    const otherName = await settle(() => bridge.writeExportFiles(token, [{ path: "evil.exe", content: "x" }, html[1]], true));
    const project = (await bridge.chooseSaveLocation("Site")) as { target: { token: string } };
    const projectOnExport = await settle(() => bridge.writeExportFiles(project.target.token, html, true));
    const exportOnProject = await settle(() => bridge.writeProjectFile(token, '{"format":"layoutry-project","formatVersion":1}', true));
    return { forged, traversal, absolute, otherName, projectOnExport, exportOnProject };
  });
  expect(outcome.forged).toMatchObject({ resolved: { status: "error", error: { code: "invalid-token" } } });
  for (const attempt of [outcome.traversal, outcome.absolute, outcome.otherName]) expect(attempt).toMatchObject({ rejected: expect.stringContaining("unexpected export file name") });
  expect(outcome.projectOnExport).toMatchObject({ resolved: { status: "error", error: { code: "invalid-token" } } });
  expect(outcome.exportOnProject).toMatchObject({ resolved: { status: "error", error: { code: "invalid-token" } } });
  expect(await readdir(folder)).toEqual([]);
  expect(await readdir(path.dirname(folder))).not.toContain("evil.html");
});
