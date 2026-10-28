import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Download, type Page } from "@playwright/test";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { exportHtmlCss } from "../src/features/export/utils/exportHtmlCss";
import type { HtmlCssExportMode } from "../src/features/export/types/exportResult";
import { serializeProject } from "../src/features/project/utils/serializeProject";
import { gotoApp } from "./support/gotoApp";

/*
 * EXPORT-1.4 — the user-facing export workflow in the real editor: File ›
 * Export Code… / the header's Export button, the code preview, copy,
 * browser downloads, diagnostics, stale previews and accessibility. Every
 * expectation about generated code compares against exportHtmlCss for the
 * same document, the engine the parity suites already validate — never a
 * mock.
 */

const PROJECT_NAME = "Export workflow";
const UNSAFE_TEXT = '<img src=x onerror="window.__exportRan=1"><script>window.__exportRan=1</script>';

const workflowDocument: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "heading-1", tag: "h1", text: "Hello from Layoutry" },
    { id: "p-unsafe", tag: "p", text: UNSAFE_TEXT },
    { id: "p-long", tag: "p", text: `A very long line ${"word ".repeat(120)}` },
    { id: "toggle-1", tag: "button", text: "Toggle details", interactions: [{ id: "i-1", trigger: "click", action: "toggle", targetId: "details-1" }] },
    { id: "details-1", tag: "div", initialPreviewVisibility: "hidden", children: [{ id: "p-details", tag: "p", text: "Details shown" }] },
    { id: "image-1", tag: "img" },
  ],
};

function expected(document: EditorElementNode, mode: HtmlCssExportMode) {
  const result = exportHtmlCss(document, { mode, title: PROJECT_NAME });
  expect(result.ok).toBe(true);
  return result;
}

async function importDocument(page: Page, document: EditorElementNode) {
  const file = serializeProject({
    metadata: { id: "00000000-0000-4000-8000-000000000014", name: PROJECT_NAME, createdAt: "2026-10-28T00:00:00.000Z", updatedAt: "2026-10-28T00:00:00.000Z" },
    document,
  });
  await page.getByTestId("project-import-input").setInputFiles({ name: "workflow.layoutry", mimeType: "application/json", buffer: Buffer.from(file) });
  const last = document.children?.at(-1)?.id;
  if (last) await expect(page.locator(`[data-document-surface] [data-node-id="${last}"]`)).toBeAttached({ timeout: 120_000 });
}

function exportDialog(page: Page) {
  return page.getByRole("dialog", { name: "Export Code" });
}

async function openExport(page: Page) {
  await page.getByRole("button", { name: "Export Code" }).click();
  await expect(exportDialog(page).getByTestId("export-code")).toBeVisible();
}

async function previewText(page: Page) {
  return (await exportDialog(page).getByTestId("export-code").textContent()) ?? "";
}

async function downloadedText(download: Download) {
  const filePath = await download.path();
  return fs.readFileSync(filePath, "utf8");
}

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
});

test("opens from File › Export Code… and the header, previews every file and closes with focus restored", async ({ page }) => {
  await importDocument(page, workflowDocument);
  await page.getByRole("menuitem", { name: "File" }).click();
  await page.getByRole("menuitem", { name: "Export Code…" }).click();
  const dialog = exportDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Generate HTML and CSS from your Canvas design.")).toBeVisible();
  await expect(dialog.getByText("HTML + CSS", { exact: true })).toBeVisible();
  expect(await previewText(page)).toBe(expected(workflowDocument, "standalone").files[0].content);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  const exportButton = page.getByRole("button", { name: "Export Code" });
  await exportButton.click();
  await expect(dialog.getByTestId("export-code")).toBeVisible();
  await dialog.getByLabel("Separate files").check();
  const separate = expected(workflowDocument, "separate");
  await expect(dialog.getByRole("tab")).toHaveCount(3);
  for (const file of separate.files) {
    await dialog.getByRole("tab", { name: new RegExp(`^${file.path.replace(".", "\\.")}`) }).click();
    expect(await previewText(page)).toBe(file.content);
  }
  await expect(dialog.getByTestId("export-keep-together")).toHaveText(/Keep index\.html, styles\.css and script\.js together in one folder/);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(exportButton).toBeFocused();
});

