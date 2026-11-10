import fs from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createNavigationLink, insertNavigationLink } from "../src/features/editor/commands/navigationLinkCommands";
import { createBasicNavbarNode, createNavbarWithCtaNode } from "../src/features/editor/factories/navigationCompositions";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { exportHtmlCss } from "../src/features/export/utils/exportHtmlCss";
import { serializeProject } from "../src/features/project/utils/serializeProject";
import { gotoApp } from "./support/gotoApp";

/*
 * BC-06.3 — Navbar responsive matrix and Canvas / Preview / Export parity.
 *
 * Each document is built with the production commands (createNavigationLink
 * + insertNavigationLink, i.e. what "Add link" does), imported through the
 * real project import, and measured at 320/375/768/1024/1440 px:
 * - Design (the Canvas) and Preview, with the page sheet pinned to the width
 *   (presentation width only, the same technique as the export parity
 *   harness);
 * - the exported page, opened at a viewport of that width.
 *
 * Asserted everywhere: identical link count, order, labels and
 * destinations; identical geometry (nav-relative link boxes, nav size)
 * within 1 px across the three surfaces; the CTA last.
 * Asserted with Wrap on: nothing escapes the nav, no label spills out of
 * its link, no sideways page scroll, reading order kept.
 * Wrap off (the default) is the documented limitation BC06-R1: its
 * overflow is measured and recorded (test-results/navigation-links-
 * responsive/*.json), and must only be the SAME on every surface.
 */

const WIDTHS = [320, 375, 768, 1024, 1440] as const;
const LABELS = ["Home", "About", "Services", "Contact", "Pricing", "Blog", "Careers", "Support", "Docs", "Partners", "Press", "Legal"];
const RESULTS_DIR = path.join("test-results", "navigation-links-responsive");
const CANVAS_NAV = (id: string) => `[data-document-surface] [data-node-id="${id}"]`;

interface ChildMeasure {
  tag: string;
  text: string;
  href: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The label is wider than its own link box. */
  spills: boolean;
  /** The box lies (partly) outside the nav's content box horizontally. */
  escapes: boolean;
}

interface NavMeasure {
  width: number;
  height: number;
  children: ChildMeasure[];
  pageScrollsSideways: boolean;
}

function buildNavbar(linkCount: number, wrap: boolean, withCta: boolean): EditorElementNode {
  let nav = withCta ? createNavbarWithCtaNode() : createBasicNavbarNode();
  const starterLinks = (nav.children ?? []).filter((child) => child.tag === "a");
  nav = { ...nav, children: nav.children!.filter((child) => child.tag !== "a" || starterLinks.indexOf(child) < linkCount) };
  let page: EditorElementNode = { id: "page-root", tag: "page", children: [nav] };
  for (let count = Math.min(linkCount, starterLinks.length); count < linkCount; count++) {
    const links = nav.children!.filter((child) => child.tag === "a");
    page = insertNavigationLink(page, nav.id, createNavigationLink(links.at(-1)));
    nav = page.children![0];
  }
  let index = 0;
  const children = nav.children!.map((child) => (child.tag === "a" ? { ...child, text: LABELS[index++] } : child));
  const flex = nav.flowLayout!.flex!;
  nav = { ...nav, children, flowLayout: { display: "flex", flex: { ...flex, wrap: wrap ? "wrap" : "nowrap" } } };
  return { id: "page-root", tag: "page", children: [nav] };
}

async function importDocument(page: Page, document: EditorElementNode, navId: string) {
  const file = serializeProject({
    metadata: { id: "00000000-0000-4000-8000-000000000630", name: "BC-06.3 navbar", createdAt: "2026-11-10T00:00:00.000Z", updatedAt: "2026-11-10T00:00:00.000Z" },
    document,
  });
  await page.getByTestId("project-import-input").setInputFiles({ name: "navbar.layoutry", mimeType: "application/json", buffer: Buffer.from(file) });
  await expect(page.locator(CANVAS_NAV(navId))).toBeVisible();
}

async function pinSheetWidth(page: Page, width: number) {
  await page.evaluate((value) => {
    let style = document.getElementById("bc063-sheet-width");
    if (!style) {
      style = document.createElement("style");
      style.id = "bc063-sheet-width";
      document.head.append(style);
    }
    style.textContent = `[data-document-surface] { width: ${value + 2}px !important; max-width: none !important; }`;
  }, width);
}

