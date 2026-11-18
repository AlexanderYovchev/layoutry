import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createPaginationNode } from "../src/features/editor/factories/navigationCompositions";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { exportHtmlCss } from "../src/features/export/utils/exportHtmlCss";
import { gotoApp } from "./support/gotoApp";
import { canvasNode } from "./support/inspector";
import { importDocument } from "./support/parityFixtures";

/*
 * BC-09.2 — the new Pagination foundation in a real browser: insertion
 * from Components, accessible markup on the Canvas, in Preview and on the
 * exported page, no navigation from disabled or current controls (even
 * without JavaScript), keyboard order, responsive wrapping, and an old
 * (format 2) Pagination opening unchanged.
 */

const SURFACE = "[data-document-surface]";
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector panel" });
const surfaceNav = (page: Page) => page.locator(`${SURFACE} nav`);

async function insertPagination(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Components" }).click();
  await page.getByRole("menuitem", { name: /^Pagination/ }).click();
  const nav = page.locator(`${SURFACE} [data-node-type="nav"]`).last();
  await expect(nav).toBeVisible();
  const id = await nav.getAttribute("data-node-id");
  if (!id) throw new Error("Pagination was not inserted");
  return id;
}

/** The accessibility-relevant attributes of each direct child, as rendered. */
function controls(nav: Locator) {
  return nav.evaluate((element) =>
    Array.from(element.children)
      .filter((child) => child.tagName === "A" || child.tagName === "BUTTON")
      .map((child) => ({
        tag: child.tagName.toLowerCase(),
        text: (child.textContent ?? "").trim(),
        href: child.getAttribute("href"),
        current: child.getAttribute("aria-current"),
        role: child.getAttribute("role"),
        disabled: child.getAttribute("aria-disabled"),
      })),
  );
}

const EXPECTED_CONTROLS = [
  { tag: "a", text: "Previous", href: null, current: null, role: "link", disabled: "true" },
  { tag: "a", text: "1", href: null, current: "page", role: null, disabled: null },
  { tag: "a", text: "2", href: "#", current: null, role: null, disabled: null },
  { tag: "a", text: "3", href: "#", current: null, role: null, disabled: null },
  { tag: "a", text: "Next", href: "#", current: null, role: null, disabled: null },
];

/** The new Pagination with `pages` page links (copies of page 2, numbered), for the responsive check. */
function paginationWithPages(pages: number): EditorElementNode {
  const pagination = createPaginationNode();
  const children = pagination.children!;
  const template = children[2];
  const extra = Array.from({ length: pages - 3 }, (_, index) => ({ ...template, id: `a-page-${index + 4}`, text: String(index + 4) }));
  return { ...pagination, id: "nav-many", children: [...children.slice(0, 4), ...extra, children[4]] };
}

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
});

