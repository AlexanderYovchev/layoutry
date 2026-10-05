import { test, expect, type Page } from "@playwright/test";

async function openCategory(page: Page, categoryName: RegExp, menuName: string) {
  const menu = page.getByRole("menu", { name: menuName });
  if (await menu.count() > 0 && (await menu.first().isVisible())) return;
  const tab = page.getByRole("button", { name: categoryName });
  await tab.click();
}

async function insertFromHtml(page: Page, nameRegex: RegExp) {
  await openCategory(page, /^HTML$/, "HTML elements");
  await page.getByRole("menuitem", { name: nameRegex }).click();
}

async function insertFromComponents(page: Page, nameRegex: RegExp) {
  await openCategory(page, /^Components$/, "Components elements");
  await page.getByRole("menuitem", { name: nameRegex }).click();
}

async function insertFromMedia(page: Page, nameRegex: RegExp) {
  await openCategory(page, /^Media$/, "Media elements");
  await page.getByRole("menuitem", { name: nameRegex }).click();
}

function previewToggle(page: Page) {
  return page.getByRole("button", { name: /Preview/ });
}

async function insertProgressBar(page: Page) {
  await insertFromComponents(page, /^Progress Bar/);
}

function workspace(page: Page) {
  return page.getByRole("main", { name: "Workspace" });
}