test("shows generated markup as inert text and lists the engine's diagnostics", async ({ page }) => {
  await importDocument(page, workflowDocument);
  await openExport(page);
  const code = exportDialog(page).getByTestId("export-code");
  expect(await code.evaluate((element) => element.childElementCount)).toBe(0);
  expect(await previewText(page)).toContain("&lt;script&gt;window.__exportRan=1&lt;/script&gt;");
  expect(await page.evaluate(() => Reflect.get(window, "__exportRan"))).toBeUndefined();
  const diagnostics = exportDialog(page).getByRole("list", { name: "Export diagnostics" });
  await expect(diagnostics.locator("li")).toHaveCount(expected(workflowDocument, "standalone").diagnostics.length);
  await expect(diagnostics).toContainText("Warning: The image has no source");
  await expect(diagnostics).toContainText("Element: Image (img) · Property: src");
});

test("copies the exact text of the selected file", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await importDocument(page, workflowDocument);
  await openExport(page);
  const dialog = exportDialog(page);
  await dialog.getByLabel("Separate files").check();
  await dialog.getByRole("tab", { name: /^styles\.css/ }).click();
  // Records exactly what Layoutry hands the clipboard.
  await page.evaluate(() => {
    const original = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = (text: string) => {
      Reflect.set(window, "__copied", text);
      return original(text);
    };
  });
  await dialog.getByRole("button", { name: "Copy code" }).click();
  await expect(dialog.getByTestId("export-transfer-status")).toHaveText("Copied styles.css to the clipboard.");
  const css = expected(workflowDocument, "separate").files[1].content;
  expect(await page.evaluate(() => Reflect.get(window, "__copied"))).toBe(css);
  // Windows stores clipboard text with CRLF line endings; the text is otherwise identical.
  expect((await page.evaluate(() => navigator.clipboard.readText())).replaceAll("\r\n", "\n")).toBe(css);
});

