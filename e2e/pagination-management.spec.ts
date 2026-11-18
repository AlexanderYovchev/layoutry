import { expect, test, type Locator, type Page } from "@playwright/test";
import { createPaginationNode } from "../src/features/editor/factories/navigationCompositions";
import {
  addPaginationPage,
  setPaginationControlVisible,
  setPaginationCurrentPage,
  setPaginationPageHref,
  setPaginationPageLabel,
} from "../src/features/editor/commands/paginationCommands";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { getPaginationParts } from "../src/features/editor/types/pagination";
import { exportHtmlCss } from "../src/features/export/utils/exportHtmlCss";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";

/*
 * BC-09.3 — the Pagination section in the real browser: keyboard-driven
 * management, Canvas and Structure panel in sync, Undo/Redo; Preview and
 * the exported page (no interaction on the current page or the ellipsis,
 * correct First/Previous/Next/Last destinations); responsive wrapping.
 */

const SURFACE = "[data-document-surface]";
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector panel" });
const pages = (page: Page) => inspector(page).getByRole("list", { name: "Pages" });

/** The nav's children as rendered: "text|href|aria-current|aria-disabled". */
function rendered(nav: Locator) {
  return nav.evaluate((element) =>
    Array.from(element.children).map((child) =>
      [child.tagName.toLowerCase(), (child.textContent ?? "").trim(), child.getAttribute("href") ?? "-", child.getAttribute("aria-current") ?? "-", child.getAttribute("aria-disabled") ?? "-"].join("|"),
    ),
  );
}

test("manage a Pagination from the keyboard; Canvas, Structure panel and Undo/Redo stay in sync", async ({ page }) => {
  await gotoApp(page);
  await page.getByRole("button", { name: "Components" }).click();
  await page.getByRole("menuitem", { name: /^Pagination/ }).click();
  const nav = page.locator(`${SURFACE} [data-node-type="nav"]`).last();
  await expect(inspector(page).getByRole("button", { name: "Pagination", exact: true })).toBeVisible();

  // Add a page with Enter, make page 3 current with Space, set two destinations.
  await inspector(page).getByRole("button", { name: "Add page" }).focus();
  await page.keyboard.press("Enter");
  await expect(pages(page).getByRole("listitem")).toHaveCount(4);
  await inspector(page).getByRole("button", { name: "Set page 3 as the current page" }).focus();
  await page.keyboard.press("Space");
  for (const [position, href] of [[2, "/blog/2"], [4, "/blog/4"]] as const) {
    const field = inspector(page).getByRole("textbox", { name: `Page ${position} destination` });
    await field.fill(href);
    await field.press("Enter");
  }
  // An unsafe destination is refused and the stored one kept.
  const page1 = inspector(page).getByRole("textbox", { name: "Page 1 destination" });
  await page1.fill("javascript:alert(1)");
  await page1.press("Enter");
  await expect(inspector(page).getByRole("alert")).toBeVisible();
  await expect(page1).toHaveValue("#");
  // First and Last on, with the keyboard.
  await inspector(page).getByRole("switch", { name: "Show First" }).focus();
  await page.keyboard.press("Space");
  await inspector(page).getByRole("switch", { name: "Show Last" }).focus();
  await page.keyboard.press("Enter");

  const expected = [
    "a|First|#|-|-",
    "a|Previous|/blog/2|-|-",
    "a|1|#|-|-",
    "a|2|/blog/2|-|-",
    "a|3|-|page|-",
    "a|4|/blog/4|-|-",
    "a|Next|/blog/4|-|-",
    "a|Last|/blog/4|-|-",
  ];
  expect(await rendered(nav)).toEqual(expected);
  await expect(page.locator(`${SURFACE} [aria-current="page"]`)).toHaveCount(1);

  // The Structure panel names the Pagination and its controls.
  await page.getByRole("tab", { name: "Structure" }).click();
  const tree = page.getByRole("tree", { name: "Page structure" });
  const paginationRow = tree.getByRole("treeitem", { name: /Pagination$/ });
  await expect(paginationRow).toHaveAttribute("aria-selected", "true");
  await expect(tree.getByRole("treeitem", { name: "First page" })).toBeVisible();
  await expect(tree.getByRole("treeitem", { name: "Previous page" })).toBeVisible();
  await expect(tree.getByRole("treeitem", { name: "Last page" })).toBeVisible();

  // Selecting the current page on the Canvas shows its own Link section.
  await nav.locator("> a", { hasText: /^3$/ }).click({ force: true });
  await expect(inspector(page).getByRole("textbox", { name: "Link destination" })).toHaveValue("#");
  await expect(inspector(page).getByRole("button", { name: "Pagination", exact: true })).toHaveCount(0);

  // Undo removes Last, Redo puts it back, the markup follows.
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect(await rendered(nav)).toEqual(expected.slice(0, 7));
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await rendered(nav)).toEqual(expected);
});

