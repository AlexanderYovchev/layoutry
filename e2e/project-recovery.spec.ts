import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";
import {
  killBrowser,
  launchWithProfile,
  makeProfileDir,
  removeProfileDir,
} from "./support/persistentBrowser";

/**
 * PROJECT-1.4 — recovery snapshots in real Chromium: real IndexedDB and
 * real Web Locks. The main flow survives a real browser crash: every
 * process of a Chromium with an on-disk profile is killed outright, then
 * a new browser starts on the same profile. (Headless Chromium can't lose
 * one tab's renderer without taking the browser down — CDP Page.crash
 * disconnects it — so tab-level endings use an accidental close: the tab
 * goes away without its unload prompt.) Other tests get a fresh context.
 */

const STARTER_HEADLINE = "Build layouts visually. Own the code.";

function canvas(page: Page) {
  return page.getByRole("main", { name: "Workspace" });
}

function projectStatus(page: Page) {
  return page.locator("[data-project-status]");
}

function recoveryStatus(page: Page) {
  return page.locator("[data-recovery-status]");
}

async function editHeadline(page: Page, from: string, to: string) {
  await canvas(page).getByRole("heading", { name: from }).dblclick();
  await page.keyboard.press("Control+a");
  await page.keyboard.type(to);
  await page.keyboard.press("Enter");
  await expect(canvas(page).getByRole("heading", { name: to })).toBeVisible();
}

/** The recovery snapshots in IndexedDB, read directly (not through the app). */
function recoveryRecords(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ recordId: string; projectName: string }[]>(
        (resolve, reject) => {
          const request = indexedDB.open("layoutry-recovery");
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains("summaries")) {
              database.close();
              resolve([]);
              return;
            }
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
        },
      ),
  );
}

/** The tab goes away without asking: closed by accident, or killed by the OS. */
async function closeAbruptly(page: Page) {
  await page.close({ runBeforeUnload: false });
}

async function openEditor(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await gotoApp(page);
  return page;
}

function recoveryDialog(page: Page) {
  return page.getByRole("dialog", { name: "Recover Unsaved Work" });
}

test("after the browser is killed outright, the work is offered, restored exactly as unsaved, and cleaned up by Save", async ({
  baseURL,
}) => {
  test.setTimeout(90_000);
  const profile = await makeProfileDir();
  let browser: BrowserContext | null = await launchWithProfile(
    profile,
    baseURL ?? "http://localhost:3000",
  );
  try {
    const page = await openEditor(browser);
    await expect(recoveryDialog(page)).toBeHidden();
    await editHeadline(page, STARTER_HEADLINE, "Work before the crash");
    await expect(projectStatus(page)).toHaveText("Unsaved changes");
    await expect(recoveryStatus(page)).toHaveAttribute(
      "data-recovery-status",
      "protected",
    );
    // A recovery copy is not a save.
    await expect(projectStatus(page)).toHaveText("Unsaved changes");
    expect(await recoveryRecords(page)).toHaveLength(1);

    // A real crash: every process of this browser dies at once.
    killBrowser(profile);
    await browser.close().catch(() => undefined);
    browser = await launchWithProfile(
      profile,
      baseURL ?? "http://localhost:3000",
    );

    const reopened = await openEditor(browser);
    const hydratedAt = Date.now();
    const dialog = recoveryDialog(reopened);
    await expect(dialog).toBeVisible();
    console.log(
      `[recovery perf] browser: recovery offered ${Date.now() - hydratedAt} ms after the editor hydrated (IndexedDB open, scan, read, hash and validate)`,
    );
    await expect(
      dialog.getByRole("listitem", { name: "Untitled Project" }),
    ).toContainText("Never saved");
    await dialog.getByRole("button", { name: "Restore" }).click();
    await expect(dialog).toBeHidden();
    await expect(
      canvas(reopened).getByRole("heading", { name: "Work before the crash" }),
    ).toBeVisible();
    await expect(projectStatus(reopened)).toHaveText("Unsaved changes");
    await expect(recoveryStatus(reopened)).toHaveAttribute(
      "data-recovery-status",
      "protected",
    );

    await reopened.keyboard.press("Control+s");
    const save = reopened.getByRole("dialog", { name: "Save Project" });
    await save.getByRole("textbox", { name: "Project name" }).fill("Recovered");
    await save.getByRole("button", { name: "Save" }).click();
    await expect(projectStatus(reopened)).toHaveText("Saved");
    await expect(recoveryStatus(reopened)).toHaveCount(0);
    await expect.poll(() => recoveryRecords(reopened)).toEqual([]);
  } finally {
    await browser?.close().catch(() => undefined);
    killBrowser(profile);
    await removeProfileDir(profile);
  }
});

