import { expect, test, type Locator, type Page } from "@playwright/test";
import { documentNodeCount } from "../desktop/support/layoutryApp";
import {
  extractedExe,
  launchPackaged,
  type PackagedLayoutry,
} from "./support/packagedApp";

/**
 * DESKTOP-0.5 — the core editing workflows, exercised in the real packaged
 * Layoutry.exe (extracted ZIP, clean profile, offline switches). These
 * reuse the browser editor's own controls; they check that nothing about
 * packaging (app://, CSP, sandbox, fuses, ASAR) breaks real editing.
 */

let layoutry: PackagedLayoutry;

test.beforeEach(async () => {
  layoutry = await launchPackaged(extractedExe());
});

test.afterEach(async () => {
  await layoutry?.dispose();
});

const inspector = (page: Page) =>
  page.getByRole("complementary", { name: "Inspector panel" });
const library = (page: Page) =>
  page.getByRole("complementary", { name: "Resource panel" });
const canvasNode = (page: Page, id: string) =>
  page.locator(`[data-document-surface] [data-node-id="${id}"]`).first();

/** The selected node's id, read from the Inspector's "Node ID" row. */
async function selectedNodeId(page: Page): Promise<string> {
  const text = await inspector(page).innerText();
  const match = text.match(/Node ID\s+(\S+)/);
  if (!match)
    throw new Error(`No Node ID in Inspector:\n${text.slice(0, 300)}`);
  return match[1];
}

async function commitField(field: Locator, value: string) {
  await field.click();
  await field.fill(value);
  await field.press("Enter");
}

function computed(locator: Locator, property: string) {
  return locator.evaluate(
    (element, name) => getComputedStyle(element).getPropertyValue(name),
    property,
  );
}

/** Ids and texts of every authored node, in document order. */
function documentSnapshot(page: Page) {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll("[data-document-surface] [data-node-id]"),
    ].map(
      (node) =>
        `${node.getAttribute("data-node-id")}:${(node.textContent ?? "").trim().slice(0, 40)}`,
    ),
  );
}

test("inserts HTML elements and a Component, and nests elements in a container", async () => {
  const { page } = layoutry;
  const before = await documentNodeCount(page);

  await library(page)
    .getByRole("button", { name: /^Container/ })
    .click();
  await expect.poll(() => documentNodeCount(page)).toBe(before + 1);
  const containerId = await selectedNodeId(page);

  // With the container selected, a new element goes inside it.
  await library(page)
    .getByRole("button", { name: /^Paragraph/ })
    .click();
  await expect.poll(() => documentNodeCount(page)).toBe(before + 2);
  await expect(
    canvasNode(page, containerId).locator('[data-node-type="p"]'),
  ).toHaveCount(1);

  // A ready-made Component from the creation toolbar.
  await page.getByRole("button", { name: "Components" }).click();
  await page.getByRole("menuitem", { name: /^Dropdown Button/ }).click();
  await expect(
    page
      .getByRole("main", { name: "Workspace" })
      .getByRole("button", { name: "Menu" }),
  ).toBeVisible();
  expect(await documentNodeCount(page)).toBeGreaterThan(before + 2);
});

test("edits text inline on the Canvas", async () => {
  const { page } = layoutry;
  await canvasNode(page, "heading-1").dblclick();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Edited in the packaged app");
  await page.keyboard.press("Enter");
  await expect(canvasNode(page, "heading-1")).toHaveText(
    "Edited in the packaged app",
  );
});

test("applies typography, colors, spacing and size from the Inspector", async () => {
  const { page } = layoutry;
  const heading = canvasNode(page, "heading-1");
  await heading.click();
  const panel = inspector(page);

  await commitField(panel.getByLabel("Font size", { exact: true }), "32");
  await commitField(panel.getByLabel("Text color", { exact: true }), "#ff0000");
  await commitField(
    panel.getByLabel("Background color", { exact: true }),
    "#00ff00",
  );
  await commitField(
    panel.getByLabel("Padding (all sides)", { exact: true }),
    "12",
  );
  await commitField(
    panel.getByLabel("Margin (all sides)", { exact: true }),
    "8",
  );
  await commitField(panel.getByLabel("Width", { exact: true }), "420");

  await expect.poll(() => computed(heading, "font-size")).toBe("32px");
  await expect.poll(() => computed(heading, "color")).toBe("rgb(255, 0, 0)");
  await expect
    .poll(() => computed(heading, "background-color"))
    .toBe("rgb(0, 255, 0)");
  await expect.poll(() => computed(heading, "padding-top")).toBe("12px");
  await expect.poll(() => computed(heading, "margin-left")).toBe("8px");
  await expect
    .poll(() =>
      heading.evaluate((element) =>
        Math.round(element.getBoundingClientRect().width),
      ),
    )
    .toBe(420);
});

