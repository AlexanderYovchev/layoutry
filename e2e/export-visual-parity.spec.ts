import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { buildExportDocument } from "../src/features/export/utils/buildExportDocument";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { catalogDocument, VISUAL_PARITY_DOCUMENTS } from "../test/fixtures/export/exportFixtureDocuments";
import { comparePngs, compareMeasurements, exportElementKeys, measureCanvas, measureExport } from "./support/exportParity";
import { CANVAS_ROOT, openExport, openInEditor, PAGE_WIDTH } from "./support/exportHarness";

/*
 * EXPORT-1.2 — visual parity between the Canvas document surface (in
 * Preview, which is what export reproduces) and the exported HTML/CSS
 * rendered in a clean page, in both output modes. Same browser, same
 * device scale factor, same width, same fonts, offline assets only.
 * See support/exportHarness.ts for the rendering conditions.
 */

const RESULTS_DIR = path.join("test-results", "export-parity");

const fixtures: Array<{ name: string; build: () => EditorElementNode }> = [...VISUAL_PARITY_DOCUMENTS, { name: "catalog-components", build: catalogDocument }];

for (const fixture of fixtures) {
  test(`export reproduces the Canvas: ${fixture.name}`, async ({ page, context }, testInfo) => {
    test.setTimeout(120_000);
    const document = fixture.build();
    const built = buildExportDocument(document);
    if (!built.ok) throw new Error(JSON.stringify(built.diagnostics));
    const keys = exportElementKeys(built.document.root);

    await openInEditor(page, document);
    const canvasRoot = page.locator(CANVAS_ROOT);
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
      await openExport(exportPage, document, mode, { height: canvasRect.height });
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