/** Measures the nav and its element children. `scroller` is what would scroll sideways: the sheet on the Canvas, the page in the export. */
function measure(nav: Locator, scroller: "sheet" | "page"): Promise<NavMeasure> {
  return nav.evaluate((element, mode) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const contentLeft = box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
    const contentRight = box.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
    const children = Array.from(element.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement && ["A", "BUTTON"].includes(child.tagName))
      .map((child) => {
        const rect = child.getBoundingClientRect();
        return {
          tag: child.tagName.toLowerCase(),
          text: (child.textContent ?? "").trim(),
          href: child.getAttribute("href"),
          x: rect.left - box.left,
          y: rect.top - box.top,
          width: rect.width,
          height: rect.height,
          spills: child.scrollWidth > child.clientWidth + 1,
          escapes: rect.left < contentLeft - 0.5 || rect.right > contentRight + 0.5,
        };
      });
    let pageScrollsSideways: boolean;
    if (mode === "page") {
      pageScrollsSideways = document.documentElement.scrollWidth > window.innerWidth + 1;
    } else {
      const sheet = element.closest("[data-document-surface]") as HTMLElement | null;
      const root = sheet?.querySelector<HTMLElement>('[data-node-id="page-root"]') ?? sheet;
      pageScrollsSideways = root ? root.scrollWidth > root.clientWidth + 1 : false;
    }
    return { width: box.width, height: box.height, children, pageScrollsSideways };
  }, scroller);
}

function expectSameGeometry(a: NavMeasure, b: NavMeasure, label: string) {
  expect(b.children.map((child) => `${child.tag}:${child.text}|${child.href}`), `${label}: structure`).toEqual(a.children.map((child) => `${child.tag}:${child.text}|${child.href}`));
  expect(Math.abs(a.width - b.width), `${label}: nav width`).toBeLessThanOrEqual(1);
  expect(Math.abs(a.height - b.height), `${label}: nav height`).toBeLessThanOrEqual(1);
  a.children.forEach((child, index) => {
    const other = b.children[index];
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(Math.abs(child[key] - other[key]), `${label}: ${child.text} ${key}`).toBeLessThanOrEqual(1);
    }
    expect(other.spills, `${label}: ${child.text} spills`).toBe(child.spills);
  });
}

interface MatrixCase {
  links: number;
  wrap: boolean;
  cta: boolean;
}

const CASES: MatrixCase[] = [
  { links: 4, wrap: false, cta: false },
  { links: 6, wrap: false, cta: false },
  { links: 12, wrap: false, cta: false },
  { links: 4, wrap: true, cta: false },
  { links: 6, wrap: true, cta: false },
  { links: 12, wrap: true, cta: false },
  { links: 6, wrap: false, cta: true },
  { links: 12, wrap: true, cta: true },
];