/** A managed Pagination: 12 pages, First/Last, ellipsis, page 6 current, with authored interactions on the current page, the ellipsis and page 5. */
function managedDocument(): EditorElementNode {
  const nav = { ...createPaginationNode(), id: "nav-managed" };
  let root: EditorElementNode = { id: "page-root", tag: "page", children: [nav] };
  for (let count = 3; count < 12; count++) root = addPaginationPage(root, nav.id);
  root = setPaginationControlVisible(root, nav.id, "first", true);
  root = setPaginationControlVisible(root, nav.id, "last", true);
  root = setPaginationControlVisible(root, nav.id, "ellipsis", true);
  let pageNodes = getPaginationParts(root.children![0]).pages;
  root = setPaginationPageLabel(root, nav.id, pageNodes[11].id, "40");
  pageNodes.forEach((pageNode, index) => {
    // Page 5 links within the page, so activating it on the export runs its interaction without leaving.
    root = setPaginationPageHref(root, nav.id, pageNode.id, index === 4 ? "#page-5" : `/blog/page/${index + 1}`);
  });
  pageNodes = getPaginationParts(root.children![0]).pages;
  root = setPaginationCurrentPage(root, nav.id, pageNodes[5].id);
  const managed = root.children![0];
  const { pages: finalPages, controls } = getPaginationParts(managed);
  const toggle = (id: string, target: string) => [{ id, trigger: "click" as const, action: "toggle" as const, targetId: target }];
  const withInteractions = (managed.children ?? []).map((child) => {
    if (child.id === finalPages[5].id) return { ...child, id: "page-current", interactions: toggle("i-1", "panel-current") };
    if (child.id === finalPages[4].id) return { ...child, id: "page-5", interactions: toggle("i-2", "panel-5") };
    if (child.id === controls.ellipsis?.id) return { ...child, id: "dots", interactions: toggle("i-3", "panel-current") };
    return child;
  });
  const hidden = (id: string): EditorElementNode => ({ id, tag: "p", text: `Panel ${id}`, initialPreviewVisibility: "hidden" });
  return { id: "page-root", tag: "page", children: [{ ...managed, children: withInteractions }, hidden("panel-current"), hidden("panel-5")] };
}

test("Preview and export: the current page and the ellipsis run nothing, page 5 does; boundary destinations are right", async ({ page, browser }) => {
  const document = managedDocument();
  await gotoApp(page);
  await importDocument(page, document, "panel-5");
  await page.getByRole("button", { name: "Enter Preview" }).click();
  await expect(page.getByRole("button", { name: "Exit Preview" })).toBeVisible();
  const node = (id: string) => page.locator(`${SURFACE} [data-node-id="${id}"]`);
  const startUrl = page.url();
  await node("page-current").click({ force: true });
  await node("dots").click({ force: true });
  await node("page-current").evaluate((element) => (element as HTMLElement).click());
  await expect(node("panel-current")).toBeHidden();
  await node("page-5").click();
  await expect(node("panel-5")).toBeVisible();
  expect(page.url()).toBe(startUrl);
  await page.getByRole("button", { name: "Exit Preview" }).click();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();

  const exported = exportHtmlCss(document, { mode: "standalone", title: "Pagination" });
  expect(exported.ok).toBe(true);
  const exportPage = await browser.newPage();
  await exportPage.setContent(exported.files[0].content);
  const nav = exportPage.getByRole("navigation", { name: "Pagination" });
  const items = await rendered(nav);
  expect(items[0]).toBe("a|First|/blog/page/1|-|-");
  expect(items[1]).toBe("a|Previous|#page-5|-|-");
  expect(items).toContain("a|6|-|page|-");
  expect(items).toContain("p|…|-|-|-");
  expect(items.at(-2)).toBe("a|Next|/blog/page/7|-|-");
  expect(items.at(-1)).toBe("a|Last|/blog/page/12|-|-");
  expect(items.at(-3)).toBe("a|40|/blog/page/12|-|-");
  const current = nav.locator('[aria-current="page"]');
  await current.click({ force: true });
  await current.evaluate((element) => (element as HTMLElement).click());
  await nav.getByText("…").click();
  await expect(exportPage.getByText("Panel panel-current")).toBeHidden();
  await nav.getByRole("link", { name: "5", exact: true }).focus();
  await exportPage.keyboard.press("Enter");
  await expect(exportPage.getByText("Panel panel-5")).toBeVisible();
  // The ellipsis is not focusable or a link.
  await expect(nav.getByRole("link", { name: "…" })).toHaveCount(0);
  await exportPage.close();
});

test("responsive: the managed Pagination wraps without sideways scroll at 320, 375 and 1440 px, on the export and the Canvas", async ({ page, browser }) => {
  const managed = managedDocument();
  const exported = exportHtmlCss(managed, { mode: "standalone" });
  const exportPage = await browser.newPage();
  await exportPage.setContent(exported.files[0].content);
  for (const width of [320, 375, 1440]) {
    await exportPage.setViewportSize({ width, height: 800 });
    const result = await exportPage.locator("nav").evaluate((element) => {
      const box = element.getBoundingClientRect();
      const children = Array.from(element.children).map((child) => child.getBoundingClientRect());
      return {
        sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
        escapes: children.some((rect) => rect.left < box.left - 0.5 || rect.right > box.right + 0.5),
      };
    });
    expect(result, `${width}px`).toEqual({ sideways: false, escapes: false });
  }
  await exportPage.close();

  await gotoApp(page);
  await importDocument(page, managed, "panel-5");
  await page.evaluate(() => {
    const style = document.createElement("style");
    style.textContent = "[data-document-surface] { width: 377px !important; max-width: none !important; }";
    document.head.append(style);
  });
  const escapes = await page.locator(`${SURFACE} [data-node-id="nav-managed"]`).evaluate((element) => {
    const box = element.getBoundingClientRect();
    return Array.from(element.children).some((child) => {
      const rect = child.getBoundingClientRect();
      return rect.left < box.left - 0.5 || rect.right > box.right + 0.5;
    });
  });
  expect(escapes).toBe(false);
});
