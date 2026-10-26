import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";

/**
 * PROJECT-1.2 — the browser project library on Chromium's real IndexedDB.
 * Every test gets a fresh browser context, so a fresh, empty library.
 */

const STARTER_HEADLINE = "Build layouts visually. Own the code.";

function canvas(page: Page) {
  return page.getByRole("main", { name: "Workspace" });
}

function projectStatus(page: Page) {
  return page.locator("[data-project-status]");
}

async function editHeadline(page: Page, from: string, to: string) {
  await canvas(page).getByRole("heading", { name: from }).dblclick();
  await page.keyboard.press("Control+a");
  await page.keyboard.type(to);
  await page.keyboard.press("Enter");
  await expect(canvas(page).getByRole("heading", { name: to })).toBeVisible();
}

async function saveNewProject(page: Page, name: string) {
  await page.keyboard.press("Control+s");
  const dialog = page.getByRole("dialog", { name: "Save Project" });
  await dialog.getByRole("textbox", { name: "Project name" }).fill(name);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(projectStatus(page)).toHaveAttribute(
    "data-project-status",
    "saved",
  );
}

async function openFileMenuItem(page: Page, name: string) {
  await page.getByRole("menuitem", { name: "File" }).click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}

/** Reads the library straight from IndexedDB, bypassing the app. */
function storedSummaries(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ id: string; name: string }[]>((resolve, reject) => {
        const request = indexedDB.open("layoutry-projects");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const all = database
            .transaction("summaries")
            .objectStore("summaries")
            .getAll();
          all.onsuccess = () => {
            database.close();
            resolve(all.result);
          };
          all.onerror = () => reject(all.error);
        };
      }),
  );
}

test("Save writes to IndexedDB; the project survives a reload and reopens exactly", async ({
  page,
}) => {
  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.type());
    void dialog.dismiss();
  });
  await gotoApp(page);
  await expect(projectStatus(page)).toHaveText("Not saved");

  await editHeadline(page, STARTER_HEADLINE, "Saved headline");
  await expect(projectStatus(page)).toHaveText("Unsaved changes");
  await saveNewProject(page, "E2E Project");
  await expect(
    page.getByRole("status", { name: "Project status" }),
  ).toContainText("Saved “E2E Project”");
  const nodeCount = await canvas(page).locator("[data-node-type]").count();

  const summaries = await storedSummaries(page);
  expect(summaries.map((summary) => summary.name)).toEqual(["E2E Project"]);

  // Saved, so reloading must not prompt.
  await page.reload();
  await gotoApp(page);
  expect(dialogs).toEqual([]);
  await expect(
    page.getByRole("button", {
      name: "Project: Untitled Project. Rename project",
    }),
  ).toBeVisible();
  await expect(
    canvas(page).getByRole("heading", { name: STARTER_HEADLINE }),
  ).toBeVisible();

  await page.keyboard.press("Control+o");
  const library = page.getByRole("dialog", { name: "Open Project" });
  await expect(
    library.getByText("stored in this browser on this device", {
      exact: false,
    }),
  ).toBeVisible();
  await library.getByRole("button", { name: "Open E2E Project" }).click();

  await expect(library).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Project: E2E Project. Rename project" }),
  ).toBeVisible();
  await expect(
    canvas(page).getByRole("heading", { name: "Saved headline" }),
  ).toBeVisible();
  await expect(canvas(page).locator("[data-node-type]")).toHaveCount(nodeCount);
  await expect(projectStatus(page)).toHaveText("Saved");
  // A freshly opened project has no undo history.
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
});

test("closing a tab with unsaved changes asks first; a saved project closes quietly", async ({
  page,
}) => {
  await gotoApp(page);
  await editHeadline(page, STARTER_HEADLINE, "Unsaved work");

  const prompt = page.waitForEvent("dialog");
  await page.close({ runBeforeUnload: true });
  const dialog = await prompt;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  expect(page.isClosed()).toBe(false);

  await saveNewProject(page, "Now saved");
  let prompted = false;
  page.on("dialog", () => {
    prompted = true;
  });
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => page.isClosed()).toBe(true);
  expect(prompted).toBe(false);
});

