import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";
import type { EditorElementNode } from "../src/features/editor/types/document";

/*
 * BC-12.2 in the real browser: Structure panel Alt+Arrow reorder through the
 * shared move command — Canvas/Preview/Export order, Undo/Redo, a refused
 * move's notice, Free paint order, a Canvas drag entering a Free container
 * (G2), and Save/Reopen.
 */

const SURFACE = "[data-document-surface]";
const element = (page: Page, id: string) => page.locator(`${SURFACE} [data-node-id="${id}"]`);
const tree = (page: Page) => page.getByRole("tree", { name: "Page structure" });
const row = (page: Page, name: string) => tree(page).getByRole("treeitem", { name: new RegExp(`^(Collapse |Expand )?${name}`) }).first();
const announcement = (page: Page) => page.locator("[data-structure-move-announcement]");
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

const freeChild = (id: string, text: string, x: number, y: number, color: string): EditorElementNode => ({
  id,
  tag: "p",
  text: text.split(" ")[0],
  displayName: text,
  freeLayout: { x, y, width: 160, height: 100 },
  background: { color },
});

const fixture: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "k-h", tag: "h1", text: "Title", displayName: "Title" },
    {
      id: "k-s1",
      tag: "section",
      displayName: "Section One",
      children: [
        { id: "k-a", tag: "p", text: "Alpha", displayName: "Alpha" },
        { id: "k-b", tag: "p", text: "Beta", displayName: "Beta" },
      ],
    },
    { id: "k-s2", tag: "section", displayName: "Section Two", children: [{ id: "k-c", tag: "p", text: "Gamma", displayName: "Gamma" }] },
    { id: "k-flow", tag: "div", displayName: "Flow box", children: [{ id: "k-m", tag: "button", text: "Mover", displayName: "Mover" }] },
    {
      id: "k-free",
      tag: "div",
      displayName: "Free box",
      layoutMode: "free",
      dimensions: { preferredWidth: 600, preferredHeight: 320, offsetX: 0, offsetY: 0 },
      children: [freeChild("k-f1", "Back card", 20, 20, "#ef4444"), freeChild("k-f2", "Front card", 80, 50, "#3b82f6")],
    },
  ],
};

async function open(page: Page) {
  await gotoApp(page);
  await importDocument(page, fixture, "k-m");
  await page.getByRole("tab", { name: "Structure" }).click();
}

async function y(page: Page, id: string) {
  return (await element(page, id).boundingBox())!.y;
}

async function exportedCode(page: Page) {
  await page.getByRole("button", { name: "Export Code" }).click();
  const code = page.getByRole("dialog", { name: "Export Code" }).getByTestId("export-code");
  await expect(code).toBeVisible();
  const text = (await code.textContent()) ?? "";
  await page.keyboard.press("Escape");
  return text;
}

test("1: Alt+ArrowDown reorders siblings on the Canvas; focus and selection stay; Undo/Redo is one step each", async ({ page }) => {
  await open(page);
  await row(page, "Alpha").click();
  await page.keyboard.press("Alt+ArrowDown");
  await expect(announcement(page)).toHaveText(/^Moved Alpha after Beta, position 2 of 2 in Section One\.\s*$/);
  await expect(row(page, "Alpha")).toBeFocused();
  await expect(row(page, "Alpha")).toHaveAttribute("aria-selected", "true");
  expect(await y(page, "k-b")).toBeLessThan(await y(page, "k-a"));
  expect(page.url()).not.toContain("about:blank");

  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await y(page, "k-a")) < (await y(page, "k-b"))).toBe(true);
  await button(page, "Redo").click();
  await expect.poll(async () => (await y(page, "k-b")) < (await y(page, "k-a"))).toBe(true);
  await button(page, "Undo").click();
  await expect.poll(async () => (await y(page, "k-a")) < (await y(page, "k-b"))).toBe(true);
  await expect(button(page, "Undo")).toBeDisabled();
});

test("2: Alt+ArrowLeft moves out of the parent and Alt+ArrowRight back in; the browser's Alt+Left Back is not triggered", async ({ page }) => {
  // A previous history entry, so a browser Back (Alt+Left) would actually navigate away.
  await page.goto("about:blank");
  await open(page);
  const url = page.url();
  await row(page, "Alpha").click();
  await page.keyboard.press("Alt+ArrowLeft");
  await expect(page.locator(`${SURFACE} [data-node-id="k-s1"] [data-node-id="k-a"]`)).toHaveCount(0);
  await expect(element(page, "k-a")).toHaveCount(1);
  expect(page.url()).toBe(url);
  await expect(row(page, "Alpha")).toHaveAttribute("aria-level", "2");
  await expect(row(page, "Alpha")).toBeFocused();

  await page.keyboard.press("Alt+ArrowRight");
  await expect(page.locator(`${SURFACE} [data-node-id="k-s1"] [data-node-id="k-a"]`)).toHaveCount(1);
  await expect(announcement(page)).toHaveText(/^Moved Alpha after Beta, position 2 of 2 in Section One\.\s*$/);
  await expect(row(page, "Alpha")).toHaveAttribute("aria-level", "3");
  await expect(row(page, "Alpha")).toBeFocused();

  // Plain arrows still only navigate.
  await page.keyboard.press("ArrowUp");
  await expect(row(page, "Beta")).toBeFocused();
});

