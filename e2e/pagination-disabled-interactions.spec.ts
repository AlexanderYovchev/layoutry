import { expect, test, type Page } from "@playwright/test";
import { createPaginationNode } from "../src/features/editor/factories/navigationCompositions";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { exportHtmlCss } from "../src/features/export/utils/exportHtmlCss";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";

/*
 * BC-09.2.1 — a disabled Pagination link with an authored click
 * interaction never runs it, in Preview and on the exported page, by
 * mouse, keyboard or a script's element.click(). Enabled links with the
 * same interaction keep working, the current page doesn't navigate,
 * Design selection still works and Preview changes no document or history.
 */

const SURFACE = "[data-document-surface]";
const toggle = (id: string, targetId: string) => [{ id, trigger: "click" as const, action: "toggle" as const, targetId }];
const panel = (id: string): EditorElementNode => ({ id, tag: "p", text: `Panel ${id}`, initialPreviewVisibility: "hidden" });

/** Page 1 (Previous disabled) and a last page (Next disabled); every boundary link toggles its own panel. */
function testDocument(): EditorElementNode {
  const first = { ...createPaginationNode(), id: "nav-first" };
  const [previous, , page2, , next] = first.children!;
  Object.assign(previous, { id: "prev-first", interactions: toggle("i-1", "panel-prev") });
  Object.assign(page2, { id: "page2-first" });
  Object.assign(next, { id: "next-first", interactions: toggle("i-2", "panel-next") });

  const last = { ...createPaginationNode(), id: "nav-last" };
  const [lastPrevious, page1, , page3, lastNext] = last.children!;
  delete page1.ariaCurrent;
  delete page1.background;
  page1.typography = { color: "#3f3f46" };
  delete page1.display;
  Object.assign(page3, { id: "current-last", ariaCurrent: "page", background: { color: "#18181b" }, typography: { color: "#ffffff" } });
  delete lastPrevious.disabled;
  delete lastPrevious.display;
  Object.assign(lastPrevious, { id: "prev-last", interactions: toggle("i-3", "panel-prev-last") });
  Object.assign(lastNext, { id: "next-last", disabled: true, interactions: toggle("i-4", "panel-next-last") });

  return { id: "page-root", tag: "page", children: [first, last, panel("panel-prev"), panel("panel-next"), panel("panel-prev-last"), panel("panel-next-last")] };
}

const PANELS = ["panel-prev", "panel-next", "panel-prev-last", "panel-next-last"];

async function visiblePanels(page: Page, root: string, byId: (id: string) => string): Promise<string[]> {
  const shown: string[] = [];
  for (const id of PANELS) if (await page.locator(`${root} ${byId(id)}`).isVisible()) shown.push(id);
  return shown;
}

test("Preview: disabled boundaries never run their interaction (click, script click, keyboard); enabled ones do; nothing is recorded", async ({ page }) => {
  await gotoApp(page);
  await importDocument(page, testDocument(), "panel-next-last");
  const node = (id: string) => page.locator(`${SURFACE} [data-node-id="${id}"]`);
  const shown = () => visiblePanels(page, SURFACE, (id) => `[data-node-id="${id}"]`);
  const undo = page.getByRole("button", { name: "Undo", exact: true });
  await expect(undo).toBeDisabled();

  // Design: the disabled link is still selected by a click (force: Playwright won't click aria-disabled).
  await node("prev-first").click({ force: true });
  await expect(page.getByRole("complementary", { name: "Inspector panel" }).getByRole("textbox", { name: "Link destination" })).toHaveValue("#");

  await page.getByRole("button", { name: "Enter Preview" }).click();
  await expect(page.getByRole("button", { name: "Exit Preview" })).toBeVisible();
  expect(await shown()).toEqual([]);
  const startUrl = page.url();

  // Mouse.
  await node("prev-first").click({ force: true });
  await node("next-last").click({ force: true });
  expect(await shown()).toEqual([]);
  // A script's element.click(), and a disabled link can't take focus for Enter.
  await node("prev-first").evaluate((element) => (element as HTMLElement).click());
  await node("next-last").evaluate((element) => {
    (element as HTMLElement).focus();
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(await page.evaluate(() => document.activeElement?.getAttribute("data-node-id") ?? null)).not.toBe("next-last");
  expect(await shown()).toEqual([]);
  // The current page doesn't navigate.
  await node("current-last").click({ force: true });

  // Enabled boundaries with the same kind of binding work, by mouse and by Enter.
  await node("next-first").click();
  expect(await shown()).toEqual(["panel-next"]);
  await node("prev-last").focus();
  await page.keyboard.press("Enter");
  // That click was outside the open Next panel, so the established
  // outside-click dismissal closed it (same in Preview and export).
  expect(await shown()).toEqual(["panel-prev-last"]);
  expect(page.url()).toBe(startUrl);

  // Preview recorded nothing.
  await page.getByRole("button", { name: "Exit Preview" }).click();
  await expect(undo).toBeDisabled();
  await expect(node("next-last")).toHaveAttribute("aria-disabled", "true");
});

test("exported page: disabled boundaries are not triggers and never run, by any activation; enabled ones do", async ({ browser }) => {
  const exported = exportHtmlCss(testDocument(), { mode: "standalone", title: "Pagination" });
  expect(exported.ok).toBe(true);
  expect(exported.diagnostics.filter((diagnostic) => diagnostic.code === "disabled-trigger").map((diagnostic) => diagnostic.nodeId)).toEqual(["prev-first", "next-last"]);
  const page = await browser.newPage();
  await page.setContent(exported.files[0].content);
  const link = (text: string, nav: number) => page.locator("nav").nth(nav).locator("> a", { hasText: new RegExp(`^${text}$`) });
  const shown = () => visiblePanels(page, "body", (id) => `p:text-is("Panel ${id}")`);
  expect(await shown()).toEqual([]);
  const startUrl = page.url();

  for (const disabled of [link("Previous", 0), link("Next", 1)]) {
    await expect(disabled).toHaveAttribute("aria-disabled", "true");
    expect(await disabled.getAttribute("data-ly-on-click")).toBeNull();
    expect(await disabled.getAttribute("href")).toBeNull();
    await disabled.click({ force: true });
    await disabled.evaluate((element) => (element as HTMLElement).click());
    await disabled.evaluate((element) => {
      (element as HTMLElement).focus();
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
  }
  expect(await shown()).toEqual([]);
  // The current page (3 on the last-page nav) has no href and doesn't navigate.
  expect(await link("3", 1).getAttribute("href")).toBeNull();
  await link("3", 1).click({ force: true });
  expect(page.url()).toBe(startUrl);

  await link("Next", 0).click();
  expect(await shown()).toEqual(["panel-next"]);
  await link("Previous", 1).focus();
  await page.keyboard.press("Enter");
  // That click was outside the open Next panel, so the established
  // outside-click dismissal closed it (same in Preview and export).
  expect(await shown()).toEqual(["panel-prev-last"]);
  await page.close();
});
