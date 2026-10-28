import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { buildExportDocument } from "../src/features/export/utils/buildExportDocument";
import { exportHtmlCss } from "../src/features/export/utils/exportHtmlCss";
import { createElementNode } from "../src/features/editor/factories/elementFactories";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { EXPORT_INTERACTION_RUNTIME } from "../src/features/export/utils/exportInteractionRuntime";
import { interactionFixture, type InteractionFixture } from "../test/fixtures/export/exportInteractionDocument";
import { CANVAS_ROOT, openExport, openInEditor, PAGE_WIDTH } from "./support/exportHarness";
import { comparePngs, compareMeasurements, exportElementKeys, measureCanvas, measureExport, type MeasuredElement } from "./support/exportParity";

/*
 * EXPORT-1.3 — behavioral and visual parity of interactions. The same
 * scenario of real clicks and key presses runs on the Canvas in Preview
 * (the behavior export reproduces) and on the exported page in both output
 * modes. After every step the visibility of every interaction target and
 * the focused node must match; representative states are also compared
 * visually: the whole page for in-flow states, the floating element itself
 * for modal dialogs and fixed toasts (whose position follows the browser
 * window, which differs between the editor and the exported page).
 */

const RESULTS_DIR = path.join("test-results", "export-interactions");

type Action = { kind: "click"; nodeId: string } | { kind: "escape" } | { kind: "backdrop" };
type Snapshot = { kind: "page" } | { kind: "floating"; nodeId: string; anchor: "center" | "right-edge" | "bottom-right" };
interface Step {
  label: string;
  action: Action;
  snapshot?: Snapshot;
}

function scenario({ ids }: InteractionFixture): Step[] {
  const click = (label: string, nodeId: string, snapshot?: Snapshot): Step => ({ label, action: { kind: "click", nodeId }, ...(snapshot ? { snapshot } : {}) });
  const [dropdownA, dropdownB] = ids.dropdowns;
  const [modalA, modalB] = ids.modals;
  const [toastA, toastB] = ids.toasts;
  return [
    click("open dropdown A", dropdownA.trigger, { kind: "page" }),
    click("open dropdown B (closes A)", dropdownB.trigger),
    click("click an item inside dropdown B", dropdownB.firstItem),
    click("click outside (closes B)", ids.outside),
    click("open dropdown A again", dropdownA.trigger),
    { label: "Escape closes dropdown A", action: { kind: "escape" } },
    click("collapse collapsible A", ids.collapsibles[0].trigger, { kind: "page" }),
    click("expand collapsible A", ids.collapsibles[0].trigger),
    click("select tab 2 in group A", ids.tabs[0].buttons[1], { kind: "page" }),
    click("select tab 3 in group B", ids.tabs[1].buttons[2]),
    click("open the popover in its container", ids.popover.trigger, { kind: "page" }),
    click("click outside (closes the popover)", ids.outside),
    click("dismiss alert A", ids.alerts[0].dismiss, { kind: "page" }),
    click("show toast A", toastA.show),
    click("show toast B", toastB.show, { kind: "floating", nodeId: toastB.toast, anchor: "bottom-right" }),
    click("close toast B", toastB.close),
    click("close toast A", toastA.close),
    click("open modal A", modalA.open, { kind: "floating", nodeId: modalA.dialog, anchor: "center" }),
    click("close modal A with its Close button", modalA.close),
    click("open modal A again", modalA.open),
    { label: "Escape closes modal A", action: { kind: "escape" } },
    click("open modal A once more", modalA.open),
    { label: "a backdrop click closes modal A", action: { kind: "backdrop" } },
    click("open modal B", modalB.open),
    click("open the dropdown inside modal B", ids.nestedDropdown.trigger),
    { label: "Escape closes modal B, not its dropdown", action: { kind: "escape" } },
    click("reopen modal B (its dropdown is still open)", modalB.open),
    click("close modal B", modalB.close),
    click("click outside (closes the dropdown left open in modal B)", ids.outside),
    click("open the drawer", ids.drawer.open, { kind: "floating", nodeId: ids.drawer.dialog, anchor: "right-edge" }),
    { label: "Escape closes the drawer", action: { kind: "escape" } },
  ];
}

