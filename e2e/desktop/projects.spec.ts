import { expect, test, type Page } from "@playwright/test";
import {
  dragInsertContainer,
  fileDialogCalls,
  launchLayoutry,
  makeTempDir,
  removeDir,
  scriptFileDialogs,
  type LaunchedLayoutry,
} from "./support/layoutryApp";

/**
 * The PROJECT-1.2 project library inside the desktop app, after
 * PROJECT-1.3 made native files the default: projects people saved in the
 * library before 1.3 stay available, keep saving to the library, and are
 * never migrated or deleted silently.
 */

let layoutry: LaunchedLayoutry | undefined;
let profile: string | undefined;

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
  if (profile) await removeDir(profile);
  profile = undefined;
});

const LIBRARY_PROJECT = {
  format: "layoutry-project",
  formatVersion: 1,
  project: {
    id: "library-project-1",
    name: "Saved before files",
    createdAt: "2026-10-26T09:00:00.000Z",
    updatedAt: "2026-10-26T09:00:00.000Z",
  },
  document: {
    id: "page-root",
    tag: "page",
    children: [
      { id: "heading-lib", tag: "h1", text: "From the desktop library" },
    ],
  },
};

/** Writes a library record the way PROJECT-1.2 did, straight into IndexedDB. */
async function seedLibrary(page: Page) {
  await page.evaluate(
    (project) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("layoutry-projects", 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore("summaries", { keyPath: "id" });
          request.result.createObjectStore("documents", { keyPath: "id" });
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const tx = database.transaction(
            ["summaries", "documents"],
            "readwrite",
          );
          tx.objectStore("summaries").put(project.project);
          tx.objectStore("documents").put({
            id: project.project.id,
            text: JSON.stringify(project),
          });
          tx.oncomplete = () => {
            database.close();
            resolve();
          };
          tx.onabort = () => reject(tx.error);
        };
      }),
    LIBRARY_PROJECT,
  );
}

function storedUpdatedAt(page: Page) {
  return page.evaluate(
    (id) =>
      new Promise<string>((resolve, reject) => {
        const request = indexedDB.open("layoutry-projects");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const get = request.result
            .transaction("summaries")
            .objectStore("summaries")
            .get(id);
          get.onsuccess = () => {
            request.result.close();
            resolve(String(get.result?.updatedAt));
          };
        };
      }),
    LIBRARY_PROJECT.project.id,
  );
}

test("projects in the desktop library stay available and keep saving there", async () => {
  profile = await makeTempDir("layoutry-desktop-library-");
  layoutry = await launchLayoutry({ userDataDir: profile });
  await seedLibrary(layoutry.page);
  await layoutry.dispose();

  // After a restart, as after upgrading Layoutry.
  layoutry = await launchLayoutry({ userDataDir: profile });
  const { app, page } = layoutry;
  await scriptFileDialogs(app, {});

  await page.getByRole("menuitem", { name: "File" }).click();
  await page
    .getByRole("menuitem", { name: "Open from Desktop Library…" })
    .click();
  const library = page.getByRole("dialog", { name: "Desktop Library" });
  await library
    .getByRole("button", { name: "Open Saved before files" })
    .click();

  await expect(page.locator("[data-document-surface] h1")).toHaveText(
    "From the desktop library",
  );
  await expect(page.locator("[data-project-source]")).toHaveText(
    /Desktop library/,
  );

  await dragInsertContainer(page);
  await page.keyboard.press("Control+s");
  await expect(page.locator("[data-project-status]")).toHaveAttribute(
    "data-project-status",
    "saved",
  );
  // Saved back into the library — no file dialog, nothing migrated.
  expect(await fileDialogCalls(app)).toEqual([]);
  expect(await storedUpdatedAt(page)).not.toBe(
    LIBRARY_PROJECT.project.updatedAt,
  );
});

test("Ctrl+N starts a new project in the desktop app after confirming", async () => {
  layoutry = await launchLayoutry();
  const { page } = layoutry;
  await dragInsertContainer(page);

  await page.keyboard.press("Control+n");
  await page
    .getByRole("dialog", { name: "Unsaved Changes" })
    .getByRole("button", { name: "Don't Save" })
    .click();

  await expect(page.locator("[data-project-status]")).toHaveText("Not saved");
  // A new project is an empty page: the starter content is gone.
  await expect(page.locator("[data-document-surface] h1")).toHaveCount(0);
});