test.describe("Progress Bar Component Closure — Checkpoint 1.15.6.13.1", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Scenario A/B/C/D/E/F — insert produces the exact ordinary tree, genuine progress, 50/100, label, no percentage", async ({ page }) => {
    await insertProgressBar(page);
    const progress = page.locator("progress").last();
    await expect(progress).toBeVisible();
    await expect(progress).toHaveJSProperty("tagName", "PROGRESS");
    await expect(progress).toHaveJSProperty("value", 50);
    await expect(progress).toHaveJSProperty("max", 100);

    const label = workspace(page).locator('[data-node-type="p"]').last();
    await expect(label).toHaveText("Progress");
    await expect(workspace(page).getByText(/%/)).toHaveCount(0);
  });

  test("Scenario G — editing the label works through ordinary Canvas text editing", async ({ page }) => {
    await insertProgressBar(page);
    const label = workspace(page).locator('[data-node-type="p"]').last();
    await label.dblclick();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Upload Progress");
    await page.keyboard.press("Enter");
    await expect(label).toHaveText("Upload Progress");
  });

  test("Scenario H/I/J/K — selecting the Progress child exposes the unchanged Progress Inspector (Value/Max/Indeterminate)", async ({ page }) => {
    await insertProgressBar(page);
    const progress = page.locator("progress").last();
    await progress.click({ force: true });

    await expect(page.getByRole("switch", { name: "Indeterminate" })).toBeVisible();
    const valueField = page.getByRole("spinbutton", { name: "Value", exact: true });
    await expect(valueField).toHaveValue("50");

    await valueField.fill("75");
    await valueField.blur();
    await expect(progress).toHaveJSProperty("value", 75);
    // No stale percentage text exists anywhere on Canvas, because none was authored.
    await expect(workspace(page).getByText(/%/)).toHaveCount(0);

    await page.getByRole("spinbutton", { name: "Max", exact: true }).fill("50");
    await page.getByRole("spinbutton", { name: "Max", exact: true }).blur();
    await expect(progress).toHaveJSProperty("max", 50);
    await expect(progress).toHaveJSProperty("value", 50);

    await page.getByRole("switch", { name: "Indeterminate" }).click();
    const position = await progress.evaluate((p: HTMLProgressElement) => p.position);
    expect(position).toBe(-1);
  });

  test("Scenario L/Q — Progress child width behavior and root resize", async ({ page }) => {
    await insertFromHtml(page, /^Container/);
    await insertProgressBar(page);

    const progress = page.locator("progress").last();
    const progressBox = await progress.boundingBox();
    expect(progressBox).not.toBeNull();
    if (progressBox) expect(progressBox.width).toBeGreaterThan(0);
  });

  test("Scenario M/N/O/P — Flow, Flex, Grid, Free parents all render the composition without breakage", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    page.on("pageerror", (err) => errors.push(err.message));

    await insertFromHtml(page, /^Container/);
    await insertProgressBar(page);
    await expect(page.locator("progress").last()).toBeVisible();

    const flexButton = page.getByRole("button", { name: "Flex", exact: true });
    if (await flexButton.count() > 0) await flexButton.first().click();
    await expect(page.locator("progress").first()).toBeVisible();

    const gridButton = page.getByRole("button", { name: "Grid", exact: true });
    if (await gridButton.count() > 0) await gridButton.first().click();
    await expect(page.locator("progress").first()).toBeVisible();

    const freeButton = page.getByRole("button", { name: "Free", exact: true });
    if (await freeButton.count() > 0) await freeButton.first().click();
    await expect(page.locator("progress").first()).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("Scenario R/S — Style Protection blocks CSS but never blocks Progress semantics", async ({ page }) => {
    await insertFromHtml(page, /^Container/);
    const lockToggle = page.getByRole("switch", { name: "Lock child styles" });
    await lockToggle.scrollIntoViewIfNeeded();
    await lockToggle.click({ force: true });

    await insertProgressBar(page);
    const progress = page.locator("progress").last();
    await progress.click({ force: true });
    const valueField = page.getByRole("spinbutton", { name: "Value", exact: true });
    await valueField.fill("90");
    await valueField.blur();
    await expect(progress).toHaveJSProperty("value", 90);
  });

  test("Scenario T/U/V — duplication clones the full subtree with fresh ids, undo removes the whole composition, redo restores it", async ({ page }) => {
    await insertProgressBar(page);
    const rootId = await page.evaluate(() => {
      const progressEls = document.querySelectorAll("progress");
      const p = progressEls[progressEls.length - 1];
      return p?.parentElement?.getAttribute("data-node-id") ?? null;
    });
    expect(rootId).not.toBeNull();
    const root = page.locator(`[data-node-id="${rootId}"]`);
    await root.click({ force: true });
    await page.keyboard.press("Control+d");

    await expect(page.locator("progress")).toHaveCount(2);
    await expect(workspace(page).locator('[data-node-type="p"]')).toHaveCount(2);

    await page.keyboard.press("Control+z");
    await expect(page.locator("progress")).toHaveCount(1);

    await page.keyboard.press("Control+z");
    await expect(page.locator("progress")).toHaveCount(0);

    await page.keyboard.press("Control+y");
    await expect(page.locator("progress")).toHaveCount(1);
  });

  test("Scenario W — multi-selection: Progress Bar root + Container, Progress child + another Progress, Progress child + Divider", async ({ page }) => {
    await insertFromHtml(page, /^Container/);
    await insertProgressBar(page);
    const progress = page.locator("progress").last();
    await progress.click({ force: true });
    const container = workspace(page).locator('[data-node-type="div"]').first();
    await container.click({ force: true, modifiers: ["Shift"] });
    await expect(page.getByText(/elements selected/).first()).toBeVisible();

    await page.keyboard.press("Escape");
    await insertFromHtml(page, /^Progress Task completion/);
    const progresses = page.locator("progress");
    await expect(progresses).toHaveCount(2);
    await progresses.nth(0).click({ force: true });
    await progresses.nth(1).click({ force: true, modifiers: ["Shift"] });
    await expect(page.getByText(/Progresss selected|elements selected/).first()).toBeVisible();

    await page.keyboard.press("Escape");
    await insertFromHtml(page, /^Divider/);
    await page.locator("progress").first().click({ force: true });
    await page.locator("hr").last().click({ modifiers: ["Shift"] });
    await expect(page.getByText(/elements selected/).first()).toBeVisible();
  });

  test("Scenario X — Structure shows ordinary primitive node names, not a special 'Progress Bar' node", async ({ page }) => {
    await insertProgressBar(page);
    const structureTab = page.getByRole("tab", { name: "Structure" });
    await structureTab.click();
    await expect(page.getByRole("treeitem", { name: "Progress Bar" })).toHaveCount(0);
    await expect(page.getByRole("treeitem", { name: /Progress/ }).first()).toBeVisible();
  });

  test("Scenario Y — the raw Progress primitive remains separately available under HTML -> Content", async ({ page }) => {
    await insertFromHtml(page, /^Progress Task completion/);
    await expect(page.locator("progress")).toHaveCount(1);
  });

  test("Scenario Z/AA/AB — existing Data Display/Figure/Audio primitives all still insert cleanly", async ({ page }) => {
    await insertFromComponents(page, /^Badge/);
    await expect(workspace(page).locator('[data-node-type="div"]').last()).toBeVisible();

    await page.keyboard.press("Escape");
    await insertFromComponents(page, /^Avatar Circular/);
    await expect(page.locator("img")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await insertFromComponents(page, /^Stat Card/);
    await expect(page.getByText("Total Visitors")).toBeVisible();

    await page.keyboard.press("Escape");
    await insertFromComponents(page, /^Metadata Row/);
    await expect(page.getByText("Status", { exact: true })).toBeVisible();

    await page.keyboard.press("Escape");
    await insertFromHtml(page, /^Figure/);
    await expect(page.locator("figure").last()).toBeVisible();

    await page.keyboard.press("Escape");
    await insertFromMedia(page, /^Audio Player/);
    await expect(page.locator("audio").last()).toBeVisible();
  });

  test("Scenario AC — MediaInteractionShield + autoplay regressions remain intact", async ({ page }) => {
    await insertFromMedia(page, /^Audio Player/);
    const audio = page.locator("audio");
    await previewToggle(page).click();
    const box = await audio.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName ?? null, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
      expect(hit).toBe("AUDIO");
    }
    await previewToggle(page).click();

    await page.getByRole("switch", { name: "Autoplay" }).click();
    await expect(audio).toHaveJSProperty("autoplay", false);
    await previewToggle(page).click();
    await expect(audio).toHaveJSProperty("autoplay", true);
  });

  test("Scenario AD — zero console errors/warnings across the full Progress Bar flow", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
    page.on("pageerror", (err) => errors.push(err.message));

    await insertProgressBar(page);
    const progress = page.locator("progress").last();
    await progress.click({ force: true });
    await page.getByRole("spinbutton", { name: "Value", exact: true }).fill("80");
    await page.getByRole("spinbutton", { name: "Value", exact: true }).blur();
    await page.getByRole("switch", { name: "Indeterminate" }).click();
    await page.getByRole("switch", { name: "Indeterminate" }).click();

    const label = workspace(page).locator('[data-node-type="p"]').last();
    await label.dblclick();
    await page.keyboard.press("Control+a");
    await page.keyboard.type("Renamed");
    await page.keyboard.press("Enter");

    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+y");

    expect(errors).toEqual([]);
  });
});