test("3: a refused move changes nothing and says why (notice + announcement)", async ({ page }) => {
  await open(page);
  const before = await exportedCode(page);
  await row(page, "Section One").click();
  await page.keyboard.press("Alt+ArrowRight"); // into the Heading before it
  const message = "Section One wasn't moved: that place can't contain this kind of element.";
  await expect(page.locator("div[role=status]", { hasText: message })).toBeVisible();
  await expect(announcement(page)).toHaveText(new RegExp(`^${message.replace(/\./g, "\\.")}\\s*$`));
  await expect(button(page, "Undo")).toBeDisabled();
  expect(await exportedCode(page)).toBe(before);

  await row(page, "Title").click();
  await page.keyboard.press("Alt+ArrowUp");
  await expect(announcement(page)).toHaveText(/^Title is already first in /);
  await expect(button(page, "Undo")).toBeDisabled();
});

test("4: Preview and Export follow the new order; in a Free container the order changes only which element is on top", async ({ page }) => {
  await open(page);
  await row(page, "Alpha").click();
  await page.keyboard.press("Alt+ArrowDown");

  const freeBefore = await Promise.all([element(page, "k-f1").boundingBox(), element(page, "k-f2").boundingBox()]);
  const overlap = { x: freeBefore[1]!.x + 20, y: freeBefore[1]!.y + 20 };
  const topmost = () => page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("[data-node-id]")?.getAttribute("data-node-id"), overlap);
  expect(await topmost()).toBe("k-f2");
  await row(page, "Back card").click();
  await page.keyboard.press("Alt+ArrowDown");
  await expect(announcement(page)).toHaveText(/^Moved Back card after Front card, position 2 of 2 in Free box\.\s*$/);
  await expect.poll(topmost).toBe("k-f1");
  const freeAfter = await Promise.all([element(page, "k-f1").boundingBox(), element(page, "k-f2").boundingBox()]);
  expect(freeAfter).toEqual(freeBefore);

  await button(page, "Enter Preview").click();
  expect(await y(page, "k-b")).toBeLessThan(await y(page, "k-a"));
  expect(await topmost()).toBe("k-f1");
  await button(page, "Exit Preview").click();

  const code = await exportedCode(page);
  expect(code.indexOf(">Beta<")).toBeGreaterThan(-1);
  expect(code.indexOf(">Beta<")).toBeLessThan(code.indexOf(">Alpha<"));
  // DOM order inside the Free box: Front card now comes first.
  expect(code.indexOf(">Front<")).toBeGreaterThan(-1);
  expect(code.indexOf(">Front<")).toBeLessThan(code.indexOf(">Back<"));
});

test("5: a Canvas drag of a Flow element into a Free container gives it a position inside the container (shared move, G2)", async ({ page }) => {
  await open(page);
  await element(page, "k-free").scrollIntoViewIfNeeded();
  const source = (await element(page, "k-m").boundingBox())!;
  const freeBox = (await element(page, "k-free").boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 10, source.y + source.height / 2 + 10, { steps: 4 });
  await page.mouse.move(freeBox.x + freeBox.width / 2, freeBox.y + freeBox.height / 2, { steps: 16 });
  await page.mouse.up();
  await expect(page.locator(`${SURFACE} [data-node-id="k-free"] [data-node-id="k-m"]`)).toHaveCount(1);
  await expect(element(page, "k-m")).toHaveCSS("position", "absolute");
  const moved = (await element(page, "k-m").boundingBox())!;
  const container = (await element(page, "k-free").boundingBox())!;
  expect(moved.x).toBeGreaterThanOrEqual(container.x);
  expect(moved.y).toBeGreaterThanOrEqual(container.y);
  expect(moved.x + moved.width).toBeLessThanOrEqual(container.x + container.width + 0.5);
  expect(moved.y + moved.height).toBeLessThanOrEqual(container.y + container.height + 0.5);
  await button(page, "Undo").click();
  await expect(page.locator(`${SURFACE} [data-node-id="k-flow"] [data-node-id="k-m"]`)).toHaveCount(1);
  await expect(button(page, "Undo")).toBeDisabled();
});

test("6: a keyboard reorder survives Save/Reopen", async ({ page }) => {
  await open(page);
  await row(page, "Gamma").click();
  await page.keyboard.press("Alt+ArrowLeft");
  await expect(page.locator(`${SURFACE} [data-node-id="k-s2"] [data-node-id="k-c"]`)).toHaveCount(0);

  await page.keyboard.press("ControlOrMeta+s");
  const save = page.getByRole("dialog", { name: "Save Project" });
  await expect(page.locator('[data-project-status="saved"]').or(save)).toBeVisible();
  if (await save.isVisible()) {
    await save.getByRole("textbox", { name: "Project name" }).fill("BC-12.2 reorder");
    await save.getByRole("button", { name: "Save" }).click();
  }
  await expect(page.locator("[data-project-status]")).toHaveAttribute("data-project-status", "saved");
  await page.reload();
  await gotoApp(page);
  await page.keyboard.press("ControlOrMeta+o");
  const library = page.getByRole("dialog", { name: "Open Project" });
  await library.getByRole("button", { name: /^Open (BC-02\.5 parity|BC-12\.2 reorder)$/ }).first().click();
  await expect(library).toBeHidden();
  await expect(element(page, "k-c")).toHaveCount(1);
  await expect(page.locator(`${SURFACE} [data-node-id="k-s2"] [data-node-id="k-c"]`)).toHaveCount(0);
  expect(await y(page, "k-s2")).toBeLessThan(await y(page, "k-c"));
});
