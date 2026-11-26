import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { dragInsertContainer, launchLayoutry, makeTempDir, removeDir, scriptFileDialogs, type LaunchedLayoutry } from "./support/layoutryApp";

/**
 * BC-09.2 in the real Electron window: insert the new Pagination, check its
 * semantics in Design and Preview, save it to a real .layoutry file
 * (format 3, marker and accessibility fields stored), then relaunch with
 * that file and find everything as it was.
 */

interface SavedNode {
  id: string;
  tag: string;
  text?: string;
  component?: string;
  ariaLabel?: string;
  ariaCurrent?: string;
  disabled?: boolean;
  href?: string;
  children?: SavedNode[];
}

let layoutry: LaunchedLayoutry | undefined;
let folder: string;

test.beforeEach(async () => {
  folder = await makeTempDir("layoutry-pagination-");
});

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
  await removeDir(folder);
});

const node = (page: Page, id: string) => page.locator(`[data-document-surface] [data-node-id="${id}"]`).first();

function controls(nav: Locator) {
  return nav.evaluate((element) =>
    Array.from(element.children).map((child) => [child.tagName.toLowerCase(), (child.textContent ?? "").trim(), child.getAttribute("href"), child.getAttribute("aria-current"), child.getAttribute("aria-disabled")]),
  );
}

const EXPECTED = [
  ["a", "Previous", null, null, "true"],
  ["a", "1", null, "page", null],
  ["a", "2", "#", null, null],
  ["a", "3", "#", null, null],
  ["a", "Next", "#", null, null],
];

function findById(root: SavedNode, id: string): SavedNode | undefined {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return undefined;
}

test("insert the new Pagination, save it to a real format 3 file and reopen it unchanged", async () => {
  const target = path.join(folder, "Pagination.layoutry");
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  await scriptFileDialogs(app, { save: [target] });

  await page.getByRole("button", { name: "Components" }).click();
  await page.getByRole("menuitem", { name: /^Pagination/ }).click();
  const navId = await page.locator('[data-document-surface] [data-node-type="nav"]').last().getAttribute("data-node-id");
  if (!navId) throw new Error("Pagination not inserted");
  await expect(node(page, navId)).toHaveAttribute("aria-label", "Pagination");
  expect(await controls(node(page, navId))).toEqual(EXPECTED);

  const startUrl = page.url();
  await page.getByRole("button", { name: "Enter Preview" }).click();
  await expect(page.getByRole("button", { name: "Exit Preview" })).toBeVisible();
  expect(await controls(node(page, navId))).toEqual(EXPECTED);
  // force: Playwright won't click an aria-disabled element; a user can.
  for (const index of [0, 1, 4]) await node(page, navId).locator(":scope > a").nth(index).click({ force: true });
  expect(page.url()).toBe(startUrl);
  await page.getByRole("button", { name: "Exit Preview" }).click();

  await page.keyboard.press("Control+s");
  await expect(page.locator("[data-project-status]")).toHaveAttribute("data-project-status", "saved");
  const saved = JSON.parse(await readFile(target, "utf8")) as { formatVersion: number; document: SavedNode };
  expect(saved.formatVersion).toBe(4);
  const savedNav = findById(saved.document, navId);
  expect(savedNav?.component).toBe("pagination");
  expect(savedNav?.ariaLabel).toBe("Pagination");
  expect(savedNav?.children?.map((child) => [child.text, child.ariaCurrent ?? null, child.disabled ?? null, child.href])).toEqual([
    ["Previous", null, true, "#"],
    ["1", "page", null, "#"],
    ["2", null, null, "#"],
    ["3", null, null, "#"],
    ["Next", null, null, "#"],
  ]);

  await layoutry.dispose();
  layoutry = await launchLayoutry({ extraArgs: [target] });
  await expect(layoutry.page.locator("[data-project-source]")).toHaveText(/Pagination\.layoutry/);
  await expect(node(layoutry.page, navId)).toHaveAttribute("aria-label", "Pagination");
  expect(await controls(node(layoutry.page, navId))).toEqual(EXPECTED);
  // A format 3 file saves straight back after an edit: no upgrade prompt.
  await dragInsertContainer(layoutry.page);
  await expect(layoutry.page.locator("[data-project-status]")).toHaveText("Unsaved changes");
  await layoutry.page.keyboard.press("Control+s");
  await expect(layoutry.page.locator("[data-project-status]")).toHaveText("Saved");
  await expect(layoutry.page.getByRole("dialog", { name: "Upgrade Project File?" })).toBeHidden();
  expect(JSON.parse(await readFile(target, "utf8")).formatVersion).toBe(4);
});
