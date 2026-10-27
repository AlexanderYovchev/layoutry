import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, type Page } from "@playwright/test";
import { exportHtmlCss } from "../../src/features/export";
import type { HtmlCssExportMode, HtmlCssExportResult } from "../../src/features/export";
import type { EditorElementNode } from "../../src/features/editor/types/document";
import { serializeProject } from "../../src/features/project/utils/serializeProject";
import { gotoApp } from "./gotoApp";

/*
 * Shared harness for the export parity specs (EXPORT-1.2, EXPORT-1.3):
 * the same document opened in the real editor's Preview and as exported
 * files, under identical rendering conditions.
 *
 * The only test-time control applied to the editor is pinning the page
 * sheet to an integer width (PAGE_WIDTH): the sheet's natural width
 * follows the editor's panels, and a fractional width cannot be
 * reproduced by an integer browser viewport. That is presentation width,
 * not authored content.
 */

export const PAGE_WIDTH = 800;
export const CANVAS_ROOT = '[data-document-surface] [data-node-id="page-root"]';
const EXPORT_ORIGIN = "http://layoutry-export.test";

export interface OpenInEditorOptions {
  /**
   * Hide the Resource and Inspector panels and the status bar (View menu)
   * first. The Canvas contains its document in an isolated stacking
   * context, so editor chrome paints over position: fixed page content
   * near the window edges (a toast at bottom-right); with the panels
   * hidden that content is visible for comparison.
   */
  hideEditorPanels?: boolean;
}

/** Imports `document` through the real project import, pins the sheet width and enters Preview. */
export async function openInEditor(page: Page, document: EditorElementNode, options: OpenInEditorOptions = {}) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await gotoApp(page);
  if (options.hideEditorPanels) {
    for (const panel of ["Resource Panel", "Inspector Panel", "Status Bar"]) {
      await page.getByRole("menuitem", { name: "View" }).click();
      await page.getByRole("menuitemcheckbox", { name: panel }).click();
    }
  }
  const file = serializeProject({ metadata: { id: "00000000-0000-4000-8000-000000000012", name: "Export parity", createdAt: "2026-10-27T00:00:00.000Z", updatedAt: "2026-10-27T00:00:00.000Z" }, document });
  await page.getByTestId("project-import-input").setInputFiles({ name: "parity.layoutry", mimeType: "application/json", buffer: Buffer.from(file) });
  await expect(page.locator(CANVAS_ROOT)).toBeVisible();
  await page.addStyleTag({ content: `[data-document-surface] { width: ${PAGE_WIDTH + 2}px !important; max-width: none !important; }` });
  await page.getByRole("button", { name: "Enter Preview" }).click();
  await expect(page.getByRole("button", { name: "Exit Preview" })).toBeVisible();
  // Tall documents: give the workspace room so nothing is clipped by its scroll container.
  const root = page.locator(CANVAS_ROOT);
  const height = await root.evaluate((element) => element.getBoundingClientRect().height);
  // The workspace centers the sheet, which can land the page on a half
  // pixel; nudge the window until it sits on whole pixels so the
  // screenshot clip neither rounds into the sheet's own border nor
  // shifts how content rasterizes.
  for (let width = 1600; width < 1604; width++) {
    await page.setViewportSize({ width, height: Math.max(1000, Math.ceil(height) + 700) });
    const { x, y } = await root.evaluate((element) => element.getBoundingClientRect());
    if (Number.isInteger(x) && Number.isInteger(y)) break;
  }
  await page.mouse.move(0, 0);
  await settle(page);
}

export async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((image) => (image.complete ? undefined : image.decode().catch(() => undefined))));
  });
}

export interface OpenExportOptions {
  /** Width/height of the export page's viewport. */
  height: number;
  /** Write the files to this directory and open them from disk (file://) instead of serving them. */
  directory?: string;
}

/**
 * Exports `document` and opens it: standalone via setContent, separate from
 * a fake origin serving the exported files — or, with `directory`, both
 * straight from disk over file://.
 */
export async function openExport(page: Page, document: EditorElementNode, mode: HtmlCssExportMode, options: OpenExportOptions): Promise<HtmlCssExportResult> {
  const result = exportHtmlCss(document, { mode, title: "Export parity" });
  expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
  await page.setViewportSize({ width: PAGE_WIDTH, height: Math.ceil(options.height) + 40 });
  if (options.directory) {
    fs.mkdirSync(options.directory, { recursive: true });
    for (const exported of result.files) fs.writeFileSync(path.join(options.directory, exported.path), exported.content);
    await page.goto(pathToFileURL(path.join(options.directory, "index.html")).href);
  } else if (mode === "standalone") {
    await page.setContent(result.files[0].content);
  } else {
    await page.route(`${EXPORT_ORIGIN}/**`, async (route) => {
      const requested = new URL(route.request().url()).pathname.replace(/^\//, "");
      const exported = result.files.find((candidate) => candidate.path === requested);
      await (exported ? route.fulfill({ body: exported.content, contentType: exported.mediaType }) : route.fulfill({ status: 404 }));
    });
    await page.goto(`${EXPORT_ORIGIN}/index.html`);
  }
  await settle(page);
  return result;
}
