import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { buildExportDocument, exportHtmlCss } from "../src/features/export";
import type { HtmlCssExportMode } from "../src/features/export";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { serializeProject } from "../src/features/project/utils/serializeProject";
import { catalogDocument, VISUAL_PARITY_DOCUMENTS } from "../test/fixtures/export/exportFixtureDocuments";
import { comparePngs, compareMeasurements, exportElementKeys, measureCanvas, measureExport } from "./support/exportParity";
import { gotoApp } from "./support/gotoApp";

/*
 * EXPORT-1.2 — visual parity between the Canvas document surface (in
 * Preview, which is what export reproduces) and the exported HTML/CSS
 * rendered in a clean page, in both output modes. Same browser, same
 * device scale factor, same width, same fonts, offline assets only.
 *
 * The only test-time control applied to the editor is pinning the page
 * sheet to an integer width (PAGE_WIDTH): the sheet's natural width
 * follows the editor's panels, and a fractional width cannot be
 * reproduced by an integer browser viewport. That is presentation width,
 * not authored content.
 */

const PAGE_WIDTH = 800;
const RESULTS_DIR = path.join("test-results", "export-parity");
const EXPORT_ORIGIN = "http://layoutry-export.test";

const fixtures: Array<{ name: string; build: () => EditorElementNode }> = [...VISUAL_PARITY_DOCUMENTS, { name: "catalog-components", build: catalogDocument }];

async function openInEditor(page: Page, document: EditorElementNode) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await gotoApp(page);
  const file = serializeProject({ metadata: { id: "00000000-0000-4000-8000-000000000012", name: "Export parity", createdAt: "2026-10-27T00:00:00.000Z", updatedAt: "2026-10-27T00:00:00.000Z" }, document });
  await page.getByTestId("project-import-input").setInputFiles({ name: "parity.layoutry", mimeType: "application/json", buffer: Buffer.from(file) });
  await expect(page.locator('[data-document-surface] [data-node-id="page-root"]')).toBeVisible();
  await page.addStyleTag({ content: `[data-document-surface] { width: ${PAGE_WIDTH + 2}px !important; max-width: none !important; }` });
  await page.getByRole("button", { name: "Enter Preview" }).click();
  await expect(page.getByRole("button", { name: "Exit Preview" })).toBeVisible();
  // Tall documents: give the workspace room so nothing is clipped by its scroll container.
  const root = page.locator('[data-document-surface] [data-node-id="page-root"]');
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

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((image) => (image.complete ? undefined : image.decode().catch(() => undefined))));
  });
}

async function openExport(page: Page, document: EditorElementNode, mode: HtmlCssExportMode, height: number) {
  const result = exportHtmlCss(document, { mode, title: "Export parity" });
  expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
  await page.setViewportSize({ width: PAGE_WIDTH, height: Math.ceil(height) + 40 });
  if (mode === "standalone") {
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

for (const fixture of fixtures) {
  test(`export reproduces the Canvas: ${fixture.name}`, async ({ page, context }, testInfo) => {
    test.setTimeout(120_000);
    const document = fixture.build();
    const built = buildExportDocument(document);
    if (!built.ok) throw new Error(JSON.stringify(built.diagnostics));
    const keys = exportElementKeys(built.document.root);

    await openInEditor(page, document);
    const canvasRoot = page.locator('[data-document-surface] [data-node-id="page-root"]');
    const canvasRect = await canvasRoot.evaluate((element) => element.getBoundingClientRect().toJSON() as DOMRect);
    expect(canvasRect.width).toBe(PAGE_WIDTH);
    const canvasPng = await canvasRoot.screenshot({ animations: "disabled", caret: "hide" });
    const canvasElements = await measureCanvas(page);
    const canvasRootStyle = await canvasRoot.evaluate((element) => {
      const computed = getComputedStyle(element);
      return Object.fromEntries(["font-family", "font-size", "line-height", "letter-spacing", "font-weight", "-webkit-font-smoothing", "color-scheme", "text-align", "white-space", "direction"].map((property) => [property, computed.getPropertyValue(property)]));
    });

    const outcomes: Array<{ mode: string; rootMatches: boolean; exportRootStyle: Record<string, string>; differences: unknown[]; pixels: { sameSize: boolean; tolerantSimilarity: number } }> = [];
    const report: Record<string, unknown> = { fixture: fixture.name, pageWidth: PAGE_WIDTH, canvasHeight: canvasRect.height, elements: canvasElements.length, modes: {} };
    for (const mode of ["standalone", "separate"] as const) {
      const exportPage = await context.newPage();
      await openExport(exportPage, document, mode, canvasRect.height);
      const exportRoot = exportPage.locator("body > div").first();
      const exportPng = await exportRoot.screenshot({ animations: "disabled", caret: "hide" });
      const exportElements = await measureExport(exportPage, keys);
      const exportRootStyle = await exportRoot.evaluate((element) => {
        const computed = getComputedStyle(element);
        return Object.fromEntries(["font-family", "font-size", "line-height", "letter-spacing", "font-weight", "-webkit-font-smoothing", "color-scheme", "text-align", "white-space", "direction"].map((property) => [property, computed.getPropertyValue(property)]));
      });

      const pixels = await comparePngs(exportPage, canvasPng, exportPng);
      const properties = compareMeasurements(canvasElements, exportElements);
      await testInfo.attach(`${mode}-export.png`, { body: exportPng, contentType: "image/png" });
      await testInfo.attach(`${mode}-diff.png`, { body: Buffer.from(pixels.diffPng, "base64"), contentType: "image/png" });
      fs.mkdirSync(RESULTS_DIR, { recursive: true });
      fs.writeFileSync(path.join(RESULTS_DIR, `${fixture.name}-${mode}-export.png`), exportPng);
      fs.writeFileSync(path.join(RESULTS_DIR, `${fixture.name}-${mode}-diff.png`), Buffer.from(pixels.diffPng, "base64"));
      (report.modes as Record<string, unknown>)[mode] = {
        sameSize: pixels.sameSize,
        size: `${pixels.width}x${pixels.height}`,
        exactSimilarity: pixels.exactSimilarity,
        tolerantSimilarity: pixels.tolerantSimilarity,
        differingPixels: pixels.differingPixels,
        comparedElements: properties.compared,
        propertyChecks: properties.propertyChecks,
        maxGeometryDelta: properties.maxGeometryDelta,
        differences: properties.differences,
        inheritedRootStyle: { canvas: canvasRootStyle, exported: exportRootStyle },
      };

      outcomes.push({ mode, rootMatches: JSON.stringify(exportRootStyle) === JSON.stringify(canvasRootStyle), exportRootStyle, differences: properties.differences, pixels });
      await exportPage.close();
    }

    await testInfo.attach("canvas.png", { body: canvasPng, contentType: "image/png" });
    fs.writeFileSync(path.join(RESULTS_DIR, `${fixture.name}-canvas.png`), canvasPng);
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(RESULTS_DIR, `${fixture.name}.json`), JSON.stringify(report, null, 2));

    // Assert only after the full report is written, so one run shows every difference.
    for (const outcome of outcomes) {
      expect(outcome.exportRootStyle, `${outcome.mode}: inherited page-root style`).toEqual(canvasRootStyle);
      expect(outcome.differences, `${outcome.mode}: computed style/geometry differences`).toEqual([]);
      expect(outcome.pixels.sameSize, `${outcome.mode}: screenshot size`).toBe(true);
      expect(outcome.pixels.tolerantSimilarity, `${outcome.mode}: pixel similarity`).toBeGreaterThanOrEqual(0.99);
    }
  });
}