test("downloads a single HTML file that works offline from disk", async ({ page, context }) => {
  await importDocument(page, workflowDocument);
  await openExport(page);
  const dialog = exportDialog(page);
  const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Download index.html" }).click()]);
  expect(download.suggestedFilename()).toBe("index.html");
  const html = await downloadedText(download);
  expect(html).toBe(expected(workflowDocument, "standalone").files[0].content);
  await expect(dialog.getByTestId("export-transfer-status")).toContainText("Download of index.html started");

  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "layoutry-export-download-"));
  try {
    fs.writeFileSync(path.join(folder, "index.html"), html);
    const exported = await context.newPage();
    const requests: string[] = [];
    exported.on("request", (request) => requests.push(request.url()));
    await context.setOffline(true);
    await exported.goto(pathToFileURL(path.join(folder, "index.html")).href);
    await expect(exported.getByText("Details shown")).toBeHidden();
    await exported.getByRole("button", { name: "Toggle details" }).click();
    await expect(exported.getByText("Details shown")).toBeVisible();
    expect(requests.filter((url) => !url.startsWith("file:"))).toEqual([]);
    await context.setOffline(false);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

test("downloads separate files one by one or all together, and they work together offline", async ({ page, context }) => {
  await importDocument(page, workflowDocument);
  await openExport(page);
  const dialog = exportDialog(page);
  await dialog.getByLabel("Separate files").check();
  const separate = expected(workflowDocument, "separate");

  await dialog.getByRole("tab", { name: /^script\.js/ }).click();
  const [single] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Download script.js" }).click()]);
  expect(single.suggestedFilename()).toBe("script.js");
  expect(await downloadedText(single)).toBe(separate.files[2].content);

  const downloads: Download[] = [];
  page.on("download", (download) => downloads.push(download));
  await dialog.getByRole("button", { name: "Download all files" }).click();
  await expect.poll(() => downloads.length).toBe(3);
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "layoutry-export-downloads-"));
  try {
    for (const download of downloads) {
      const file = separate.files.find((candidate) => candidate.path === download.suggestedFilename());
      expect(file, download.suggestedFilename()).toBeDefined();
      const text = await downloadedText(download);
      expect(text).toBe(file?.content);
      fs.writeFileSync(path.join(folder, download.suggestedFilename()), text);
    }
    await context.setOffline(true);
    const exported = await context.newPage();
    await exported.goto(pathToFileURL(path.join(folder, "index.html")).href);
    // styles.css loaded by relative path: its heading rule (30px), not the browser default h1 (32px).
    await expect(exported.getByRole("heading", { name: "Hello from Layoutry" })).toHaveCSS("font-size", "30px");
    await expect(exported.getByText("Details shown")).toBeHidden();
    await exported.getByRole("button", { name: "Toggle details" }).click();
    await expect(exported.getByText("Details shown")).toBeVisible();
    await context.setOffline(false);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

test("exports unsaved edits, marks the preview stale after a change, regenerates, and never touches the project's saved state", async ({ page }) => {
  await importDocument(page, { id: "page-root", tag: "page", children: [{ id: "heading-1", tag: "h1", text: "Before" }] });
  const status = page.locator("[data-project-status]");
  // An unsaved edit: insert a Divider from the catalog.
  await page.getByRole("button", { name: "Divider" }).first().click();
  await expect(page.locator("[data-document-surface] hr")).toHaveCount(1);
  await expect(status).toHaveAttribute("data-project-status", "unsaved");

  await openExport(page);
  const dialog = exportDialog(page);
  expect(await previewText(page)).toContain("<hr");

  // Undo with the dialog open changes the document under it.
  await page.keyboard.press("Control+z");
  await expect(page.locator("[data-document-surface] hr")).toHaveCount(0);
  await expect(dialog.getByTestId("export-stale")).toContainText("The design changed after this code was generated");
  await expect(dialog.getByRole("button", { name: "Download index.html" })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Copy code" })).toBeDisabled();
  expect(await previewText(page)).toContain("<hr");

  await dialog.getByRole("button", { name: "Regenerate" }).click();
  await expect(dialog.getByTestId("export-stale")).toBeHidden();
  expect(await previewText(page)).not.toContain("<hr");
  const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Download index.html" }).click()]);
  expect(await downloadedText(download)).not.toContain("<hr");
  await dialog.getByRole("button", { name: "Cancel" }).click();

  // Exporting saved nothing: the status is whatever the edits made it, and no save toast appeared.
  await expect(page.getByRole("status", { name: "Project status" })).toBeEmpty();
  const statusAfter = await status.getAttribute("data-project-status");
  expect(statusAfter === "saved" || statusAfter === "new").toBe(true);
});

test("is fully keyboard operable: focus starts inside, stays trapped, and Escape returns it", async ({ page }) => {
  await importDocument(page, workflowDocument);
  const exportButton = page.getByRole("button", { name: "Export Code" });
  await exportButton.focus();
  await page.keyboard.press("Enter");
  const dialog = exportDialog(page);
  await expect(dialog.getByTestId("export-code")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();

  const visited = new Set<string>();
  for (let index = 0; index < 24; index++) {
    await page.keyboard.press("Tab");
    const where = await page.evaluate(() => {
      const active = document.activeElement;
      const dialogElement = document.querySelector("dialog[open]");
      // <body> is where focus sits while Tab passes through the browser's own UI.
      return { inside: !!active && (active === document.body || !!dialogElement?.contains(active)), label: active?.getAttribute("aria-label") ?? active?.textContent?.trim().slice(0, 20) ?? "" };
    });
    // Focus may pass through the browser's own UI, but never the editor behind the dialog.
    if (where.label !== "") expect(where.inside, where.label).toBe(true);
    visited.add(where.label);
  }
  for (const label of ["Close", "Copy code", "Download index.html", "index.html source code", "Export diagnostics"]) expect([...visited]).toContain(label);

  // Output options are a radio group: arrow keys choose.
  await dialog.getByLabel("Single HTML file").focus();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByLabel("Separate files")).toBeChecked();
  await expect(dialog.getByRole("tab")).toHaveCount(3);
  await dialog.getByRole("tab", { name: /^index\.html/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("tab", { name: /^styles\.css/ })).toBeFocused();
  await expect(dialog.getByRole("tab", { name: /^styles\.css/ })).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(exportButton).toBeFocused();
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`is readable in the ${colorScheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await importDocument(page, workflowDocument);
    await openExport(page);
    const contrast = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("no 2d context");
      const rgb = (color: string) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
        return [r, g, b];
      };
      const luminance = ([r, g, b]: number[]) => {
        const channel = (value: number) => {
          const c = value / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      };
      const ratio = (a: number[], b: number[]) => {
        const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (high + 0.05) / (low + 0.05);
      };
      const style = (selector: string) => getComputedStyle(document.querySelector(selector) as Element);
      const dialog = style("dialog[open]");
      const code = style('[data-testid="export-code"]');
      return {
        dialogBackground: luminance(rgb(dialog.backgroundColor)),
        code: ratio(rgb(code.color), rgb(code.backgroundColor)),
        body: ratio(rgb(dialog.color), rgb(dialog.backgroundColor)),
      };
    });
    if (colorScheme === "dark") expect(contrast.dialogBackground).toBeLessThan(0.1);
    else expect(contrast.dialogBackground).toBeGreaterThan(0.8);
    expect(contrast.code).toBeGreaterThanOrEqual(7);
    expect(contrast.body).toBeGreaterThanOrEqual(4.5);
  });
}

for (const [width, height] of [
  [1440, 900],
  [1280, 800],
  [1024, 768],
  [900, 600],
] as const) {
  test(`fits ${width}×${height} without clipping actions or overflowing the page`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await gotoApp(page);
    await importDocument(page, workflowDocument);
    await openExport(page);
    const dialog = exportDialog(page);
    await dialog.getByLabel("Separate files").check();
    await expect(dialog.getByRole("tab")).toHaveCount(3);
    for (const name of ["Cancel", "Copy code", "Download index.html", "Download all files", "Close"]) await expect(dialog.getByRole("button", { name, exact: true })).toBeInViewport({ ratio: 1 });
    const layout = await page.evaluate(() => {
      const dialogElement = document.querySelector("dialog[open]") as HTMLElement;
      const box = dialogElement.getBoundingClientRect();
      const code = document.querySelector('[data-testid="export-code"]') as HTMLElement;
      const main = document.querySelector("main") as HTMLElement;
      return {
        pageOverflow: document.documentElement.scrollWidth - innerWidth,
        dialogOverflow: dialogElement.scrollWidth - dialogElement.clientWidth,
        insideViewport: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight,
        codeScrollsItself: code.scrollWidth > code.clientWidth,
        codeHeight: code.clientHeight,
        mainScroll: main.scrollTop,
        windowScroll: scrollY,
      };
    });
    expect(layout.pageOverflow).toBeLessThanOrEqual(0);
    expect(layout.dialogOverflow).toBeLessThanOrEqual(0);
    expect(layout.insideViewport).toBe(true);
    // The long paragraph's line scrolls inside the code box, not the page.
    await dialog.getByRole("tab", { name: /^index\.html/ }).click();
    expect(await dialog.getByTestId("export-code").evaluate((code) => code.scrollWidth > code.clientWidth)).toBe(true);
    expect(layout.codeHeight).toBeGreaterThanOrEqual(100);

    // Wheel over the backdrop scrolls nothing behind the dialog.
    await page.mouse.move(4, height - 4);
    await page.mouse.wheel(0, 600);
    expect(await page.evaluate(() => [(document.querySelector("main") as HTMLElement).scrollTop, scrollY])).toEqual([layout.mainScroll, layout.windowScroll]);
  });
}

test("handles a large document: bounded preview, complete downloads, responsive dialog", async ({ page }) => {
  test.setTimeout(240_000);
  const children: EditorElementNode[] = [];
  for (let index = 0; index < 4_500; index++)
    children.push({
      id: `p-${index}`,
      tag: "p",
      text: `Paragraph ${index}`,
      typography: { color: "#334155", fontSize: { value: 14 + (index % 5), unit: "px" } },
      spacing: { margin: { top: 4, right: 0, bottom: 4, left: 0 }, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    });
  const large: EditorElementNode = { id: "page-root", tag: "page", children };
  await importDocument(page, large);

  const started = Date.now();
  await openExport(page);
  const openMs = Date.now() - started;
  const dialog = exportDialog(page);
  await dialog.getByLabel("Separate files").check();
  await expect(dialog.getByRole("tab")).toHaveCount(2);
  const generationMs = Number(await dialog.getByTestId("export-generation-status").getAttribute("data-generation-ms"));
  await dialog.getByRole("tab", { name: /^styles\.css/ }).click();
  const separate = exportHtmlCss(large, { mode: "separate", title: PROJECT_NAME });
  const css = separate.files[1].content;
  expect(css.length).toBeGreaterThan(400_000);
  await expect(dialog.getByTestId("export-preview-truncated")).toContainText("Copy and download always use the complete file");
  expect((await previewText(page)).length).toBeLessThanOrEqual(400_000);
  expect(css.startsWith(await previewText(page))).toBe(true);

  const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Download styles.css" }).click()]);
  expect(await downloadedText(download)).toBe(css);
  test.info().annotations.push({ type: "measurement", description: `4,500 elements: open→code ${openMs} ms, separate generation ${generationMs} ms, css ${css.length} chars` });
  expect(generationMs).toBeLessThan(2_000);
});