function targetIds({ ids }: InteractionFixture): string[] {
  return [
    ...ids.dropdowns.map((dropdown) => dropdown.menu),
    ...ids.collapsibles.map((collapsible) => collapsible.content),
    ...ids.tabs.flatMap((group) => group.panels),
    ids.popover.panel,
    ...ids.alerts.map((alert) => alert.root),
    ...ids.toasts.map((toast) => toast.toast),
    ...ids.modals.map((modal) => modal.dialog),
    ids.nestedDropdown.menu,
    ids.drawer.dialog,
    ids.dialog,
  ];
}

/** Both sides behind one interface: the Canvas addresses nodes by data-node-id, the export by a test-only attribute mapped from the IR. */
interface Side {
  page: Page;
  attribute: string;
  locate(nodeId: string): Locator;
}

function canvasSide(page: Page): Side {
  return { page, attribute: "data-node-id", locate: (nodeId) => page.locator(`[data-document-surface] [data-node-id="${nodeId}"]`) };
}

async function exportSide(page: Page, keys: string[]): Promise<Side> {
  // Tags each exported element with its editor node id (test-only, set after load; the runtime never reads it).
  await page.evaluate((elementKeys) => {
    const root = document.body.firstElementChild;
    if (!root) throw new Error("no export root");
    [root, ...Array.from(root.querySelectorAll("*"))].forEach((element, index) => {
      if (!elementKeys[index].includes("#")) element.setAttribute("data-test-node", elementKeys[index]);
    });
  }, keys);
  return { page, attribute: "data-test-node", locate: (nodeId) => page.locator(`[data-test-node="${nodeId}"]`) };
}

interface ObservedState {
  shown: Record<string, boolean>;
  focusedNode: string | null;
}

/** Which targets are visible (a dialog counts only when modally open) and which node holds focus. */
function observe(side: Side, ids: string[]): Promise<ObservedState> {
  return side.page.evaluate(
    async ([attribute, nodeIds]) => {
      // Let a frame pass: the Canvas removes a hidden node (focus inside it
      // drops at once) while export hides it (the browser drops focus from
      // a hidden element at its next rendering update).
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const shown: Record<string, boolean> = {};
      for (const nodeId of nodeIds) {
        const element = document.querySelector(`[${attribute}="${nodeId}"]`);
        shown[nodeId] = element instanceof HTMLDialogElement ? element.open && element.matches(":modal") && element.checkVisibility() : Boolean(element?.checkVisibility());
      }
      const focused = document.activeElement?.closest(`[${attribute}]`);
      return { shown, focusedNode: focused ? focused.getAttribute(attribute) : null };
    },
    [side.attribute, ids] as const,
  );
}

async function perform(side: Side, action: Action) {
  if (action.kind === "click") await side.locate(action.nodeId).click();
  else if (action.kind === "escape") await side.page.keyboard.press("Escape");
  else await side.page.mouse.click(4, 4);
}

/**
 * Rects of a subtree re-based to its root, so a floating element compares
 * independently of the window it floats in. The root's own window-relative
 * offsets (resolved insets and auto margins) are left to the anchoring check.
 */
const WINDOW_RELATIVE_PROPERTIES = ["top", "left", "right", "bottom", "margin-top", "margin-right", "margin-bottom", "margin-left"];
function rebase(elements: MeasuredElement[], keys: ReadonlySet<string>, rootKey: string): MeasuredElement[] {
  const root = elements.find((element) => element.key === rootKey);
  if (!root) return [];
  return elements
    .filter((element) => keys.has(element.key.replace(/#.*$/, "")))
    .map((element) => ({
      ...element,
      rect: { ...element.rect, x: element.rect.x - root.rect.x, y: element.rect.y - root.rect.y },
      style: element.key === rootKey ? Object.fromEntries(Object.entries(element.style).filter(([property]) => !WINDOW_RELATIVE_PROPERTIES.includes(property))) : element.style,
    }));
}

function subtreeIds(document: EditorElementNode, rootId: string): Set<string> {
  const ids = new Set<string>();
  const visit = (node: EditorElementNode, inside: boolean) => {
    const included = inside || node.id === rootId;
    if (included) ids.add(node.id);
    for (const child of node.children ?? []) visit(child, included);
  };
  visit(document, false);
  return ids;
}

/** Where a floating element sits relative to the window it floats in, for its anchoring. */
function anchorOffsets(side: Side, nodeId: string): Promise<Record<string, number>> {
  return side.locate(nodeId).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: window.innerWidth - rect.right, bottom: window.innerHeight - rect.bottom, centerDx: rect.left + rect.width / 2 - window.innerWidth / 2, centerDy: rect.top + rect.height / 2 - window.innerHeight / 2, width: rect.width, height: rect.height, viewportHeight: window.innerHeight };
  });
}