test("resizes an element with its Canvas handle and moves one by dragging", async () => {
  const { page } = layoutry;
  // Resize: the selected image's south-east handle.
  const image = page
    .locator('[data-document-surface] [data-node-type="img"]')
    .first();
  await image.click();
  const widthBefore = await image.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  const handle = page.locator('[data-resize-handle="se"]').first();
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error("resize handle not visible");
  const start = {
    x: handleBox.x + handleBox.width / 2,
    y: handleBox.y + handleBox.height / 2,
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step += 1) {
    await page.mouse.move(start.x - step * 12, start.y + step * 4);
  }
  await page.mouse.up();
  await expect
    .poll(() =>
      image.evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBeLessThan(widthBefore - 60);

  // Move: drag the paragraph above the heading (flow reorder).
  const order = () =>
    page.evaluate(() =>
      [
        ...document.querySelectorAll(
          '[data-node-id="section-1"] > [data-node-id], [data-node-id="section-1"] [data-node-id]',
        ),
      ]
        .map((node) => node.getAttribute("data-node-id"))
        .filter((id) => id === "heading-1" || id === "paragraph-1"),
    );
  expect(await order()).toEqual(["heading-1", "paragraph-1"]);
  const paragraph = canvasNode(page, "paragraph-1");
  const heading = canvasNode(page, "heading-1");
  const from = await paragraph.boundingBox();
  const to = await heading.boundingBox();
  if (!from || !to) throw new Error("nodes not visible");
  await page.mouse.move(from.x + 40, from.y + from.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 15; step += 1) {
    await page.mouse.move(
      from.x + 40,
      from.y +
        from.height / 2 +
        ((to.y + 4 - (from.y + from.height / 2)) * step) / 15,
    );
  }
  // Dwell on the target like a person would: dnd-kit settles its drop
  // target on the next animation frames, and an instant release can land
  // before that (seen as an intermittent no-op drop in automation).
  await page.waitForTimeout(150);
  await page.mouse.up();
  await expect.poll(order).toEqual(["paragraph-1", "heading-1"]);
  await page.keyboard.press("Control+z");
  await expect.poll(order).toEqual(["heading-1", "paragraph-1"]);
});

test("the Structure panel shows the tree and drives selection", async () => {
  const { page } = layoutry;
  await library(page)
    .getByRole("tab", { name: "Structure", exact: true })
    .click();
  const tree = page.getByRole("tree");
  await expect(tree).toBeVisible();
  const items = tree.getByRole("treeitem");
  expect(await items.count()).toBeGreaterThanOrEqual(5);

  const buttonRow = tree.locator('[role="treeitem"][title="Primary Button"]');
  await buttonRow.click();
  await expect(buttonRow).toHaveAttribute("aria-selected", "true");
  expect(await selectedNodeId(page)).toBe("button-1");

  // Selecting on the Canvas is reflected back in the tree.
  await canvasNode(page, "heading-1").click();
  await expect(buttonRow).toHaveAttribute("aria-selected", "false");
  expect(await selectedNodeId(page)).toBe("heading-1");
});

test("copy, paste, undo and redo", async () => {
  const { page } = layoutry;
  const buttons = page.locator(
    '[data-document-surface] [data-node-type="button"]',
  );
  const before = await buttons.count();
  await canvasNode(page, "button-1").click();
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Control+v");
  await expect(buttons).toHaveCount(before + 1);
  await page.keyboard.press("Control+z");
  await expect(buttons).toHaveCount(before);
  await page.keyboard.press("Control+y");
  await expect(buttons).toHaveCount(before + 1);
});

test("Preview and back to Design leaves the document unchanged", async () => {
  const { page } = layoutry;
  const before = await documentSnapshot(page);
  await page.getByRole("button", { name: "Enter Preview" }).click();
  await expect(
    page.getByRole("contentinfo", { name: "Status bar" }),
  ).toContainText("Preview mode");
  // Interact with authored content while previewing.
  await canvasNode(page, "button-1").click();
  await page.getByRole("button", { name: "Exit Preview" }).click();
  await expect(
    page.getByRole("contentinfo", { name: "Status bar" }),
  ).toContainText("Design mode");
  expect(await documentSnapshot(page)).toEqual(before);
});

test("transforms apply on the Canvas and transitions apply in Preview", async () => {
  const { page } = layoutry;
  const button = canvasNode(page, "button-1");
  await button.click();
  const panel = inspector(page);

  await commitField(panel.getByLabel("Rotate", { exact: true }), "15");
  await expect.poll(() => computed(button, "transform")).not.toBe("none");

  await panel
    .getByRole("button", { name: "Opacity", exact: true })
    .first()
    .click();
  await commitField(panel.getByLabel("Duration", { exact: true }), "300");

  // Transitions are a Preview-only effect.
  expect(await computed(button, "transition-duration")).toBe("0s");
  await page.getByRole("button", { name: "Enter Preview" }).click();
  await expect
    .poll(() => computed(button, "transition-property"))
    .toBe("opacity");
  await expect.poll(() => computed(button, "transition-duration")).toBe("0.3s");
  await page.getByRole("button", { name: "Exit Preview" }).click();
  await expect.poll(() => computed(button, "transition-duration")).toBe("0s");
  expect(await computed(button, "transform")).not.toBe("none");
});

test("the OS dark theme restyles the editor chrome but never the authored page", async () => {
  const { page } = layoutry;
  for (const name of ["Button", "Text Input", "Checkbox", "Select"]) {
    await library(page).getByRole("button", { name, exact: true }).click();
  }
  await page.keyboard.press("Escape");
  const pageStyles = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("[data-document-surface] *")]
        .filter((element) => !element.closest("[data-canvas-overlay]"))
        .map((element) => {
          const style = getComputedStyle(element);
          return [
            element.tagName,
            style.color,
            style.backgroundColor,
            style.fontFamily,
            style.colorScheme,
          ].join("|");
        }),
    );

  await page.emulateMedia({ colorScheme: "light" });
  const light = await pageStyles();
  await page.emulateMedia({ colorScheme: "dark" });
  const dark = await pageStyles();
  expect(dark).toEqual(light);
  await expect(
    page.getByRole("banner", { name: "Application menu bar" }),
  ).toHaveCSS("background-color", "rgb(15, 17, 23)");
  await page.emulateMedia({ colorScheme: null });
});
