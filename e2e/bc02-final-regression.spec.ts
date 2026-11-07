import { expect, test, type ConsoleMessage, type Locator, type Page } from "@playwright/test";
import { createDropdownButtonNode } from "../src/features/editor/factories/buttonCompositions";
import { createCollapsibleNode } from "../src/features/editor/factories/interactionCompositions";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { resolveInteractionTargets } from "../src/features/editor/utils/interactionTargets";
import { exportHtmlCss } from "../src/features/export/utils/exportHtmlCss";
import { serializeProject } from "../src/features/project/utils/serializeProject";
import { startAttackServer, type AttackServer } from "./support/embedAttackPages";
import { gotoApp } from "./support/gotoApp";
import { componentsDocument, startParityServer, type ParityServer } from "./support/parityFixtures";
import { CLIP_FILE, TONE_FILE } from "./support/previewMedia";

/*
 * BC-02.6 — final regression for the BC-02 Dynamic Component Preview
 * milestone. The per-defect specs (BC-02.2 … BC-02.5.1) prove each fix on
 * its own; this spec proves they still hold together:
 *
 * 1. Component matrix: every built-in interactive component, step by step
 *    (click, repeated clicks, Enter, Space, Escape), compared as one full
 *    runtime snapshot (trigger ARIA, target visibility, open dialogs,
 *    focus) between Preview and the exported page.
 * 2. Combined workflow: one project holding forms, components, media
 *    nested in a Collapsible, a hostile cross-origin iframe, free layout
 *    and an authored transition, driven through Design → Preview → Design
 *    → Preview → Export → save → reopen, under both reduced-motion
 *    settings, with document/history/storage integrity checked throughout.
 * 3. Lifecycle (Chromium, CDP): repeated Preview sessions, measured.
 *
 * Everything is local: media and the exported page come from a loopback
 * parity server, the hostile embed from a second loopback origin.
 */

const EDITOR = "http://localhost:3000";
const surface = "[data-document-surface]";

let media: ParityServer;
let attacker: AttackServer;

test.beforeAll(async () => {
  media = await startParityServer();
  attacker = await startAttackServer();
});

test.afterAll(async () => {
  await media.close();
  await attacker.close();
});

const enterPreview = (page: Page) => page.getByRole("button", { name: "Enter Preview" }).click();
const exitPreview = (page: Page) => page.getByRole("button", { name: "Exit Preview" }).click();
const undo = (page: Page) => page.getByRole("button", { name: "Undo", exact: true });

async function importProject(page: Page, document: EditorElementNode, name: string, projectId: string, waitForNodeId: string) {
  const file = serializeProject({ metadata: { id: projectId, name, createdAt: "2026-11-06T00:00:00.000Z", updatedAt: "2026-11-06T00:00:00.000Z" }, document });
  await page.getByTestId("project-import-input").setInputFiles({ name: "bc026.layoutry", mimeType: "application/json", buffer: Buffer.from(file) });
  await page.locator(`${surface} [data-node-id="${waitForNodeId}"]`).waitFor({ state: "attached", timeout: 60_000 });
}

/** The exported code is a pure function of the document: identical text means an identical document. */
async function exportedCode(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Export Code" }).click();
  const code = page.getByRole("dialog", { name: "Export Code" }).getByTestId("export-code");
  await expect(code).toBeVisible();
  const text = (await code.textContent()) ?? "";
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Export Code" })).toHaveCount(0);
  return text;
}

async function openExport(page: Page, document: EditorElementNode, name: string): Promise<string> {
  const result = exportHtmlCss(document, { mode: "standalone", title: name });
  expect(result.ok).toBe(true);
  const html = result.files.find((file) => file.path.endsWith(".html"))?.content ?? "";
  // The same viewport as the editor, so everything is on screen in both.
  await page.setViewportSize({ width: 1600, height: 1100 });
  // Not "load": WebKit on Windows never finishes loading media, which would hold it forever.
  const url = media.host(`/${name}.html`, html);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  return url;
}

/* ------------------------------------------------------------------ media */

interface MediaState {
  paused: boolean;
  time: number;
}

const readMedia = (element: Locator): Promise<MediaState> => element.evaluate((node: HTMLMediaElement) => ({ paused: node.paused, time: node.currentTime }));

async function waitLoaded(element: Locator) {
  await expect.poll(() => element.evaluate((node: HTMLMediaElement) => node.readyState), { timeout: 20_000 }).toBeGreaterThanOrEqual(3);
}

async function expectPlaying(element: Locator, label: string) {
  await expect.poll(async () => (await readMedia(element)).paused, { message: `${label} should play` }).toBe(false);
  const start = (await readMedia(element)).time;
  // The 4 s clip loops, so "advancing" means the position keeps changing either way.
  await expect.poll(async () => Math.abs((await readMedia(element)).time - start), { message: `${label} should advance` }).toBeGreaterThan(0.2);
}

async function expectStopped(element: Locator, label: string): Promise<number> {
  await expect.poll(async () => (await readMedia(element)).paused, { message: `${label} should be paused` }).toBe(true);
  const at = (await readMedia(element)).time;
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect((await readMedia(element)).time, `${label} must not advance`).toBe(at);
  return at;
}

async function startMedia(element: Locator) {
  expect(await element.evaluate((node: HTMLMediaElement) => node.play().then(() => "playing", (error: Error) => error.name))).toBe("playing");
}

/**
 * Playwright's WebKit on Windows loads no media at all (BC-02.2 report).
 * The media steps run everywhere media can load; on WebKit, when the
 * probe shows the limitation, they are skipped with an explicit
 * annotation, never counted as verified. Any other browser failing to
 * load is a real failure.
 */
