import { expect, test, type Page } from "@playwright/test";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";

/*
 * BC-11.3 in the real browser: the Inspector section headers' Copy/Paste
 * <section> CSS menu, its interplay with the global Copy/Paste CSS
 * shortcuts (one CSS clipboard), multi-selection paste with Undo/Redo,
 * Preview/Export for a complex section, and the menu at the Inspector's
 * narrowest width.
 */

const SURFACE = "[data-document-surface]";
const px = (value: number) => ({ value, unit: "px" as const });
const gradient = { type: "linear" as const, angle: 90, stops: [{ id: "g1", color: "#ff0000", position: 0 }, { id: "g2", color: "#0000ff", position: 100 }] };
const document: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "s-a", tag: "h2", text: "Source", typography: { fontSize: px(32), color: "#ff0000" }, background: { color: "#00ff00", sourceType: "gradient", gradient }, spacing: { padding: { top: 20, right: 20, bottom: 20, left: 20 } } },
    { id: "s-b", tag: "p", text: "Dest", typography: { fontSize: px(14), fontWeight: 700 }, background: { color: "#eeeeee" } },
    { id: "s-c", tag: "p", text: "Other" },
    { id: "s-d", tag: "h3", text: "Third" },
  ],
};

const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector panel" });
const element = (page: Page, id: string) => page.locator(`${SURFACE} [data-node-id="${id}"]`);
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

async function select(page: Page, ids: string[]) {
  await element(page, ids[0]).click({ position: { x: 4, y: 4 } });
  for (const id of ids.slice(1)) await element(page, id).click({ modifiers: ["ControlOrMeta"], position: { x: 4, y: 4 } });
}

async function sectionAction(page: Page, section: string, item: string) {
  await inspector(page).getByRole("button", { name: `${section} CSS actions` }).click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await importDocument(page, document, "s-d");
});

test("Copy Typography CSS → Paste Typography CSS: merges typography only", async ({ page }) => {
  await select(page, ["s-a"]);
  await sectionAction(page, "Typography", "Copy Typography CSS");
  await select(page, ["s-b"]);
  await sectionAction(page, "Typography", "Paste Typography CSS");
  await expect(element(page, "s-b")).toHaveCSS("font-size", "32px");
  await expect(element(page, "s-b")).toHaveCSS("color", "rgb(255, 0, 0)");
  await expect(element(page, "s-b")).toHaveCSS("font-weight", "700");
  await expect(element(page, "s-b")).toHaveCSS("background-color", "rgb(238, 238, 238)");
  await expect(element(page, "s-b")).toHaveText("Dest");
});

test("global Copy CSS → Paste Background CSS only; then Copy Spacing CSS → global Paste CSS applies spacing only", async ({ page }) => {
  await select(page, ["s-a"]);
  await page.keyboard.press("ControlOrMeta+Alt+c");
  await select(page, ["s-b"]);
  await sectionAction(page, "Background", "Paste Background CSS");
  await expect(element(page, "s-b")).toHaveCSS("background-image", /linear-gradient/);
  await expect(element(page, "s-b")).toHaveCSS("font-size", "14px");
  await expect(element(page, "s-b")).toHaveCSS("padding-top", "0px");

  await select(page, ["s-a"]);
  await sectionAction(page, "Spacing", "Copy Spacing CSS");
  await select(page, ["s-c"]);
  await page.keyboard.press("ControlOrMeta+Alt+v");
  await expect(element(page, "s-c")).toHaveCSS("padding-top", "20px");
  await expect(element(page, "s-c")).not.toHaveCSS("color", "rgb(255, 0, 0)");
  await expect(element(page, "s-c")).not.toHaveCSS("background-image", /gradient/);
});

test("multi-selection Paste Background CSS: every element, one Undo, Redo; Preview and Export carry the gradient", async ({ page }) => {
  await select(page, ["s-a"]);
  await sectionAction(page, "Background", "Copy Background CSS");
  await select(page, ["s-c", "s-d"]);
  await sectionAction(page, "Background", "Paste Background CSS");
  for (const id of ["s-c", "s-d"]) await expect(element(page, id)).toHaveCSS("background-image", /linear-gradient/);
  await button(page, "Undo").click();
  for (const id of ["s-c", "s-d"]) await expect(element(page, id)).toHaveCSS("background-image", "none");
  await button(page, "Redo").click();
  for (const id of ["s-c", "s-d"]) await expect(element(page, id)).toHaveCSS("background-image", /linear-gradient/);

  await button(page, "Enter Preview").click();
  for (const id of ["s-c", "s-d"]) await expect(element(page, id)).toHaveCSS("background-image", /linear-gradient/);
  await button(page, "Exit Preview").click();
  await page.getByRole("button", { name: "Export Code" }).click();
  const code = page.getByRole("dialog", { name: "Export Code" }).getByTestId("export-code");
  await expect(code).toBeVisible();
  const text = (await code.textContent()) ?? "";
  await page.keyboard.press("Escape");
  // Source, and the two pasted elements.
  expect(text.match(/linear-gradient\(90deg/g)?.length).toBe(3);
});

test("at the Inspector's narrowest width the section menu stays inside the panel, with no horizontal scroll", async ({ page }) => {
  const handle = page.getByRole("separator", { name: "Resize Inspector Panel" });
  const box = await handle.boundingBox();
  if (!box) throw new Error("resize handle not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(1599, box.y + 300, { steps: 10 });
  await page.mouse.up();
  await expect(handle).toHaveAttribute("aria-valuenow", (await handle.getAttribute("aria-valuemin")) ?? "");

  await select(page, ["s-a"]);
  // Scroll containers (overflow-x auto/scroll) that could scroll sideways; truncated labels hide overflow by design and don't count.
  const sidewaysScrollers = () =>
    inspector(page).evaluate((panel) =>
      [panel, ...panel.querySelectorAll("*")].filter((el) => el.scrollWidth > el.clientWidth + 1 && ["auto", "scroll"].includes(getComputedStyle(el).overflowX)).length,
    );
  expect(await sidewaysScrollers()).toBe(0);
  await inspector(page).getByRole("button", { name: "Typography CSS actions" }).click();
  const menu = page.getByRole("menu", { name: "Typography CSS" });
  await expect(menu).toBeVisible();
  const [menuBox, panelBox] = await Promise.all([menu.boundingBox(), inspector(page).boundingBox()]);
  expect(menuBox!.x).toBeGreaterThanOrEqual(panelBox!.x);
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 0.5);
  expect(await sidewaysScrollers()).toBe(0);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});