test("inserts the new Pagination: labelled nav, one current page, disabled Previous; selectable children; one Undo step", async ({ page }) => {
  const navId = await insertPagination(page);
  const nav = canvasNode(page, navId);
  await expect(page.locator(SURFACE).getByRole("navigation", { name: "Pagination" })).toBeVisible();
  expect(await controls(nav)).toEqual(EXPECTED_CONTROLS);
  // The generic Navigation links section is not offered for a marked Pagination.
  await expect(inspector(page).getByRole("button", { name: "Navigation links" })).toHaveCount(0);

  // Every child is still an ordinary, selectable Link with its own Link section.
  const startUrl = page.url();
  for (const text of ["Previous", "1", "Next"]) {
    const child = nav.locator(`> a`, { hasText: new RegExp(`^${text}$`) });
    const id = await child.getAttribute("data-node-id");
    if (!id) throw new Error(text);
    // force: Playwright refuses to click an aria-disabled element; a user can.
    await canvasNode(page, id).click({ position: { x: 5, y: 5 }, force: true });
    // The Inspector follows: this Link's own Link section, with its stored href.
    await expect(inspector(page).getByRole("textbox", { name: "Link destination" })).toHaveValue("#");
    await expect(inspector(page).getByRole("button", { name: "Navigation links" })).toHaveCount(0);
  }
  expect(page.url()).toBe(startUrl);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(surfaceNav(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  expect(await controls(canvasNode(page, navId))).toEqual(EXPECTED_CONTROLS);
});

test("Preview shows the same semantics, never navigates, and leaves the document unchanged", async ({ page }) => {
  const navId = await insertPagination(page);
  await page.getByRole("button", { name: "Enter Preview" }).click();
  await expect(page.getByRole("button", { name: "Exit Preview" })).toBeVisible();
  const nav = canvasNode(page, navId);
  expect(await controls(nav)).toEqual(EXPECTED_CONTROLS);
  const startUrl = page.url();
  for (const text of ["Previous", "1", "2", "Next"]) await nav.locator("> a", { hasText: new RegExp(`^${text}$`) }).click({ force: true });
  expect(page.url()).toBe(startUrl);
  await page.getByRole("button", { name: "Exit Preview" }).click();
  expect(await controls(canvasNode(page, navId))).toEqual(EXPECTED_CONTROLS);
});

test("the exported page: named landmark, current page announced, disabled Previous inert without JavaScript, keyboard skips both", async ({ page, browser, browserName }) => {
  const navId = await insertPagination(page);
  await page.getByRole("button", { name: "Export Code" }).click();
  const dialog = page.getByRole("dialog", { name: "Export Code" });
  const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Download index.html" }).click()]);
  const html = fs.readFileSync(await download.path(), "utf8");
  expect(html).not.toContain("<script");
  expect(html).toContain('aria-label="Pagination"');
  expect(navId).toBeTruthy();

  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "layoutry-pagination-"));
  // JavaScript off: nothing but the HTML itself can keep the controls inert.
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    fs.writeFileSync(path.join(folder, "index.html"), html);
    const exported = await context.newPage();
    const url = pathToFileURL(path.join(folder, "index.html")).href;
    await exported.goto(url);
    const nav = exported.getByRole("navigation", { name: "Pagination" });
    await expect(nav).toBeVisible();
    expect(await controls(nav)).toEqual(EXPECTED_CONTROLS);
    // Accessible names and roles as a screen reader gets them.
    await expect(nav.getByRole("link", { name: "Previous" })).toHaveAttribute("aria-disabled", "true");
    await expect(nav.getByRole("link", { name: "1", exact: true })).toHaveCount(0);
    await expect(nav.locator('[aria-current="page"]')).toHaveText("1");

    await nav.getByText("Previous").click({ force: true });
    await nav.getByText("1", { exact: true }).click({ force: true });
    expect(exported.url()).toBe(url);

    // Tab: 2 → 3 → Next. Previous and the current page are not stops.
    // Playwright's Windows WebKit doesn't Tab to links (known since BC-06.2).
    if (browserName !== "webkit") {
      const stops: string[] = [];
      for (let index = 0; index < 3; index++) {
        await exported.keyboard.press("Tab");
        stops.push(await exported.evaluate(() => document.activeElement?.textContent?.trim() ?? ""));
      }
      expect(stops).toEqual(["2", "3", "Next"]);
    }
  } finally {
    await context.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

test("wraps by default: 12 pages never push the exported page sideways or escape the nav", async ({ browser }) => {
  const manyPages: EditorElementNode = { id: "page-root", tag: "page", children: [paginationWithPages(12)] };
  const exported = exportHtmlCss(manyPages, { mode: "standalone", title: "Pagination" });
  expect(exported.ok).toBe(true);
  const exportPage = await browser.newPage();
  await exportPage.setContent(exported.files[0].content);
  for (const width of [320, 375, 768, 1024, 1440]) {
    await exportPage.setViewportSize({ width, height: 800 });
    const result = await exportPage.locator("nav").evaluate((element) => {
      const box = element.getBoundingClientRect();
      const children = Array.from(element.children).map((child) => child.getBoundingClientRect());
      return {
        sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
        escapes: children.some((rect) => rect.left < box.left - 0.5 || rect.right > box.right + 0.5),
        // Rows by vertical centre: Previous/Next are 34 px tall, page links 36 px, centred.
        rows: new Set(children.map((rect) => Math.round((rect.top + rect.bottom) / 2))).size,
        smallest: Math.min(...children.map((rect) => Math.min(rect.width, rect.height))),
      };
    });
    expect(result.sideways, `${width}px sideways`).toBe(false);
    expect(result.escapes, `${width}px escapes`).toBe(false);
    // WCAG 2.5.8: every control at least 24 × 24 CSS px.
    expect(result.smallest, `${width}px target size`).toBeGreaterThanOrEqual(24);
    if (width >= 768) expect(result.rows, `${width}px rows`).toBe(1);
    else expect(result.rows, `${width}px rows`).toBeGreaterThan(1);
  }
  await exportPage.close();
});

test("the default Pagination fits one row on a 320 px page", async ({ browser }) => {
  const exported = exportHtmlCss({ id: "page-root", tag: "page", children: [createPaginationNode()] }, { mode: "standalone" });
  const exportPage = await browser.newPage({ viewport: { width: 320, height: 600 } });
  await exportPage.setContent(exported.files[0].content);
  const rows = await exportPage.locator("nav > a").evaluateAll((links) => new Set(links.map((link) => { const rect = link.getBoundingClientRect(); return Math.round((rect.top + rect.bottom) / 2); })).size);
  expect(rows).toBe(1);
  expect(await exportPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
  await exportPage.close();
});

test("an old (format 2) Pagination opens unchanged: Buttons, no marker, the generic Navigation links section", async ({ page }) => {
  const fixture = fs.readFileSync(path.join("test", "fixtures", "persistence", "project-2-legacy-pagination.layoutry"));
  await page.getByTestId("project-import-input").setInputFiles({ name: "legacy.layoutry", mimeType: "application/json", buffer: fixture });
  const navs = page.locator(`${SURFACE} nav`);
  await expect(navs).toHaveCount(3);
  const legacy = navs.nth(2);
  expect((await controls(legacy)).map(({ tag, text, href, current, role, disabled }) => [tag, text, href, current, role, disabled])).toEqual([
    ["button", "Previous", null, null, null, null],
    ["a", "1", "#", null, null, null],
    ["a", "2", "#", null, null, null],
    ["a", "3", "#", null, null, null],
    ["button", "Next", null, null, null, null],
  ]);
  for (let index = 0; index < 3; index++) expect(await navs.nth(index).getAttribute("aria-label")).toBeNull();
  const id = await legacy.getAttribute("data-node-id");
  if (!id) throw new Error("legacy nav");
  // Click the gap between Previous and 1: that selects the nav itself.
  const gap = await legacy.evaluate((element) => {
    const nav = element.getBoundingClientRect();
    const [first, second] = Array.from(element.children).map((child) => child.getBoundingClientRect());
    return { x: (first.right + second.left) / 2 - nav.left, y: nav.height / 2 };
  });
  await legacy.click({ position: gap });
  await expect(inspector(page).getByRole("button", { name: "Navigation links" })).toBeVisible();
});

test("a Pagination inside a Flex container and a Free-layout container keeps its semantics", async ({ page }) => {
  const inFlex = { ...createPaginationNode(), id: "nav-flex" };
  const inFree = { ...createPaginationNode(), id: "nav-free", freeLayout: { x: 16, y: 16, width: 320, height: 48 } };
  const document: EditorElementNode = {
    id: "page-root",
    tag: "page",
    children: [
      { id: "flex-box", tag: "div", flowLayout: { display: "flex", flex: { direction: "column", wrap: "nowrap", justifyContent: "start", alignItems: "stretch", rowGap: 8, columnGap: 8 } }, children: [inFlex] },
      { id: "free-box", tag: "div", layoutMode: "free", dimensions: { preferredWidth: 480, preferredHeight: 120, offsetX: 0, offsetY: 0 }, children: [inFree] },
    ],
  };
  await importDocument(page, document, "nav-free");
  for (const id of ["nav-flex", "nav-free"]) {
    await expect(page.locator(SURFACE).getByRole("navigation", { name: "Pagination" })).toHaveCount(2);
    expect(await controls(canvasNode(page, id))).toEqual(EXPECTED_CONTROLS);
  }
});