async function mediaAvailable(page: Page, probe: Locator, browserName: string): Promise<boolean> {
  try {
    await waitLoaded(probe);
    return true;
  } catch (error) {
    if (browserName !== "webkit") throw error;
    test.info().annotations.push({ type: "environment-limitation", description: "Playwright WebKit (Windows) loaded no media; media steps NOT verified in this run" });
    return false;
  }
}

/* ------------------------------------------------ 1. component matrix */

interface RuntimeSnapshot {
  triggers: Record<string, { expanded: string | null; controls: string | null; haspopup: string | null; visible: boolean }>;
  targets: Record<string, boolean>;
  openDialogs: number;
  focus?: string;
  focusOnHidden?: string | null;
  problems: string[];
}

/**
 * Presses Tab from `startSelector` until focus leaves the document root
 * (or cycles), recording every element reached. Hidden elements are
 * marked, so "hidden content is not reachable by keyboard" is checked
 * directly.
 */
async function tabWalk(page: Page, rootSelector: string, startSelector: string): Promise<string[]> {
  await page.bringToFront();
  await page.locator(startSelector).focus();
  const order: string[] = [];
  for (let step = 0; step < 80; step++) {
    const current = await page.evaluate((rootSelector) => {
      const root = document.querySelector(rootSelector);
      const active = document.activeElement;
      if (!root || !active || active === root || active === document.body || !root.contains(active)) return null;
      const visible = active.getClientRects().length > 0 && getComputedStyle(active).visibility !== "hidden";
      const name = active.id || `${active.tagName.toLowerCase()}:${(active.textContent ?? "").trim().slice(0, 24)}`;
      return visible ? name : `${name} [HIDDEN]`;
    }, rootSelector);
    // Stop when focus leaves the document, cycles to the start, or stays put (Firefox keeps activeElement on the last element when Tab leaves the page).
    if (current === null || current === order[0] || current === order[order.length - 1]) break;
    order.push(current);
    await page.keyboard.press("Tab");
  }
  return order;
}

/** One in-page read of every trigger and target, plus the aria-controls / id validity rules. */
function runtimeSnapshot(page: Page, rootSelector: string, triggerIds: string[], targetIds: string[], withFocus: boolean): Promise<RuntimeSnapshot> {
  return page.evaluate(
    ({ rootSelector, triggerIds, targetIds, withFocus }) => {
      const root = document.querySelector(rootSelector);
      if (!root) throw new Error("no document root");
      const visible = (element: Element | null) => !!element && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
      const byId = (id: string) => root.querySelector(`[id="${id}"]`);
      const triggers: RuntimeSnapshot["triggers"] = {};
      for (const id of triggerIds) {
        const trigger = byId(id);
        triggers[id] = { expanded: trigger?.getAttribute("aria-expanded") ?? null, controls: trigger?.getAttribute("aria-controls") ?? null, haspopup: trigger?.getAttribute("aria-haspopup") ?? null, visible: visible(trigger) };
      }
      const targets: Record<string, boolean> = {};
      for (const id of targetIds) targets[id] = visible(byId(id));
      const counts = new Map<string, number>();
      for (const element of Array.from(root.querySelectorAll("[id]"))) counts.set(element.id, (counts.get(element.id) ?? 0) + 1);
      const problems: string[] = [];
      for (const [id, count] of counts) if (count > 1) problems.push(`duplicate id ${id}`);
      for (const trigger of Array.from(root.querySelectorAll("[aria-controls]"))) {
        for (const id of (trigger.getAttribute("aria-controls") ?? "").split(" ")) if (counts.get(id) !== 1) problems.push(`${trigger.id} controls missing ${id}`);
      }
      const active = document.activeElement;
      const inside = !!active && active !== root && active !== document.body && root.contains(active);
      const snapshot: RuntimeSnapshot = { triggers, targets, openDialogs: root.querySelectorAll("dialog[open]").length, problems };
      // Focus left on an element that has just been hidden (recorded as a finding, see the matrix test).
      snapshot.focusOnHidden = inside && active && !visible(active) ? active.id || active.tagName.toLowerCase() : null;
      if (withFocus) snapshot.focus = inside && active ? active.id || active.tagName.toLowerCase() : "outside";
      return snapshot;
    },
    { rootSelector, triggerIds, targetIds, withFocus },
  );
}

const COMPONENT_NAMES = ["Dropdown", "Dropdown (2nd instance)", "Collapsible (with a nested Collapsible)", "Popover", "Drawer", "Modal", "Tabs", "Toast", "Dismissible Alert"];