test("a running tab's work is never offered to another tab; after it ends, only one tab gets the offer", async ({
  context,
}) => {
  const first = await openEditor(context);
  await editHeadline(first, STARTER_HEADLINE, "Tab one work");
  await expect(recoveryStatus(first)).toHaveAttribute(
    "data-recovery-status",
    "protected",
  );

  const second = await openEditor(context);
  // Give the startup scan time to run, then check it offered nothing.
  await expect(projectStatus(second)).toHaveText("Not saved");
  await second.waitForTimeout(1000);
  await expect(recoveryDialog(second)).toBeHidden();
  await second.close();

  await closeAbruptly(first);
  const [a, b] = await Promise.all([openEditor(context), openEditor(context)]);
  await expect
    .poll(
      async () =>
        ((await recoveryDialog(a).isVisible()) ? 1 : 0) +
        ((await recoveryDialog(b).isVisible()) ? 1 : 0),
      { timeout: 10_000 },
    )
    .toBe(1);
  await a.waitForTimeout(1000);
  expect(
    ((await recoveryDialog(a).isVisible()) ? 1 : 0) +
      ((await recoveryDialog(b).isVisible()) ? 1 : 0),
  ).toBe(1);
});

test("Keep for Later keeps the work; it can be recovered later from the File menu, or discarded after confirmation", async ({
  context,
}) => {
  const page = await openEditor(context);
  await editHeadline(page, STARTER_HEADLINE, "Kept for later");
  await expect(recoveryStatus(page)).toHaveAttribute(
    "data-recovery-status",
    "protected",
  );
  await closeAbruptly(page);

  const reopened = await openEditor(context);
  await recoveryDialog(reopened)
    .getByRole("button", { name: "Keep for Later" })
    .click();
  await expect(recoveryDialog(reopened)).toBeHidden();
  await expect(
    canvas(reopened).getByRole("heading", { name: STARTER_HEADLINE }),
  ).toBeVisible();
  expect(await recoveryRecords(reopened)).toHaveLength(1);

  await reopened.getByRole("menuitem", { name: "File" }).click();
  await reopened
    .getByRole("menuitem", { name: "Recover Unsaved Work…" })
    .click();
  const dialog = recoveryDialog(reopened);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Discard…" }).click();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  expect(await recoveryRecords(reopened)).toHaveLength(1);
  await dialog.getByRole("button", { name: "Discard…" }).click();
  await dialog.getByRole("button", { name: "Discard Permanently" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => recoveryRecords(reopened)).toEqual([]);
  await expect(
    canvas(reopened).getByRole("heading", { name: STARTER_HEADLINE }),
  ).toBeVisible();
});

test("a corrupted recovery record is reported, never restored, and an intact older version still is", async ({
  context,
}) => {
  const page = await openEditor(context);
  await editHeadline(page, STARTER_HEADLINE, "First version");
  await expect(recoveryStatus(page)).toHaveAttribute(
    "data-recovery-status",
    "protected",
  );
  await editHeadline(page, "First version", "Second version");
  await expect.poll(async () => (await recoveryRecords(page)).length).toBe(2);
  // Corrupt the newest snapshot's text in place.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("layoutry-recovery");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            ["summaries", "texts"],
            "readwrite",
          );
          const all = transaction.objectStore("summaries").getAll();
          all.onsuccess = () => {
            const newest = all.result.sort(
              (x: { generation: number }, y: { generation: number }) =>
                y.generation - x.generation,
            )[0];
            transaction
              .objectStore("texts")
              .put({ recordId: newest.recordId, text: "{ truncated" });
          };
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
        };
      }),
  );
  await closeAbruptly(page);

  const reopened = await openEditor(context);
  const dialog = recoveryDialog(reopened);
  await expect(dialog).toBeVisible();
  const versions = dialog.getByRole("combobox", { name: "Version" });
  await expect(versions.getByRole("option", { name: /damaged/ })).toHaveCount(
    1,
  );
  await dialog.getByRole("button", { name: "Restore" }).click();
  await expect(
    canvas(reopened).getByRole("heading", { name: "First version" }),
  ).toBeVisible();
  await expect(projectStatus(reopened)).toHaveText("Unsaved changes");
});

test("saving before the snapshot is due leaves no recovery copy behind", async ({
  context,
}) => {
  const page = await openEditor(context);
  await editHeadline(page, STARTER_HEADLINE, "Saved straight away");
  await page.keyboard.press("Control+s");
  const save = page.getByRole("dialog", { name: "Save Project" });
  await save.getByRole("textbox", { name: "Project name" }).fill("Quick");
  await save.getByRole("button", { name: "Save" }).click();
  await expect(projectStatus(page)).toHaveText("Saved");
  await page.waitForTimeout(3000);
  expect(await recoveryRecords(page)).toEqual([]);
  await expect(recoveryStatus(page)).toHaveCount(0);

  // And an abrupt end later offers nothing: the work was saved.
  await closeAbruptly(page);
  const reopened = await openEditor(context);
  await expect(projectStatus(reopened)).toHaveText("Not saved");
  await reopened.waitForTimeout(1000);
  await expect(recoveryDialog(reopened)).toBeHidden();
});