test("Download and Import round-trip a .layoutry file; a duplicate id imports as a copy", async ({
  page,
}) => {
  await gotoApp(page);
  await editHeadline(page, STARTER_HEADLINE, "Portable headline");
  await saveNewProject(page, "Portable: v1");

  const downloadPromise = page.waitForEvent("download");
  await openFileMenuItem(page, "Download Project");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Portable- v1.layoutry");
  const filePath = await download.path();
  // Downloading neither saves nor dirties the project.
  await expect(projectStatus(page)).toHaveText("Saved");

  await openFileMenuItem(page, "New Project");
  await expect(canvas(page).getByRole("heading")).toHaveCount(0);

  await page.getByTestId("project-import-input").setInputFiles(filePath);
  const collision = page.getByRole("dialog", {
    name: "Project Already in Library",
  });
  await expect(collision).toContainText("“Portable: v1”");
  await collision.getByRole("button", { name: "Import as Copy" }).click();

  await expect(
    canvas(page).getByRole("heading", { name: "Portable headline" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Project: Portable: v1. Rename project" }),
  ).toBeVisible();
  await expect(projectStatus(page)).toHaveText("Saved");
  const summaries = await storedSummaries(page);
  expect(summaries).toHaveLength(2);
  expect(new Set(summaries.map((summary) => summary.id)).size).toBe(2);
});

test("an invalid import is rejected with a clear message and changes nothing", async ({
  page,
}) => {
  await gotoApp(page);
  await editHeadline(page, STARTER_HEADLINE, "Keep this");

  await page.getByTestId("project-import-input").setInputFiles({
    name: "future.layoutry",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ format: "layoutry-project", formatVersion: 99 }),
    ),
  });

  const error = page.getByRole("dialog", {
    name: "This file can't be imported",
  });
  await expect(error).toContainText("newer version of Layoutry");
  await error.getByRole("button", { name: "OK" }).click();
  await expect(
    canvas(page).getByRole("heading", { name: "Keep this" }),
  ).toBeVisible();
  await expect(projectStatus(page)).toHaveText("Unsaved changes");
});

test("a corrupted saved project can't be opened and the current document stays intact", async ({
  page,
}) => {
  await gotoApp(page);
  await saveNewProject(page, "Will be damaged");
  const [{ id }] = await storedSummaries(page);
  await page.evaluate(
    (projectId) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("layoutry-projects");
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("documents", "readwrite");
          transaction
            .objectStore("documents")
            .put({ id: projectId, text: "{ damaged" });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onabort = () => reject(transaction.error);
        };
      }),
    id,
  );
  await editHeadline(page, STARTER_HEADLINE, "Current work");

  await page.keyboard.press("Control+o");
  await page
    .getByRole("dialog", { name: "Open Project" })
    .getByRole("button", { name: "Open Will be damaged" })
    .click();
  // Even after choosing not to save, a failed open replaces nothing.
  await page
    .getByRole("dialog", { name: "Unsaved Changes" })
    .getByRole("button", { name: "Don't Save" })
    .click();

  const error = page.getByRole("dialog", {
    name: "This project can't be opened",
  });
  await expect(error).toContainText("damaged");
  await error.getByRole("button", { name: "OK" }).click();
  await expect(
    canvas(page).getByRole("heading", { name: "Current work" }),
  ).toBeVisible();
  await expect(projectStatus(page)).toHaveText("Unsaved changes");
});

test("Ctrl+O is ignored while a dialog is open, and editor shortcuts keep working", async ({
  page,
}) => {
  await gotoApp(page);
  await editHeadline(page, STARTER_HEADLINE, "Undo me");

  await page.keyboard.press("Control+z");
  await expect(
    canvas(page).getByRole("heading", { name: STARTER_HEADLINE }),
  ).toBeVisible();
  await page.keyboard.press("Control+Shift+z");
  await expect(
    canvas(page).getByRole("heading", { name: "Undo me" }),
  ).toBeVisible();

  await page.keyboard.press("Control+Shift+s");
  const saveAs = page.getByRole("dialog", { name: "Save As" });
  await expect(
    saveAs.getByRole("textbox", { name: "Project name" }),
  ).toBeFocused();
  await page.keyboard.press("Control+o");
  await expect(page.getByRole("dialog", { name: "Open Project" })).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(saveAs).toBeHidden();
});