function walk(node: EditorElementNode, visit: (node: EditorElementNode) => void) {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

test.describe("BC-02.6 component matrix: Preview and Export agree step by step", () => {
  test("every built-in interactive component: initial, open, close, repeat, keyboard, Escape, no document mutation", async ({ page, context, browserName }) => {
    test.setTimeout(240_000);
    const { document, triggerIds } = componentsDocument();
    const targetIds = resolveInteractionTargets(document).flatMap((target) => (target.domId ? [target.domId] : []));
    const components = document.children?.[0]?.children ?? [];
    expect(components.map((component) => component.id).length).toBe(COMPONENT_NAMES.length);

    await page.setViewportSize({ width: 1600, height: 1000 });
    await gotoApp(page);
    await importProject(page, document, "BC-02.6 components", "00000000-0000-4000-8000-000000000261", components[0]?.id ?? "");
    const before = await exportedCode(page);
    const status = await page.locator("[data-project-status]").getAttribute("data-project-status");
    await enterPreview(page);
    const exported = await context.newPage();
    await openExport(exported, document, "matrix");

    const compare = async (label: string, withFocus = false) => {
      const preview = await runtimeSnapshot(page, surface, triggerIds, targetIds, withFocus);
      const exportedState = await runtimeSnapshot(exported, "body", triggerIds, targetIds, withFocus);
      expect(preview.problems, `Preview ${label}`).toEqual([]);
      expect(exportedState.problems, `Export ${label}`).toEqual([]);
      if (preview.focusOnHidden) focusFindings.add(`Preview: focus stays on hidden ${preview.focusOnHidden} (${label})`);
      if (exportedState.focusOnHidden) focusFindings.add(`Export: focus stays on hidden ${exportedState.focusOnHidden} (${label})`);
      if (withFocus && preview.focus === "outside") focusFindings.add(`Preview: focus lost to the page (${label})`);
      if (withFocus && exportedState.focus === "outside") focusFindings.add(`Export: focus lost to the page (${label})`);
      // After a pointer click, where focus lands is browser behavior (WebKit does not focus buttons on click,
      // and the editor canvas may not either), so focus is compared only in the keyboard steps.
      // In the keyboard steps focus starts on a trigger inside the document, so
      // "outside" and "on an element that was just hidden" both mean the same
      // thing: focus was lost because the trigger hid itself (finding, not parity).
      for (const state of [preview, exportedState]) {
        if (withFocus && (state.focusOnHidden || state.focus === "outside")) state.focus = "lost";
        delete state.focusOnHidden;
      }
      expect(preview, label).toEqual(exportedState);
      return preview;
    };
    const focusFindings = new Set<string>();

    // Keyboard reachability: the whole document in Tab order, initially and with a Dropdown open.
    const firstTrigger = triggerIds[0] ?? "";
    const previewTabs = await tabWalk(page, surface, `${surface} #${firstTrigger}`);
    const exportTabs = await tabWalk(exported, "body", `#${firstTrigger}`);
    expect(previewTabs.filter((entry) => entry.endsWith("[HIDDEN]")), "Preview: Tab never reaches hidden content").toEqual([]);
    expect(exportTabs.filter((entry) => entry.endsWith("[HIDDEN]")), "Export: Tab never reaches hidden content").toEqual([]);
    expect(previewTabs, "same Tab order in Preview and Export").toEqual(exportTabs);
    await page.locator(`${surface} #${firstTrigger}`).click();
    await exported.locator(`#${firstTrigger}`).click();
    const previewOpenTabs = await tabWalk(page, surface, `${surface} #${firstTrigger}`);
    const exportOpenTabs = await tabWalk(exported, "body", `#${firstTrigger}`);
    expect(previewOpenTabs, "same Tab order with the Dropdown open").toEqual(exportOpenTabs);
    // WebKit, like Safari, does not put links in the Tab order by default, so the menu links add no Tab stops there (same in both runtimes, compared above).
    if (browserName !== "webkit") expect(previewOpenTabs.length, "the open menu's items become reachable").toBeGreaterThan(previewTabs.length);
    expect(previewOpenTabs.filter((entry) => entry.endsWith("[HIDDEN]"))).toEqual([]);
    console.log(`[BC-02.6 matrix] Tab order (${previewTabs.length} stops; ${previewOpenTabs.length} with the Dropdown open): ${previewTabs.join(", ")}`);
    await exitPreview(page);
    await enterPreview(page);
    await exported.reload({ waitUntil: "domcontentloaded" });
    const fresh = async () => {
      await exitPreview(page);
      await enterPreview(page);
      await exported.reload({ waitUntil: "domcontentloaded" });
    };
    const act = async (id: string, how: "click" | "Enter" | "Space") => {
      for (const side of [{ target: page.locator(`${surface} #${id}`), page }, { target: exported.locator(`#${id}`), page: exported }]) {
        if (how === "click") {
          await side.target.click();
        } else {
          await side.target.focus();
          await side.page.keyboard.press(how === "Enter" ? "Enter" : " ");
        }
      }
    };

    const initial = await compare("initial");
    const log: string[] = [];
    for (const [index, component] of components.entries()) {
      const name = COMPONENT_NAMES[index] ?? component.id;
      const own: string[] = [];
      walk(component, (node) => {
        if (node.htmlId && triggerIds.includes(node.htmlId)) own.push(node.htmlId);
      });
      expect(own.length, `${name} has triggers`).toBeGreaterThan(0);

      // Pointer: three rounds over the component's triggers (open, close, re-open …).
      await fresh();
      await compare(`${name} initial`);
      let steps = 0;
      for (let round = 0; round < 3; round++) {
        for (const id of own) {
          const state = await compare(`${name} before click ${id} (round ${round})`);
          if (!state.triggers[id]?.visible) continue;
          await act(id, "click");
          await compare(`${name} after click ${id} (round ${round})`);
          steps++;
        }
      }

      // Keyboard: Enter, then Space, on every reachable trigger; focus compared too.
      await fresh();
      for (const key of ["Enter", "Space"] as const) {
        for (const id of own) {
          const state = await compare(`${name} before ${key} on ${id}`);
          if (!state.triggers[id]?.visible) continue;
          await act(id, key);
          await compare(`${name} after ${key} on ${id}`, true);
          steps++;
        }
      }

      // Escape: open the component with its first trigger, then Escape must
      // close what was opened the same way in both. Only when something was
      // opened: with nothing dismissible open, Escape in Preview exits
      // Preview (an editor shortcut, intentional; checked at the end).
      await fresh();
      const first = own[0] ?? "";
      await act(first, "click");
      const opened = await compare(`${name} opened for Escape`);
      const somethingOpened = opened.openDialogs > 0 || Object.entries(opened.triggers).some(([id, state]) => state.expanded === "true" && initial.triggers[id]?.expanded === "false");
      let escape = "n/a (opens nothing Escape can dismiss)";
      if (somethingOpened) {
        await page.keyboard.press("Escape");
        await exported.keyboard.press("Escape");
        const afterEscape = await compare(`${name} after Escape`);
        expect(afterEscape.openDialogs, `${name}: no dialog left open after Escape`).toBe(0);
        await expect(page.getByRole("button", { name: "Exit Preview" }), `${name}: Escape that closes something keeps Preview active`).toBeVisible();
        escape = "closes";
      }
      log.push(`${name}: ${own.length} trigger(s), ${steps} compared steps, Escape ${escape}`);
    }
    test.info().annotations.push({ type: "matrix", description: log.join("; ") });
    test.info().annotations.push({ type: "focus-finding", description: [...focusFindings].join("; ") || "none" });
    console.log(`[BC-02.6 matrix] focus findings: ${[...focusFindings].join(" | ") || "none"}`);
    console.log(`[BC-02.6 matrix] ${log.join(" | ")}`);
    console.log(`[BC-02.6 matrix] initial ARIA: ${JSON.stringify(initial.triggers)}`);

    // Intentional difference: with nothing open, Escape leaves Preview (the exported page has no mode to leave).
    await fresh();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Enter Preview" })).toBeVisible();
    await exported.close();
    expect(await exportedCode(page)).toBe(before);
    await expect(page.locator("[data-project-status]")).toHaveAttribute("data-project-status", status ?? "");
    await expect(undo(page)).toBeDisabled();
  });
});

/* ------------------------------------------------ 2. combined workflow */

const clipSize = { preferredWidth: 160, preferredHeight: 90, offsetX: 0, offsetY: 0 };
const TYPED = "BC026TYPED";

/** One project with every BC-02 surface; trigger and media ids are authored so both runtimes find them. */
function combinedDocument(mediaBase: string, embedSrc: string): { document: EditorElementNode; dropdownMenuId: string; collapseContentId: string } {
  const clip = `${mediaBase}${CLIP_FILE}`;
  const tone = `${mediaBase}${TONE_FILE}`;
  const dropdown = createDropdownButtonNode();
  const dropdownTrigger = dropdown.children?.find((child) => (child.interactions?.length ?? 0) > 0);
  const collapsible = createCollapsibleNode();
  const collapseTrigger = collapsible.children?.find((child) => (child.interactions?.length ?? 0) > 0);
  const content = collapsible.children?.find((child) => child.id === collapseTrigger?.interactions?.[0]?.targetId);
  const menu = dropdown.children?.find((child) => child.id === dropdownTrigger?.interactions?.[0]?.targetId);
  if (!dropdownTrigger || !collapseTrigger || !content || !menu) throw new Error("unexpected component shape");
  dropdownTrigger.htmlId = "c-dropdown";
  collapseTrigger.htmlId = "c-collapse";
  content.children = [
    ...(content.children ?? []),
    { id: "cv-auto", htmlId: "cv-auto", tag: "video", src: clip, autoplay: true, muted: true, loop: true, dimensions: clipSize },
    { id: "cv-plain", htmlId: "cv-plain", tag: "video", src: clip, loop: true, dimensions: clipSize },
    { id: "cv-sound", htmlId: "cv-sound", tag: "video", src: clip, autoplay: true, loop: true, dimensions: clipSize },
    { id: "deep", tag: "div", children: [{ id: "ca-deep", htmlId: "ca-deep", tag: "audio", src: tone, loop: true }] },
  ];
  const document: EditorElementNode = {
    id: "page-root",
    tag: "page",
    children: [
      {
        id: "combined",
        tag: "section",
        children: [
          {
            id: "form",
            tag: "form",
            children: [
              { id: "c-text", htmlId: "c-text", tag: "input", inputType: "text", name: "name", value: "Ada" },
              { id: "c-check", htmlId: "c-check", tag: "input", inputType: "checkbox", name: "subscribe" },
              { id: "c-select", htmlId: "c-select", tag: "select", name: "size", children: [{ id: "o-s", tag: "option", text: "Small", value: "s" }, { id: "o-m", tag: "option", text: "Medium", value: "m", selected: true }, { id: "o-l", tag: "option", text: "Large", value: "l" }] },
              { id: "c-send", htmlId: "c-send", tag: "button", text: "Send" },
            ],
          },
          dropdown,
          collapsible,
          { id: "c-auto", htmlId: "c-auto", tag: "video", src: clip, autoplay: true, muted: true, loop: true, dimensions: clipSize },
          { id: "c-video", htmlId: "c-video", tag: "video", src: clip, loop: true, dimensions: clipSize },
          { id: "c-audio", htmlId: "c-audio", tag: "audio", src: tone, loop: true },
          { id: "c-embed", tag: "iframe", src: embedSrc, title: "Hostile embed", dimensions: { preferredWidth: 640, preferredHeight: 120, offsetX: 0, offsetY: 0 } },
          {
            id: "c-free",
            tag: "div",
            layoutMode: "free",
            dimensions: { preferredWidth: 500, preferredHeight: 160, offsetX: 0, offsetY: 0 },
            children: [{ id: "c-free-text", htmlId: "c-free-text", tag: "p", text: "free text", freeLayout: { x: 20, y: 20, width: 200, height: 36 } }],
          },
          { id: "c-motion-toggle", htmlId: "c-motion-toggle", tag: "button", text: "Toggle motion box", interactions: [{ id: "i-motion", trigger: "click", action: "toggle", targetId: "c-motion" }] },
          { id: "c-motion", htmlId: "c-motion", tag: "div", transition: { property: "opacity", durationMs: 500, timingFunction: "ease", delayMs: 200 }, children: [{ id: "c-motion-text", tag: "p", text: "Animated box" }] },
        ],
      },
    ],
  };
  const domIdOf = (nodeId: string) => resolveInteractionTargets(document).find((target) => target.nodeId === nodeId)?.domId ?? "";
  return { document, dropdownMenuId: domIdOf(menu.id), collapseContentId: domIdOf(content.id) };
}

interface Side {
  name: string;
  page: Page;
  /** CSS prefix scoping the document's elements ("" on the exported page). */
  scope: string;
}

const at = (side: Side, id: string) => side.page.locator(`${side.scope}#${id}`);

/** Forms (B1): typing, checkbox, select. */
async function formScenario(side: Side) {
  await at(side, "c-text").click();
  await side.page.keyboard.press("End");
  await side.page.keyboard.type(TYPED);
  await expect(at(side, "c-text"), side.name).toHaveValue(`Ada${TYPED}`);
  await at(side, "c-check").click();
  await expect(at(side, "c-check"), side.name).toBeChecked();
  await at(side, "c-select").selectOption("l");
  await expect(at(side, "c-select"), side.name).toHaveValue("l");
}

/** Dropdown open/close by pointer and keyboard (B6 aria-expanded / aria-controls). */
async function dropdownScenario(side: Side, menuId: string) {
  const trigger = at(side, "c-dropdown");
  await expect(trigger, side.name).toHaveAttribute("aria-expanded", "false");
  await expect(trigger, side.name).toHaveAttribute("aria-controls", menuId);
  await expect(at(side, menuId), side.name).toBeHidden();
  await trigger.click();
  await expect(trigger, side.name).toHaveAttribute("aria-expanded", "true");
  await expect(at(side, menuId), side.name).toBeVisible();
  await trigger.focus();
  await side.page.keyboard.press("Enter");
  await expect(trigger, side.name).toHaveAttribute("aria-expanded", "false");
  await expect(at(side, menuId), side.name).toBeHidden();
  await side.page.keyboard.press(" ");
  await expect(trigger, side.name).toHaveAttribute("aria-expanded", "true");
  await side.page.keyboard.press("Escape");
  await expect(trigger, side.name).toHaveAttribute("aria-expanded", "false");
}

/** Media nested in a Collapsible (B2 + B5): hide pauses and keeps positions; show resumes only muted autoplay. Returns the kept positions. */
async function collapsibleMediaScenario(side: Side, contentId: string) {
  const plain = at(side, "cv-plain");
  const auto = at(side, "cv-auto");
  const sound = at(side, "cv-sound");
  const deep = at(side, "ca-deep");
  const trigger = at(side, "c-collapse");
  for (const element of [plain, auto, sound, deep]) await waitLoaded(element);
  await expectPlaying(at(side, "c-auto"), `${side.name} c-auto (top-level muted autoplay)`);
  await expectPlaying(auto, `${side.name} cv-auto (nested muted autoplay)`);
  for (const id of ["c-video", "c-audio", "cv-plain", "cv-sound", "ca-deep"]) expect((await readMedia(at(side, id))).paused, `${side.name} ${id} does not start by itself`).toBe(true);
  expect(await sound.evaluate((node: HTMLMediaElement) => ({ muted: node.muted, autoplay: node.autoplay })), `${side.name} unmuted autoplay is left as authored and not started`).toEqual({ muted: false, autoplay: false });

  await startMedia(plain);
  await side.page.waitForTimeout(700);
  await startMedia(deep);
  await expectPlaying(plain, `${side.name} cv-plain`);
  await expectPlaying(deep, `${side.name} ca-deep`);
  const sameElement = await plain.evaluate((node) => {
    Reflect.set(node, "__bc026", true);
    return true;
  });
  expect(sameElement).toBe(true);

  // Hide early in the 4 s looping clip, so a resume read right after show cannot have wrapped (a restart would read ~0).
  await expect.poll(async () => { const time = (await readMedia(auto)).time; return time > 0.8 && time < 2.0; }, { timeout: 10_000 }).toBe(true);
  await trigger.click();
  await expect(trigger, side.name).toHaveAttribute("aria-expanded", "false");
  await expect(at(side, contentId), side.name).toBeHidden();
  const kept = { plain: await expectStopped(plain, `${side.name} cv-plain hidden`), deep: await expectStopped(deep, `${side.name} ca-deep hidden`), auto: await expectStopped(auto, `${side.name} cv-auto hidden`) };
  expect(Math.abs(kept.plain - kept.deep), `${side.name}: independent positions`).toBeGreaterThan(0.3);

  await trigger.click();
  await expect(trigger, side.name).toHaveAttribute("aria-expanded", "true");
  await expect(at(side, contentId), side.name).toBeVisible();
  // Muted autoplay first, read at once: it resumed from its position, it did not restart.
  await expect.poll(async () => (await readMedia(auto)).paused, { message: `${side.name} cv-auto resumes` }).toBe(false);
  expect((await readMedia(auto)).time, `${side.name} cv-auto resumed, not restarted`).toBeGreaterThanOrEqual(kept.auto - 0.05);
  expect(await expectStopped(plain, `${side.name} cv-plain shown`)).toBeCloseTo(kept.plain, 1);
  expect(await expectStopped(deep, `${side.name} ca-deep shown`)).toBeCloseTo(kept.deep, 1);
  expect((await readMedia(sound)).paused, `${side.name} cv-sound never starts`).toBe(true);
  // Not re-created on hide/show (no remount).
  expect(await plain.evaluate((node) => Reflect.get(node, "__bc026"))).toBe(true);
}

/** Hostile cross-origin embed (B4): sandbox as approved, no fullscreen, escapes blocked. */
async function embedScenario(side: Side, iframe: Locator, expectedUrl: string) {
  await expect(iframe).toHaveAttribute("sandbox", /.+/);
  expect((await iframe.getAttribute("sandbox"))?.split(/\s+/).sort(), `${side.name} sandbox`).toEqual(["allow-forms", "allow-popups", "allow-same-origin", "allow-scripts"]);
  expect(await iframe.evaluate((element) => ({ allow: element.getAttribute("allow"), allowfullscreen: element.hasAttribute("allowfullscreen") })), `${side.name} no fullscreen grant`).toEqual({ allow: null, allowfullscreen: false });
  const frame = iframe.contentFrame();
  await expect(frame.locator("#script-top"), `${side.name} embed loaded`).toBeAttached({ timeout: 20_000 });
  expect(await frame.locator("body").evaluate(() => document.fullscreenEnabled), `${side.name} fullscreen disabled inside the embed`).toBe(false);
  await frame.locator("#script-top").click();
  await frame.locator("#link-top").click();
  await frame.locator("#link-parent").click();
  await side.page.waitForTimeout(1_200);
  expect(side.page.url(), `${side.name} not navigated by the embed`).toBe(expectedUrl);
  expect(await side.page.evaluate(() => Reflect.get(window, "__bc026Marker")), `${side.name} same window, never reloaded`).toBe("intact");
}

/**
 * Scrolls `element` into view and returns its box, after checking that a
 * pointer at the drag start point really lands on it (so a drag test can
 * never pass by missing its target).
 */
async function pointerOn(page: Page, element: Locator, nodeId: string) {
  await element.scrollIntoViewIfNeeded();
  const box = await element.boundingBox();
  if (!box) throw new Error(`no box for ${nodeId}`);
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x ?? 0, y ?? 0)?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null, [box.x + 10, box.y + box.height / 2]);
  expect(hit, `the pointer lands on ${nodeId}`).toBe(nodeId);
  return box;
}