function expectedAnchoring(anchor: Snapshot & { kind: "floating" }, offsets: Record<string, number>): Record<string, number> {
  const round = (value: number) => Math.round(value * 10) / 10;
  if (anchor.anchor === "center") return { centerDx: round(offsets.centerDx), centerDy: round(offsets.centerDy) };
  if (anchor.anchor === "right-edge") return { right: round(offsets.right), top: round(offsets.top), heightMinusViewport: round(offsets.height - offsets.viewportHeight) };
  return { right: round(offsets.right), bottom: round(offsets.bottom) };
}

test("exported interactions behave like Preview, step by step, in both output modes", async ({ page, context }, testInfo) => {
  test.setTimeout(240_000);
  const fixture = interactionFixture();
  const built = buildExportDocument(fixture.document);
  if (!built.ok) throw new Error(JSON.stringify(built.diagnostics));
  const keys = exportElementKeys(built.document.root);
  const ids = targetIds(fixture);
  const steps = scenario(fixture);

  await openInEditor(page, fixture.document, { hideEditorPanels: true });
  // Same window height on both sides, so viewport-filling and viewport-centered elements get the same size.
  const canvasViewportHeight = await page.evaluate(() => window.innerHeight);
  const canvas = canvasSide(page);
  const exported: Record<string, Side> = {};
  for (const mode of ["standalone", "separate"] as const) {
    const exportPage = await context.newPage();
    await openExport(exportPage, fixture.document, mode, { height: canvasViewportHeight - 40 });
    exported[mode] = await exportSide(exportPage, keys);
  }

  const log: unknown[] = [];
  const mismatches: unknown[] = [];
  const visual: unknown[] = [];
  const initial = await observe(canvas, ids);
  for (const [mode, side] of Object.entries(exported)) {
    const state = await observe(side, ids);
    if (JSON.stringify(state.shown) !== JSON.stringify(initial.shown)) mismatches.push({ step: "initial", mode, canvas: initial, exported: state });
  }

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  for (const [index, step] of steps.entries()) {
    await perform(canvas, step.action);
    for (const side of Object.values(exported)) await perform(side, step.action);
    const expected = await observe(canvas, ids);
    const entry: Record<string, unknown> = { step: step.label, shown: Object.entries(expected.shown).filter(([, shown]) => shown).map(([nodeId]) => nodeId), focus: expected.focusedNode };
    for (const [mode, side] of Object.entries(exported)) {
      const actual = await observe(side, ids);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) mismatches.push({ step: step.label, mode, canvas: expected, exported: actual });
    }
    log.push(entry);

    if (!step.snapshot) continue;
    await page.mouse.move(0, 0);
    for (const side of Object.values(exported)) await side.page.mouse.move(0, 0);
    const name = `${String(index + 1).padStart(2, "0")}-${step.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
    const snapshot = step.snapshot;
    const canvasTarget = snapshot.kind === "page" ? page.locator(CANVAS_ROOT) : canvas.locate(snapshot.nodeId);
    const canvasPng = await canvasTarget.screenshot({ animations: "disabled", caret: "hide" });
    fs.writeFileSync(path.join(RESULTS_DIR, `${name}-canvas.png`), canvasPng);
    const canvasMeasured = await measureCanvas(page);
    for (const [mode, side] of Object.entries(exported)) {
      const exportTarget = snapshot.kind === "page" ? side.page.locator("body > div").first() : side.locate(snapshot.nodeId);
      const exportPng = await exportTarget.screenshot({ animations: "disabled", caret: "hide" });
      const pixels = await comparePngs(side.page, canvasPng, exportPng);
      fs.writeFileSync(path.join(RESULTS_DIR, `${name}-${mode}-diff.png`), Buffer.from(pixels.diffPng, "base64"));
      let exportMeasured = await measureExport(side.page, keys);
      let canvasCompared = canvasMeasured;
      let anchoring: unknown = null;
      if (snapshot.kind === "floating") {
        const subtree = subtreeIds(fixture.document, snapshot.nodeId);
        canvasCompared = rebase(canvasMeasured, subtree, snapshot.nodeId);
        exportMeasured = rebase(exportMeasured, subtree, snapshot.nodeId);
        const canvasAnchor = expectedAnchoring(snapshot, await anchorOffsets(canvas, snapshot.nodeId));
        const exportAnchor = expectedAnchoring(snapshot, await anchorOffsets(side, snapshot.nodeId));
        anchoring = { canvas: canvasAnchor, exported: exportAnchor };
        if (JSON.stringify(canvasAnchor) !== JSON.stringify(exportAnchor)) mismatches.push({ step: step.label, mode, anchoring });
      }
      const properties = compareMeasurements(canvasCompared, exportMeasured);
      visual.push({ step: step.label, mode, target: snapshot.kind === "page" ? "page" : snapshot.nodeId, size: `${pixels.width}x${pixels.height}`, sameSize: pixels.sameSize, exactSimilarity: pixels.exactSimilarity, tolerantSimilarity: pixels.tolerantSimilarity, differingPixels: pixels.differingPixels, comparedElements: properties.compared, propertyChecks: properties.propertyChecks, differences: properties.differences, maxGeometryDelta: properties.maxGeometryDelta, anchoring });
      if (properties.differences.length > 0 || !pixels.sameSize || pixels.tolerantSimilarity < 0.99) mismatches.push({ step: step.label, mode, visual: visual[visual.length - 1] });
    }
  }

  const report = { steps: log, visual, mismatches };
  fs.writeFileSync(path.join(RESULTS_DIR, "interaction-parity.json"), JSON.stringify(report, null, 2));
  await testInfo.attach("interaction-parity.json", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
  expect(mismatches).toEqual([]);
});

test("exported interactions work offline from local files in both modes, with no network requests", async ({ page, context }, testInfo) => {
  const fixture = interactionFixture();
  const requests: string[] = [];
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith("file:") || url.startsWith("data:")) return route.continue();
    requests.push(url);
    return route.abort();
  });
  for (const mode of ["standalone", "separate"] as const) {
    const directory = testInfo.outputPath(`offline-${mode}`);
    const result = await openExport(page, fixture.document, mode, { height: 900, directory });
    expect(fs.readdirSync(directory).sort()).toEqual(result.files.map((file) => file.path).sort());
    const dropdown = fixture.ids.dropdowns[0];
    const trigger = page.locator(`[data-ly-on-click][aria-controls]`).filter({ hasText: "Menu" }).first();
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    const open = page.getByRole("button", { name: "Open Modal" }).first();
    await open.click();
    await expect(page.locator("dialog:modal")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog:modal")).toHaveCount(0);
    expect(dropdown.menu).toBeTruthy();
  }
  expect(requests).toEqual([]);
});

test("exported interactions are keyboard-operable and keep accessible state", async ({ page }) => {
  const fixture = interactionFixture();
  await openExport(page, fixture.document, "standalone", { height: 900 });

  // Disclosure (dropdown): Enter opens, Tab reaches the menu, Escape closes and returns focus.
  const dropdownTrigger = page.getByRole("button", { name: "Menu" }).first();
  await expect(dropdownTrigger).toHaveAttribute("aria-expanded", "false");
  const controlled = await dropdownTrigger.getAttribute("aria-controls");
  expect(controlled).toMatch(/^ly-target-\d+$/);
  await dropdownTrigger.focus();
  await page.keyboard.press("Enter");
  await expect(dropdownTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(`[id="${controlled}"]`)).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(`[id="${controlled}"] a`).first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(`[id="${controlled}"]`)).toBeHidden();
  await expect(dropdownTrigger).toBeFocused();
  await expect(dropdownTrigger).toHaveAttribute("aria-expanded", "false");

  // Collapsible: Space toggles, aria-expanded follows.
  const collapsibleTrigger = page.getByRole("button", { name: "Toggle Content" }).first();
  await expect(collapsibleTrigger).toHaveAttribute("aria-expanded", "true");
  await collapsibleTrigger.focus();
  await page.keyboard.press("Space");
  await expect(collapsibleTrigger).toHaveAttribute("aria-expanded", "false");

  // Modal: keyboard opening moves focus into the native modal; Escape closes it and focus returns to the opener.
  const openModal = page.getByRole("button", { name: "Open Modal" }).first();
  await expect(openModal).toHaveAttribute("aria-haspopup", "dialog");
  await openModal.focus();
  await page.keyboard.press("Enter");
  const dialog = page.locator("dialog:modal");
  await expect(dialog).toHaveCount(1);
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(openModal).toBeFocused();

  // Every aria-controls reference resolves, and every id on the page is unique.
  const references = await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll("[id]"), (element) => element.id);
    const controls = Array.from(document.querySelectorAll("[aria-controls]"), (element) => element.getAttribute("aria-controls") ?? "").flatMap((value) => value.split(" "));
    return { duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index), unresolved: controls.filter((id) => !document.getElementById(id)) };
  });
  expect(references).toEqual({ duplicateIds: [], unresolved: [] });

  // Tabs claim no tab roles the editor doesn't implement.
  await expect(page.locator("[role=tab], [role=tablist], [role=tabpanel]")).toHaveCount(0);
});

test("the runtime initializes and responds quickly on a page with 500 interactive components", async ({ page }) => {
  const many: EditorElementNode[] = [];
  const types = ["dropdownButton", "collapsible", "basicTabs", "modal", "popover"] as const;
  for (let index = 0; index < 500; index++) many.push(createElementNode(types[index % types.length]));
  const result = exportHtmlCss({ id: "page-root", tag: "page", children: many }, { mode: "standalone" });
  expect(result.ok).toBe(true);
  // Load the page without its runtime, then run the runtime once, timed (test-only evaluation of the exported script).
  const withoutRuntime = result.files[0].content.replace(`<script>\n${EXPORT_INTERACTION_RUNTIME}</script>`, "");
  await page.setViewportSize({ width: PAGE_WIDTH, height: 900 });
  await page.setContent(withoutRuntime);
  const metrics = await page.evaluate((runtime) => {
    const started = performance.now();
    new Function(runtime)();
    const initMs = performance.now() - started;
    const triggers = Array.from(document.querySelectorAll<HTMLElement>("[data-ly-dismiss]"));
    const latencies: number[] = [];
    for (const trigger of triggers.slice(0, 50)) {
      const clickStarted = performance.now();
      trigger.click();
      latencies.push(performance.now() - clickStarted);
    }
    const firstClickMs = latencies[0];
    latencies.sort((a, b) => a - b);
    return {
      triggers: document.querySelectorAll("[data-ly-on-click]").length,
      targets: document.querySelectorAll("[data-ly-target]").length,
      initMs,
      firstClickMs,
      clickMedianMs: latencies[25],
      clickP95Ms: latencies[47],
      clickMaxMs: latencies[latencies.length - 1],
    };
  }, EXPORT_INTERACTION_RUNTIME);
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(RESULTS_DIR, "runtime-performance.json"), JSON.stringify({ runtimeBytes: Buffer.byteLength(EXPORT_INTERACTION_RUNTIME), ...metrics }, null, 2));
  console.info(
    `EXPORT-1.3 runtime: ${metrics.triggers} triggers / ${metrics.targets} targets, init ${metrics.initMs.toFixed(2)} ms, first click ${metrics.firstClickMs.toFixed(2)} ms, click median ${metrics.clickMedianMs.toFixed(2)} ms, p95 ${metrics.clickP95Ms.toFixed(2)} ms, max ${metrics.clickMaxMs.toFixed(2)} ms`,
  );
  expect(metrics.initMs).toBeLessThan(100);
  // Within one frame for the typical click; the slowest single click is reported, not asserted.
  expect(metrics.clickP95Ms).toBeLessThan(16);
});

test("the exported interactive page has no ARIA or naming violations, closed and open", async ({ page }, testInfo) => {
  const fixture = interactionFixture();
  await openExport(page, fixture.document, "standalone", { height: 900 });
  const scan = async () => (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations;
  const closed = await scan();
  await page.getByRole("button", { name: "Menu" }).first().click();
  await page.getByRole("button", { name: "Open Popover" }).click();
  const open = await scan();
  const summary = { closed: closed.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length })), open: open.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length })) };
  await testInfo.attach("axe.json", { body: JSON.stringify(summary, null, 2), contentType: "application/json" });
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(RESULTS_DIR, "axe.json"), JSON.stringify(summary, null, 2));
  // Interaction semantics added by export (aria-expanded/controls/haspopup) must be valid.
  const ariaRules = (violations: typeof closed) => violations.filter((violation) => violation.id.startsWith("aria-") || violation.id === "button-name" || violation.id === "duplicate-id-aria");
  expect(ariaRules(closed)).toEqual([]);
  expect(ariaRules(open)).toEqual([]);
});
