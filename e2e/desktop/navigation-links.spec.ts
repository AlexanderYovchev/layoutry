import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import { launchLayoutry, makeTempDir, removeDir, REPO_ROOT, scriptFileDialogs, type LaunchedLayoutry } from "./support/layoutryApp";

/**
 * BC-06.2 in the real Electron window: Navbar with CTA managed through the
 * Navigation links section (Add, keyboard Move, Remove of a link an
 * interaction targets, Undo/Redo), Preview order, then Save to a real
 * .layoutry file (format 2, the CTA last, no dangling interaction) and a
 * relaunch that opens the file with the same order.
 */

interface SavedNode {
  id: string;
  tag: string;
  text?: string;
  children?: SavedNode[];
  interactions?: { targetId: string }[];
}

let layoutry: LaunchedLayoutry | undefined;
let folder: string;

test.beforeEach(async () => {
  folder = await makeTempDir("layoutry-navigation-links-");
});

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
  await removeDir(folder);
});

const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector panel" });
const section = (page: Page) =>
  inspector(page)
    .locator("div")
    .filter({ has: page.getByRole("heading", { name: "Navigation links", exact: true }) })
    .last();
const button = (page: Page, name: string) => section(page).getByRole("button", { name, exact: true });
const node = (page: Page, id: string) => page.locator(`[data-document-surface] [data-node-id="${id}"]`).first();

function canvasChildren(page: Page, navId: string): Promise<string[]> {
  return node(page, navId).evaluate((nav) =>
    Array.from(nav.children)
      .filter((child) => child.hasAttribute("data-node-id"))
      .map((child) => `${child.tagName.toLowerCase()}:${(child.textContent ?? "").trim()}`),
  );
}

function findById(root: SavedNode, id: string): SavedNode | undefined {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return undefined;
}

test("manage Navbar with CTA links, Preview, save to a real file and reopen it", async () => {
  const target = path.join(folder, "Navbar.layoutry");
  layoutry = await launchLayoutry();
  const { app, page } = layoutry;
  await scriptFileDialogs(app, { save: [target] });

  await page.getByRole("button", { name: "Components" }).click();
  await page.getByRole("menuitem", { name: /^Navbar with CTA/ }).click();
  const navId = await page.locator('[data-document-surface] [data-node-type="nav"]').last().getAttribute("data-node-id");
  if (!navId) throw new Error("navbar not inserted");
  await expect(section(page).getByText("3 links")).toBeVisible();

  // Home toggles Features; Features is then removed through the section.
  const featuresId = await node(page, navId).locator(":scope > a").nth(1).getAttribute("data-node-id");
  if (!featuresId) throw new Error("Features missing");
  await section(page).getByRole("button", { name: "Select Home" }).click();
  const interactionsHeader = inspector(page).getByRole("button", { name: "Interactions", exact: true });
  if ((await interactionsHeader.getAttribute("aria-expanded")) !== "true") await interactionsHeader.click();
  await inspector(page).getByRole("button", { name: "Add Interaction" }).click();
  await inspector(page).getByLabel("Target", { exact: true }).selectOption(featuresId);
  await node(page, navId).click({ position: { x: 5, y: 5 } });

  await button(page, "Add link").click();
  await button(page, "Move Home down").focus();
  await page.keyboard.press("Enter");
  await expect(button(page, "Move Home down")).toBeFocused();
  expect(await canvasChildren(page, navId)).toEqual(["a:Features", "a:Home", "a:Pricing", "a:New link", "button:Get Started"]);
  await button(page, "Remove Features").click();
  const expected = ["a:Home", "a:Pricing", "a:New link", "button:Get Started"];
  expect(await canvasChildren(page, navId)).toEqual(expected);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await canvasChildren(page, navId)).toEqual(["a:Features", "a:Home", "a:Pricing", "a:New link", "button:Get Started"]);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await canvasChildren(page, navId)).toEqual(expected);

  await page.getByRole("button", { name: "Enter Preview" }).click();
  await expect(page.getByRole("button", { name: "Exit Preview" })).toBeVisible();
  expect(await canvasChildren(page, navId)).toEqual(expected);
  await page.getByRole("button", { name: "Exit Preview" }).click();

  await page.keyboard.press("Control+s");
  await expect(page.locator("[data-project-status]")).toHaveAttribute("data-project-status", "saved");
  const saved = JSON.parse(await readFile(target, "utf8")) as { formatVersion: number; document: SavedNode };
  expect(saved.formatVersion).toBe(2);
  const savedNav = findById(saved.document, navId);
  expect(savedNav?.children?.map((child) => `${child.tag}:${child.text ?? ""}`)).toEqual(expected);
  const home = savedNav?.children?.[0];
  expect(home?.interactions ?? []).toEqual([]);
  expect(findById(saved.document, featuresId)).toBeUndefined();

  await layoutry.dispose();
  layoutry = await launchLayoutry({ extraArgs: [target] });
  await expect(layoutry.page.locator("[data-project-source]")).toHaveText(/Navbar\.layoutry/);
  await expect(node(layoutry.page, navId)).toBeVisible();
  expect(await canvasChildren(layoutry.page, navId)).toEqual(expected);
  await node(layoutry.page, navId).click({ position: { x: 5, y: 5 } });
  await expect(section(layoutry.page).getByText("3 links")).toBeVisible();
});

test("a format 1 file's Navbar is managed, then BC-05's upgrade prompt still protects the original (Save As, real files)", async () => {
  const original = path.join(folder, "Legacy Every Element.layoutry");
  const copy = path.join(folder, "Legacy Every Element (v2).layoutry");
  await copyFile(path.join(REPO_ROOT, "test", "fixtures", "persistence", "project-1.1-every-element.layoutry"), original);
  const sha = async (file: string) => createHash("sha256").update(await readFile(file)).digest("hex");
  const originalHash = await sha(original);

  layoutry = await launchLayoutry({ extraArgs: [original] });
  const { app, page } = layoutry;
  await expect(page.locator("[data-project-source]")).toHaveText(/Legacy Every Element\.layoutry/);
  const navId = "nav-3ca05eea";
  await expect(node(page, navId)).toBeVisible();
  await node(page, navId).click({ position: { x: 5, y: 5 } });
  await expect(section(page).getByText("4 links")).toBeVisible();

  await button(page, "Add link").click();
  await button(page, "Move Home down").click();
  await button(page, "Remove Services").click();
  const expected = ["a:About", "a:Home", "a:Contact", "a:New link"];
  expect(await canvasChildren(page, navId)).toEqual(expected);

  await scriptFileDialogs(app, { save: [copy] });
  // File > Save, not Ctrl+S: this file contains an authored, open Dialog element, and
  // the project shortcuts ignore keys while ANY dialog[open] exists — a pre-existing
  // defect found by BC-06.3 (report: PRJ-K1), outside BC-06.
  await page.getByRole("menuitem", { name: "File" }).click();
  await page.getByRole("menuitem", { name: "Save", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Upgrade Project File?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Save As… (Recommended)" }).click();
  await expect(page.locator("[data-project-status]")).toHaveAttribute("data-project-status", "saved");
  expect(await sha(original)).toBe(originalHash);
  const saved = JSON.parse(await readFile(copy, "utf8")) as { formatVersion: number; document: SavedNode };
  expect(saved.formatVersion).toBe(2);
  expect(findById(saved.document, navId)?.children?.map((child) => `${child.tag}:${child.text ?? ""}`)).toEqual(expected);
});
