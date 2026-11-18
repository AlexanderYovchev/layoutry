import { expect, test, type Locator } from "@playwright/test";
import {
  addPaginationPage,
  setPaginationControlVisible,
  setPaginationCurrentPage,
  setPaginationPageHref,
  setPaginationPageLabel,
} from "../src/features/editor/commands/paginationCommands";
import { createPaginationNode } from "../src/features/editor/factories/navigationCompositions";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { getPaginationParts } from "../src/features/editor/types/pagination";
import { exportHtmlCss } from "../src/features/export/utils/exportHtmlCss";
import { PAGINATION_CHILD_COPY } from "../src/features/inspector/utils/paginationCopy";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";

/*
 * BC-09.4 — what BC-09.2/09.3 left unverified in a browser: the
 * accessibility tree of a fully managed Pagination (ellipsis hidden from
 * assistive technology, names and states of every control), its Tab order,
 * Preview/export markup parity, and the Inspector explanations.
 */

const SURFACE = "[data-document-surface]";

/** 8 pages, First/Last, ellipsis before page "20", page 4 current, real destinations. */
function managedDocument(): EditorElementNode {
  const nav = { ...createPaginationNode(), id: "nav-a11y" };
  let root: EditorElementNode = { id: "page-root", tag: "page", children: [nav] };
  for (let count = 3; count < 8; count++) root = addPaginationPage(root, nav.id);
  for (const role of ["first", "last", "ellipsis"] as const) root = setPaginationControlVisible(root, nav.id, role, true);
  const pages = getPaginationParts(root.children![0]).pages;
  root = setPaginationPageLabel(root, nav.id, pages[7].id, "20");
  pages.forEach((page, index) => {
    root = setPaginationPageHref(root, nav.id, page.id, `/blog/page/${index + 1}`);
  });
  return setPaginationCurrentPage(root, nav.id, pages[3].id);
}

/** The semantic attributes of each child, as rendered (Canvas adds data-* attributes the export doesn't). */
function semantics(nav: Locator) {
  return nav.evaluate((element) =>
    Array.from(element.children).map((child) => {
      const pick = (name: string) => child.getAttribute(name) ?? "";
      return [child.tagName, (child.textContent ?? "").trim(), pick("href"), pick("role"), pick("aria-current"), pick("aria-disabled"), pick("aria-hidden")].join("|");
    }),
  );
}

test("exported page: accessibility tree, Tab order, and the same semantics as Preview", async ({ page, browser, browserName }) => {
  const document = managedDocument();
  const exported = exportHtmlCss(document, { mode: "standalone", title: "Pagination" });
  expect(exported.ok).toBe(true);
  const exportPage = await browser.newPage();
  await exportPage.setContent(exported.files[0].content);
  const nav = exportPage.getByRole("navigation", { name: "Pagination" });

  // The accessibility tree: every link named, the current page not a link,
  // the ellipsis absent, disabled controls marked disabled (none here:
  // page 4 is in the middle, so all four step controls are enabled).
  const tree = await nav.ariaSnapshot();
  expect(tree).not.toContain("…");
  for (const name of ["First", "Previous", "1", "2", "3", "5", "6", "7", "20", "Next", "Last"]) {
    await expect(nav.getByRole("link", { name, exact: true })).toHaveCount(1);
  }
  await expect(nav.getByRole("link", { name: "4", exact: true })).toHaveCount(0);
  await expect(nav.locator('[aria-current="page"]')).toHaveText("4");
  await expect(nav.getByText("…")).toBeVisible();

  // Tab: every enabled link in order; the current page and the ellipsis are skipped.
  if (browserName !== "webkit") {
    const stops: string[] = [];
    for (let index = 0; index < 12; index++) {
      await exportPage.keyboard.press("Tab");
      stops.push(await exportPage.evaluate(() => window.document.activeElement?.textContent?.trim() ?? ""));
    }
    expect(stops.slice(0, 11)).toEqual(["First", "Previous", "1", "2", "3", "5", "6", "7", "20", "Next", "Last"]);
  }

  // Preview renders the same semantics as the export.
  await gotoApp(page);
  await importDocument(page, document, "nav-a11y");
  await page.getByRole("button", { name: "Enter Preview" }).click();
  await expect(page.getByRole("button", { name: "Exit Preview" })).toBeVisible();
  expect(await semantics(page.locator(`${SURFACE} [data-node-id="nav-a11y"]`))).toEqual(await semantics(nav));
  await exportPage.close();
});

test("at the boundaries the step controls are announced as disabled links", async ({ browser }) => {
  const nav = createPaginationNode();
  let root: EditorElementNode = { id: "page-root", tag: "page", children: [nav] };
  for (const role of ["first", "last"] as const) root = setPaginationControlVisible(root, nav.id, role, true);
  const exportPage = await browser.newPage();
  await exportPage.setContent(exportHtmlCss(root, { mode: "standalone" }).files[0].content);
  const landmark = exportPage.getByRole("navigation", { name: "Pagination" });
  for (const name of ["First", "Previous"]) await expect(landmark.getByRole("link", { name, disabled: true })).toHaveCount(1);
  for (const name of ["Next", "Last"]) await expect(landmark.getByRole("link", { name, disabled: false })).toHaveCount(1);
  await exportPage.close();
});

test("the Inspector explains disabled controls, the current page and managed destinations", async ({ page }) => {
  await gotoApp(page);
  await importDocument(page, managedDocument(), "nav-a11y");
  const inspector = page.getByRole("complementary", { name: "Inspector panel" });
  const child = (text: string) => page.locator(`${SURFACE} [data-node-id="nav-a11y"] > *`, { hasText: new RegExp(`^${text}$`) });
  await child("4").click({ force: true });
  await expect(inspector.getByText(PAGINATION_CHILD_COPY.currentPage)).toBeVisible();
  await child("Next").click();
  await expect(inspector.getByText(PAGINATION_CHILD_COPY.managedDestination)).toBeVisible();
  await child("…").click();
  await expect(inspector.getByText(PAGINATION_CHILD_COPY.ellipsis)).toBeVisible();
});