async function transitionOf(side: Side) {
  return at(side, "c-motion").evaluate((element) => {
    const style = getComputedStyle(element);
    return { duration: style.transitionDuration, delay: style.transitionDelay, property: style.transitionProperty };
  });
}

/** Every IndexedDB record the app keeps (project library and recovery snapshots), as text. */
function storedText(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const dump: unknown[] = [];
    for (const name of ["layoutry-projects", "layoutry-recovery"]) {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      for (const store of Array.from(database.objectStoreNames)) {
        const records = await new Promise<unknown[]>((resolve, reject) => {
          const request = database.transaction(store).objectStore(store).getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        dump.push({ name, store, records });
      }
      database.close();
    }
    return JSON.stringify(dump);
  });
}

function storedProjectDocument(page: Page, projectId: string): Promise<unknown> {
  return page.evaluate(async (id) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("layoutry-projects");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise<{ text?: string } | undefined>((resolve, reject) => {
      const request = database.transaction("documents").objectStore("documents").get(id);
      request.onsuccess = () => resolve(request.result as { text?: string } | undefined);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return record?.text === undefined ? undefined : (JSON.parse(record.text) as { document?: unknown }).document;
  }, projectId);
}

const COMBINED_ID = "00000000-0000-4000-8000-000000000262";

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test.describe(`BC-02.6 combined workflow, prefers-reduced-motion: ${reducedMotion}`, () => {
    test.use({ contextOptions: { reducedMotion } });

    test("Design → Preview → Design → Preview → Export → save → reopen", async ({ page, context, browserName }) => {
      test.setTimeout(300_000);
      const embedSrc = `${attacker.origin}/attack.html?auto=1`;
      const { document, dropdownMenuId, collapseContentId } = combinedDocument(media.base, embedSrc);
      const allowedOrigins = [EDITOR, media.base.slice(0, -1), attacker.origin];
      const unexpected: string[] = [];
      const editorErrors: string[] = [];
      const blockedNavigations: string[] = [];
      const webkitMediaControlErrors: string[] = [];
      page.on("request", (request) => {
        const url = request.url();
        if (!/^(data|blob|about):/.test(url) && !allowedOrigins.some((origin) => url.startsWith(origin))) unexpected.push(url);
      });
      const onConsole = (message: ConsoleMessage) => {
        if (message.type() === "error" && message.location().url.startsWith(EDITOR)) editorErrors.push(message.text());
      };
      page.on("console", onConsole);
      page.on("pageerror", (error) => {
        // WebKit reports the sandbox refusing the embed's top navigation as a page error: that is the protection working, counted separately.
        // (WebKit splits that report into fragments; every fragment names the sandbox or the attacker's origin.)
        if (error.message.includes("is sandboxed") || error.message.includes(new URL(attacker.origin).host)) blockedNavigations.push(error.message);
        // WebKit's own JS media controls (performScheduledLayout) throw while formatting the time of media that
        // Playwright's Windows WebKit cannot load (known limitation): browser code, not the editor's.
        else if (browserName === "webkit" && (error.stack ?? "").includes("performScheduledLayout")) webkitMediaControlErrors.push(error.message);
        else editorErrors.push(`pageerror: ${error.message}\n${error.stack ?? ""}`);
      });
      page.on("dialog", (dialog) => void dialog.dismiss());

      // 1. Open the project in Design.
      await page.setViewportSize({ width: 1600, height: 1100 });
      await gotoApp(page);
      await importProject(page, document, "BC-02.6 combined", COMBINED_ID, "c-motion");
      const editorUrl = page.url();
      await page.evaluate(() => Reflect.set(window, "__bc026Marker", "intact"));
      const before = await exportedCode(page);
      const status = await page.locator("[data-project-status]").getAttribute("data-project-status");
      await expect(undo(page)).toBeDisabled();
      // Design never plays media.
      for (const id of ["c-auto", "cv-auto"]) expect((await readMedia(page.locator(`${surface} #${id}`))).paused, `Design ${id}`).toBe(true);

      // 2. Enter Preview.
      await enterPreview(page);
      const preview: Side = { name: "Preview", page, scope: `${surface} ` };
      const mediaOk = await mediaAvailable(page, at(preview, "c-auto"), browserName);

      // 3. Forms; submission cannot navigate the editor.
      await formScenario(preview);
      await at(preview, "c-text").press("Enter");
      await at(preview, "c-send").click();
      await page.waitForTimeout(500);
      expect(page.url(), "form submission did not navigate the editor").toBe(editorUrl);

      // 4. Components open and close (pointer and keyboard).
      await dropdownScenario(preview, dropdownMenuId);

      // 5–6. Hide and show media-containing content; positions and autoplay policy.
      if (mediaOk) await collapsibleMediaScenario(preview, collapseContentId);
      else {
        await at(preview, "c-collapse").click();
        await expect(at(preview, collapseContentId)).toBeHidden();
        await at(preview, "c-collapse").click();
        await expect(at(preview, collapseContentId)).toBeVisible();
      }

      // 7. Accessibility relationships after all of the above.
      const previewA11y = await runtimeSnapshot(page, surface, ["c-dropdown", "c-collapse", "c-motion-toggle"], [dropdownMenuId, collapseContentId, "c-motion"], false);
      expect(previewA11y.problems).toEqual([]);

      // 8. Hostile embed.
      await embedScenario(preview, page.locator(`${surface} [data-node-id="c-embed"] iframe`), editorUrl);

      // 9. Dragging in Preview moves nothing (checked by the export code below).
      const freeBox = await pointerOn(page, page.locator(`${surface} #c-free-text`), "c-free-text");
      await page.mouse.move(freeBox.x + 10, freeBox.y + freeBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(freeBox.x + 160, freeBox.y + 90, { steps: 12 });
      await page.mouse.up();

      // Reduced motion: computed transition, and the interaction still works.
      const previewMotion = await transitionOf(preview);
      if (reducedMotion === "reduce") {
        expect(Number.parseFloat(previewMotion.duration)).toBeLessThan(0.001);
        expect(previewMotion.delay).toBe("0s");
      } else {
        expect(previewMotion).toMatchObject({ duration: "0.5s", delay: "0.2s", property: "opacity" });
      }
      await at(preview, "c-motion-toggle").click();
      await expect(at(preview, "c-motion")).toBeHidden();
      await expect(at(preview, "c-motion-toggle")).toHaveAttribute("aria-expanded", "false");

      // 10–11. Exit Preview: all media stopped; Design editing is back.
      await exitPreview(page);
      if (mediaOk) for (const id of ["c-auto", "cv-auto", "cv-plain", "ca-deep", "c-video", "c-audio"]) await expectStopped(page.locator(`${surface} #${id}`), `${id} after Exit Preview`);
      await expect(page.locator(`${surface} [aria-expanded]`)).toHaveCount(0);
      await expect(page.locator(`${surface} [aria-controls]`)).toHaveCount(0);
      await expect(page.locator(`${surface} [id^="ly-target-"]`)).toHaveCount(0);

      // 12. Project state and history unchanged; nothing runtime reached storage.
      expect(await exportedCode(page)).toBe(before);
      await expect(page.locator("[data-project-status]")).toHaveAttribute("data-project-status", status ?? "");
      await expect(undo(page)).toBeDisabled();
      const storage = await storedText(page);
      expect(storage).not.toContain(TYPED);
      expect(storage).not.toContain("ly-target-");
      expect(storage).not.toContain("runtimeVisibility");

      // 13–14. Re-enter: runtime state is reset to the authored state.
      await enterPreview(page);
      await expect(at(preview, "c-text")).toHaveValue("Ada");
      await expect(at(preview, "c-check")).not.toBeChecked();
      await expect(at(preview, "c-select")).toHaveValue("m");
      await expect(at(preview, "c-dropdown")).toHaveAttribute("aria-expanded", "false");
      await expect(at(preview, dropdownMenuId)).toBeHidden();
      await expect(at(preview, "c-collapse")).toHaveAttribute("aria-expanded", "true");
      await expect(at(preview, "c-motion")).toBeVisible();
      if (mediaOk) {
        await expectPlaying(at(preview, "c-auto"), "c-auto restarts in the new session");
        expect((await readMedia(at(preview, "cv-sound"))).paused).toBe(true);
        expect(await at(preview, "cv-plain").evaluate((node) => Reflect.get(node, "__bc026")), "same element across sessions (no remount)").toBe(true);
      }
      await exitPreview(page);
      expect(editorErrors, "no editor console errors").toEqual([]);

      // 15–16. Export, and the same interactions on the exported page.
      const exported = await context.newPage();
      const exportUrl = await openExport(exported, document, `combined-${reducedMotion}`);
      await exported.evaluate(() => Reflect.set(window, "__bc026Marker", "intact"));
      const exportSide: Side = { name: "Export", page: exported, scope: "" };
      await formScenario(exportSide);
      await dropdownScenario(exportSide, dropdownMenuId);
      if (mediaOk) await collapsibleMediaScenario(exportSide, collapseContentId);
      const exportA11y = await runtimeSnapshot(exported, "body", ["c-dropdown", "c-collapse", "c-motion-toggle"], [dropdownMenuId, collapseContentId, "c-motion"], false);
      expect(exportA11y.problems).toEqual([]);
      expect(exportA11y.triggers, "Preview and Export expose the same trigger relationships").toEqual(previewA11y.triggers);
      expect(await transitionOf(exportSide)).toEqual(previewMotion);
      await embedScenario(exportSide, exported.locator("iframe"), exportUrl);
      await at(exportSide, "c-motion-toggle").click();
      await expect(at(exportSide, "c-motion")).toBeHidden();
      await exported.close();

      // 17–18. Save, reload, reopen: authored content and settings preserved, no runtime values.
      await page.keyboard.press("Control+s");
      await expect(page.locator("[data-project-status]")).toHaveAttribute("data-project-status", "saved");
      expect(await storedProjectDocument(page, COMBINED_ID)).toEqual(document);
      await page.reload();
      await gotoApp(page);
      await page.keyboard.press("Control+o");
      const library = page.getByRole("dialog", { name: "Open Project" });
      await library.getByRole("button", { name: "Open BC-02.6 combined" }).click();
      await expect(library).toBeHidden();
      await page.locator(`${surface} [data-node-id="c-motion"]`).waitFor({ state: "attached" });
      expect(await exportedCode(page), "reopened project exports identically").toBe(before);
      await expect(undo(page)).toBeDisabled();
      expect(await storedText(page)).not.toContain(TYPED);

      // Design editing still works after all of this: a Design drag moves the free element, Undo restores it.
      const designBox = await pointerOn(page, page.locator(`${surface} [data-node-id="c-free-text"]`), "c-free-text");
      await page.mouse.click(designBox.x + 10, designBox.y + designBox.height / 2);
      await page.mouse.move(designBox.x + 10, designBox.y + designBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(designBox.x + 60, designBox.y + designBox.height / 2 + 40, { steps: 12 });
      await page.mouse.up();
      await expect(undo(page)).toBeEnabled();
      expect(await exportedCode(page), "a Design drag edits the document").not.toBe(before);
      await undo(page).click();
      expect(await exportedCode(page)).toBe(before);

      expect(unexpected, "no requests outside the editor, media and embed origins").toEqual([]);
      test.info().annotations.push({ type: "evidence", description: `editor page errors: ${editorErrors.length}; sandbox-blocked navigation reports: ${blockedNavigations.length}; WebKit media-control errors: ${webkitMediaControlErrors.length}` });
      console.log(`[BC-02.6 combined ${browserName} ${reducedMotion}] media verified: ${mediaOk}; sandbox-blocked navigation reports: ${blockedNavigations.length}; WebKit media-control errors: ${webkitMediaControlErrors.length}`);
      if (!mediaOk) test.info().annotations.push({ type: "not-verified", description: "media steps 5, 6, 11 and the Export media run were skipped (WebKit limitation)" });
    });
  });
}

/* ------------------------------------------------ 3. lifecycle */

test.describe("BC-02.6 lifecycle: repeated Preview sessions", () => {
  test("listeners, DOM nodes, timers and playing media stay bounded over 25 sessions (Chromium, CDP)", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "CDP Performance metrics exist only in Chromium; the other browsers run the functional repeats in the combined workflow");
    test.setTimeout(240_000);
    await page.addInitScript(() => {
      const active = new Set<number>();
      const setIntervalOriginal = window.setInterval.bind(window);
      const clearIntervalOriginal = window.clearInterval.bind(window);
      window.setInterval = ((handler: TimerHandler, timeout?: number, ...rest: unknown[]) => {
        const id = setIntervalOriginal(handler, timeout, ...rest);
        active.add(id);
        return id;
      }) as typeof window.setInterval;
      window.clearInterval = ((id?: number) => {
        if (id !== undefined) active.delete(id);
        clearIntervalOriginal(id);
      }) as typeof window.clearInterval;
      Reflect.set(window, "__bc026Intervals", () => active.size);
    });
    const { document: lifecycleDocument, collapseContentId, dropdownMenuId } = combinedDocument(media.base, `${attacker.origin}/widget.html`);
    await page.setViewportSize({ width: 1600, height: 1100 });
    await gotoApp(page);
    await importProject(page, lifecycleDocument, "BC-02.6 lifecycle", "00000000-0000-4000-8000-000000000263", "c-motion");
    const before = await exportedCode(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const measure = async () => {
      await cdp.send("HeapProfiler.collectGarbage");
      await page.waitForTimeout(300);
      await cdp.send("HeapProfiler.collectGarbage");
      const { metrics } = await cdp.send("Performance.getMetrics");
      const value = (name: string) => metrics.find((metric) => metric.name === name)?.value ?? Number.NaN;
      const intervals = await page.evaluate(() => (Reflect.get(window, "__bc026Intervals") as () => number)());
      const playing = await page.evaluate(() => Array.from(document.querySelectorAll("video, audio")).filter((element) => !(element as HTMLMediaElement).paused).length);
      return { listeners: value("JSEventListeners"), nodes: value("Nodes"), heapMB: Math.round((value("JSHeapUsedSize") / 1048576) * 10) / 10, intervals, playing };
    };
    const session = async () => {
      await enterPreview(page);
      await page.locator(`${surface} #c-collapse`).click();
      await page.locator(`${surface} #c-collapse`).click();
      await page.locator(`${surface} #c-dropdown`).click();
      await page.locator(`${surface} #c-dropdown`).click();
      await page.locator(`${surface} #c-text`).fill("typed");
      await exitPreview(page);
    };

    for (let index = 0; index < 5; index++) await session();
    const warm = await measure();
    const samples = [warm];
    for (let block = 0; block < 4; block++) {
      for (let index = 0; index < 5; index++) await session();
      samples.push(await measure());
    }
    const final = samples[samples.length - 1] ?? warm;
    console.log(`[BC-02.6 lifecycle] after 5/10/15/20/25 sessions: ${JSON.stringify(samples)}`);
    test.info().annotations.push({ type: "lifecycle", description: JSON.stringify(samples) });

    for (const sample of samples) expect(sample.playing, "no media left playing in Design").toBe(0);
    // Bounded, not "leak-free": steady state after warm-up may move a little
    // (React dev bookkeeping, GC timing), but must not grow per session.
    expect(final.listeners - warm.listeners, "event listeners do not accumulate").toBeLessThanOrEqual(10);
    expect(final.nodes - warm.nodes, "DOM nodes do not accumulate").toBeLessThanOrEqual(150);
    expect(final.intervals - warm.intervals, "intervals do not accumulate").toBeLessThanOrEqual(0);
    expect(final.heapMB, "heap does not grow without bound").toBeLessThan(warm.heapMB * 1.25 + 5);

    // Every session started from the authored state and left the document untouched.
    await enterPreview(page);
    await expect(page.locator(`${surface} #c-text`)).toHaveValue("Ada");
    await expect(page.locator(`${surface} #${dropdownMenuId}`)).toBeHidden();
    await expect(page.locator(`${surface} #${collapseContentId}`)).toBeVisible();
    await exitPreview(page);
    expect(await exportedCode(page)).toBe(before);
    await expect(undo(page)).toBeDisabled();
  });
});