for (const matrixCase of CASES) {
  const name = `${matrixCase.links} links, Wrap ${matrixCase.wrap ? "on" : "off"}${matrixCase.cta ? ", with CTA" : ""}`;

  test(`responsive parity: ${name}`, async ({ page, browser }) => {
    test.setTimeout(180_000);
    const document = buildNavbar(matrixCase.links, matrixCase.wrap, matrixCase.cta);
    const nav = document.children![0];
    const authored = nav.children!.map((child) => `${child.tag}:${child.text ?? ""}|${child.tag === "a" ? child.href : null}`);
    const exported = exportHtmlCss(document, { mode: "standalone", title: "BC-06.3 navbar" });
    expect(exported.ok, JSON.stringify(exported.diagnostics)).toBe(true);

    await page.setViewportSize({ width: 2600, height: 1000 });
    await gotoApp(page);
    await importDocument(page, document, nav.id);
    const exportPage = await browser.newPage();
    await exportPage.setContent(exported.files[0].content);

    const records: Record<string, { design: NavMeasure; preview: NavMeasure; export: NavMeasure }> = {};
    for (const width of WIDTHS) {
      await pinSheetWidth(page, width);
      if (await page.getByRole("button", { name: "Exit Preview" }).isVisible()) await page.getByRole("button", { name: "Exit Preview" }).click();
      const design = await measure(page.locator(CANVAS_NAV(nav.id)), "sheet");
      await page.getByRole("button", { name: "Enter Preview" }).click();
      await expect(page.getByRole("button", { name: "Exit Preview" })).toBeVisible();
      const preview = await measure(page.locator(CANVAS_NAV(nav.id)), "sheet");
      await exportPage.setViewportSize({ width, height: 800 });
      const onExport = await measure(exportPage.locator("nav").first(), "page");
      records[width] = { design, preview, export: onExport };
      const label = `${name} @ ${width}px`;

      // Authored tree = Canvas = Preview = exported page.
      expect(design.children.map((child) => `${child.tag}:${child.text}|${child.href}`), `${label}: authored vs Canvas`).toEqual(authored);
      expectSameGeometry(design, preview, `${label} Design vs Preview`);
      expectSameGeometry(design, onExport, `${label} Design vs Export`);
      expect(onExport.pageScrollsSideways, `${label}: sideways scroll agrees`).toBe(design.pageScrollsSideways);

      // The CTA stays last in document order and, without wrap, rightmost.
      if (matrixCase.cta) {
        expect(design.children.at(-1)?.tag, `${label}: CTA last`).toBe("button");
        if (!matrixCase.wrap) {
          const cta = design.children.at(-1)!;
          for (const child of design.children.slice(0, -1)) expect(child.x, `${label}: ${child.text} left of CTA`).toBeLessThan(cta.x);
        }
      }

      if (matrixCase.wrap) {
        for (const child of design.children) {
          expect(child.escapes, `${label}: ${child.text} stays inside the nav`).toBe(false);
          expect(child.spills, `${label}: ${child.text} label fits`).toBe(false);
          expect(child.width > 0 && child.height > 0, `${label}: ${child.text} visible`).toBe(true);
        }
        expect(design.pageScrollsSideways, `${label}: no sideways scroll`).toBe(false);
        // Reading order: rows top to bottom, left to right within a row.
        for (let i = 1; i < design.children.length; i++) {
          const previous = design.children[i - 1];
          const current = design.children[i];
          const sameRow = Math.abs(current.y - previous.y) < previous.height / 2;
          expect(sameRow ? current.x > previous.x : current.y > previous.y, `${label}: ${current.text} after ${previous.text}`).toBe(true);
        }
      }
    }

    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(RESULTS_DIR, `${matrixCase.links}-${matrixCase.wrap ? "wrap" : "nowrap"}${matrixCase.cta ? "-cta" : ""}.json`), JSON.stringify(records, null, 2));
    const summary = WIDTHS.map((width) => {
      const { design } = records[width];
      const rows = new Set(design.children.map((child) => Math.round((child.y + child.height / 2) / 8))).size;
      return `${width}px: rows ${rows}, spill ${design.children.filter((child) => child.spills).length}, escape ${design.children.filter((child) => child.escapes).length}, zero-width ${design.children.filter((child) => child.width < 1).length}, sideways ${design.pageScrollsSideways}, nav h ${Math.round(design.height)}`;
    });
    console.log(`[BC-06.3 responsive] ${name}\n  ${summary.join("\n  ")}`);
    await exportPage.close();
  });
}

test("keyboard focus is visible on links in Preview and on the exported page", async ({ page, browser, browserName }) => {
  const document = buildNavbar(4, false, true);
  const nav = document.children![0];
  await page.setViewportSize({ width: 1600, height: 1000 });
  await gotoApp(page);
  await importDocument(page, document, nav.id);
  await page.getByRole("button", { name: "Enter Preview" }).click();
  const previewLink = page.locator(CANVAS_NAV(nav.id)).locator(":scope > a").first();
  await previewLink.focus();
  // Keyboard modality: tab away and back, so :focus-visible applies.
  await page.keyboard.press(browserName === "webkit" ? "Shift+Tab" : "Tab");
  await previewLink.focus();
  const focusStyle = (locator: Locator) =>
    locator.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth), boxShadow: style.boxShadow };
    });
  const preview = await focusStyle(previewLink);

  const exported = exportHtmlCss(document, { mode: "standalone", title: "focus" });
  const exportPage = await browser.newPage();
  await exportPage.setContent(exported.files[0].content);
  await exportPage.keyboard.press("Tab");
  const firstExportLink = exportPage.locator("nav a").first();
  if (browserName !== "webkit") await expect(firstExportLink).toBeFocused();
  else await firstExportLink.focus();
  const onExport = await focusStyle(firstExportLink);
  console.log(`[BC-06.3 focus] ${browserName} preview ${JSON.stringify(preview)} export ${JSON.stringify(onExport)}`);
  for (const [surface, style] of [["Preview", preview], ["Export", onExport]] as const) {
    expect(style.outlineStyle !== "none" && style.outlineWidth > 0, `${surface}: focused link shows a focus ring`).toBe(true);
  }
  await exportPage.close();
});
