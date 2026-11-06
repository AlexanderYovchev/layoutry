import { expect, test, type Locator, type Page } from "@playwright/test";
import { exportHtmlCss } from "../src/features/export/utils/exportHtmlCss";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { gotoApp } from "./support/gotoApp";
import { componentsDocument, hiddenMediaDocument, importDocument, motionDocument, startParityServer, type ParityServer } from "./support/parityFixtures";

/*
 * BC-02.5 — Preview/Export parity:
 * - B5: media inside a target that an interaction hides stops, in Preview
 *   and on the exported page, and is not started again just because it is
 *   shown (only muted autoplay starts, by its own setting).
 * - B6: triggers expose the same aria-expanded / aria-haspopup state in
 *   Preview as on the exported page, at every step.
 * - B7: authored transitions follow prefers-reduced-motion the same way.
 * Media state is read from the element (paused, currentTime advancing),
 * accessibility state from the DOM attributes, motion from computed styles
 * and measured timing.
 */

let server: ParityServer;

test.beforeAll(async () => {
  server = await startParityServer();
});

test.afterAll(async () => {
  await server.close();
});

const surface = "[data-document-surface]";
const enterPreview = (page: Page) => page.getByRole("button", { name: "Enter Preview" }).click();
const exitPreview = (page: Page) => page.getByRole("button", { name: "Exit Preview" }).click();

async function openInEditor(page: Page, document: EditorElementNode, waitFor: string) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await gotoApp(page);
  await importDocument(page, document, waitFor);
}

async function openExport(page: Page, document: EditorElementNode, name: string) {
  const result = exportHtmlCss(document, { mode: "standalone", title: name });
  expect(result.ok).toBe(true);
  const html = result.files.find((file) => file.path.endsWith(".html"))?.content ?? "";
  // Not "load": WebKit on Windows never finishes loading media, which would hold it forever.
  await page.goto(server.host(`/${name}.html`, html), { waitUntil: "domcontentloaded" });
  return html;
}

interface MediaState {
  paused: boolean;
  time: number;
}

const readMedia = (media: Locator): Promise<MediaState> => media.evaluate((element: HTMLMediaElement) => ({ paused: element.paused, time: element.currentTime }));

async function waitLoaded(media: Locator) {
  await expect.poll(() => media.evaluate((element: HTMLMediaElement) => element.readyState), { timeout: 20_000 }).toBeGreaterThanOrEqual(3);
}

async function expectPlaying(media: Locator, label: string) {
  await expect.poll(async () => (await readMedia(media)).paused, { message: `${label} should play` }).toBe(false);
  const start = (await readMedia(media)).time;
  // Looping clips can wrap around to 0, so "advancing" means the position keeps changing.
  await expect.poll(async () => Math.abs((await readMedia(media)).time - start), { message: `${label} should advance` }).toBeGreaterThan(0.2);
}

async function expectStopped(media: Locator, label: string): Promise<number> {
  await expect.poll(async () => (await readMedia(media)).paused, { message: `${label} should be paused` }).toBe(true);
  const at = (await readMedia(media)).time;
  await new Promise((resolve) => setTimeout(resolve, 400));
  expect((await readMedia(media)).time, `${label} must not advance`).toBe(at);
  return at;
}

async function start(media: Locator) {
  expect(await media.evaluate((element: HTMLMediaElement) => element.play().then(() => "playing", (error: Error) => error.name))).toBe("playing");
}

interface Side {
  name: string;
  page: Page;
  /** CSS scope prefix for the document's elements. */
  scope: string;
}

/**
 * B5 + BC-02.5.1, one scenario for both runtimes, so parity is by
 * construction: hiding stops every media element at any depth and keeps
 * each one's position; showing resumes nothing ordinary, resumes muted
 * autoplay from where it stopped, and never starts unmuted media.
 */
async function hiddenMediaScenario({ name, page, scope }: Side) {
  const at = (id: string) => page.locator(`${scope}#${id}`);
  const loop = at("v-loop");
  const auto = at("v-auto");
  const sound = at("v-sound");
  const deep = at("a-deep");
  const toggle = page.getByRole("button", { name: "Toggle panel" });
  for (const media of [loop, auto, sound, deep]) await waitLoaded(media);

  // Two ordinary elements started at different moments, so their positions differ.
  await page.locator(`${scope}#b-panel`).focus();
  await start(loop);
  await page.waitForTimeout(700);
  await start(deep);
  await expectPlaying(loop, `${name} v-loop`);
  await expectPlaying(deep, `${name} a-deep`);
  await expectPlaying(auto, `${name} v-auto`);
  expect((await readMedia(sound)).paused, `${name}: unmuted autoplay never starts`).toBe(true);

  for (let round = 0; round < 3; round++) {
    // Hide while muted autoplay is well inside the 4 s clip, so "resumed" and
    // "restarted" can be told apart (the clip loops).
    await expect.poll(async () => { const time = (await readMedia(auto)).time; return time > 0.8 && time < 2.8; }, { timeout: 10_000 }).toBe(true);
    await toggle.click();
    await expect(loop, `${name} panel hidden`).toBeHidden();
    const kept: Record<string, number> = {};
    for (const [label, media] of [["v-loop", loop], ["a-deep", deep], ["v-auto", auto], ["v-sound", sound]] as const) {
      kept[label] = await expectStopped(media, `${name} ${label} while hidden (round ${round})`);
    }
    if (round === 0) expect(Math.abs((kept["v-loop"] ?? 0) - (kept["a-deep"] ?? 0)), `${name}: independent positions`).toBeGreaterThan(0.3);

    await toggle.click();
    await expect(loop, `${name} panel shown`).toBeVisible();
    // Ordinary media: still paused, at the same position.
    expect(await expectStopped(loop, `${name} v-loop after show`)).toBeCloseTo(kept["v-loop"] ?? -1, 1);
    expect(await expectStopped(deep, `${name} a-deep after show`)).toBeCloseTo(kept["a-deep"] ?? -1, 1);
    // Unmuted autoplay: never started by being shown.
    expect((await readMedia(sound)).paused, `${name} v-sound after show`).toBe(true);
    // Muted autoplay: resumes from its position (it does not restart from 0).
    await expect.poll(async () => (await readMedia(auto)).paused, { message: `${name} v-auto resumes` }).toBe(false);
    expect((await readMedia(auto)).time, `${name} v-auto resumed from ${kept["v-auto"]}`).toBeGreaterThanOrEqual((kept["v-auto"] ?? 0) - 0.05);
    // Play the ordinary ones again, as a user would, before the next round.
    await start(loop);
    await start(deep);
  }
}

test.describe("B5 + BC-02.5.1: media in a hidden target", () => {
  test("Preview: hiding pauses and keeps positions; showing resumes only muted autoplay", async ({ page }) => {
    await openInEditor(page, hiddenMediaDocument(server.base), "v-loop");
    await enterPreview(page);
    await hiddenMediaScenario({ name: "Preview", page, scope: `${surface} ` });

    // Hidden content stays mounted but is not displayed, focusable or clickable.
    await page.getByRole("button", { name: "Toggle panel" }).click();
    const panel = page.locator(`${surface} [data-node-id="d-panel"]`);
    await expect(panel).toHaveCount(1);
    await expect(panel).toBeHidden();
    expect(await panel.evaluate((element) => getComputedStyle(element).display)).toBe("none");
    await page.locator(`${surface} #b-panel`).focus();
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.activeElement?.closest('[data-node-id="d-panel"]') === null)).toBe(true);

    // An initially hidden target: nothing inside plays; showing it starts only muted autoplay.
    await expect(page.locator(`${surface} #v-hidden-auto`)).toBeHidden();
    await waitLoaded(page.locator(`${surface} #v-hidden-auto`));
    expect((await readMedia(page.locator(`${surface} #v-hidden-auto`))).paused).toBe(true);
    await page.getByRole("button", { name: "Toggle hidden" }).click();
    await expectPlaying(page.locator(`${surface} #v-hidden-auto`), "v-hidden-auto");
    await expectStopped(page.locator(`${surface} #v-hidden-plain`), "v-hidden-plain");

    // Leaving Preview stops everything; re-entering is a fresh session (authored visibility).
    await exitPreview(page);
    for (const id of ["v-loop", "v-auto", "a-deep", "v-hidden-auto"]) await expectStopped(page.locator(`${surface} #${id}`), `${id} after Exit Preview`);
    await enterPreview(page);
    await expect(page.locator(`${surface} #v-loop`)).toBeVisible();
    await expect(page.locator(`${surface} #v-hidden-auto`)).toBeHidden();
    expect((await readMedia(page.locator(`${surface} #v-hidden-auto`))).paused).toBe(true);
    await exitPreview(page);
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  });

  test("Export: the same scenario gives the same results", async ({ page }) => {
    await openExport(page, hiddenMediaDocument(server.base), "hidden-media");
    await hiddenMediaScenario({ name: "Export", page, scope: "" });
    const hiddenAuto = page.locator("#v-hidden-auto");
    await waitLoaded(hiddenAuto);
    expect((await readMedia(hiddenAuto)).paused).toBe(true);
    await page.getByRole("button", { name: "Toggle hidden" }).click();
    await expectPlaying(hiddenAuto, "v-hidden-auto after show");
    await expectStopped(page.locator("#v-hidden-plain"), "v-hidden-plain after show");
  });
});

interface AriaSnapshot {
  [triggerId: string]: { controls: string | null; expanded: string | null; haspopup: string | null; visible: boolean };
}

async function ariaSnapshot(page: Page, scope: string, triggerIds: string[]): Promise<AriaSnapshot> {
  const snapshot: AriaSnapshot = {};
  for (const id of triggerIds) {
    const trigger = page.locator(`${scope} #${id}`);
    const count = await trigger.count();
    snapshot[id] = count === 0 ? { controls: null, expanded: null, haspopup: null, visible: false } : { controls: await trigger.getAttribute("aria-controls"), expanded: await trigger.getAttribute("aria-expanded"), haspopup: await trigger.getAttribute("aria-haspopup"), visible: await trigger.isVisible() };
  }
  return snapshot;
}


/**
 * aria-controls validity (BC-02.5.1), in any state: every id a trigger
 * references exists exactly once in the rendered document, and no id is
 * used twice. Hidden targets count, because they stay in the DOM.
 */
async function expectValidRelationships(page: Page, scope: string, label: string) {
  const problems = await page.evaluate((rootSelector) => {
    const root = document.querySelector(rootSelector);
    if (!root) return ["no document root"];
    const found: string[] = [];
    const counts = new Map<string, number>();
    for (const element of Array.from(root.querySelectorAll("[id]"))) counts.set(element.id, (counts.get(element.id) ?? 0) + 1);
    for (const [id, count] of counts) if (count > 1) found.push(`duplicate id ${id}`);
    for (const trigger of Array.from(root.querySelectorAll("[aria-controls]"))) {
      for (const id of (trigger.getAttribute("aria-controls") ?? "").split(" ")) if (counts.get(id) !== 1) found.push(`${trigger.id} controls missing ${id}`);
    }
    return found;
  }, scope === "body" ? "body" : scope);
  expect(problems, label).toEqual([]);
}
test.describe("B6: aria-expanded in Preview matches the exported page", () => {
  test("every trigger of every built-in component, initially and after each open and close", async ({ page, context }) => {
    test.setTimeout(120_000);
    const { document, triggerIds } = componentsDocument();
    await openInEditor(page, document, document.children?.[0]?.children?.[0]?.id ?? "");
    await enterPreview(page);
    const exported = await context.newPage();
    await openExport(exported, document, "components");

    const both = async (label: string) => {
      const preview = await ariaSnapshot(page, surface, triggerIds);
      const exportedState = await ariaSnapshot(exported, "body", triggerIds);
      expect(preview, label).toEqual(exportedState);
      await expectValidRelationships(page, surface, `Preview ${label}`);
      await expectValidRelationships(exported, "body", `Export ${label}`);
      return preview;
    };

    const initial = await both("initial");
    // The disclosure triggers (2 Dropdowns, 2 Collapsibles, Popover toggle a target) report a state; the
    // Modal opener announces a dialog. Show/hide-only triggers (Drawer, Tabs, Toast, Alert) get none.
    expect(Object.values(initial).filter((entry) => entry.expanded !== null).length).toBe(5);
    // Every button trigger names what it controls (BC-02.5.1), with its own ids.
    expect(Object.values(initial).every((entry) => entry.controls !== null)).toBe(true);
    expect(Object.values(initial).some((entry) => entry.haspopup === "dialog")).toBe(true);
    expect(Object.values(initial).filter((entry) => entry.expanded !== null).every((entry) => entry.expanded === "false" || entry.expanded === "true")).toBe(true);

    const fresh = async () => {
      // Each trigger starts from the authored state on both sides: Preview
      // restarts from its initial visibility, the exported page reloads.
      await exitPreview(page);
      await enterPreview(page);
      await exported.reload();
    };

    for (const id of triggerIds) {
      await fresh();
      const state = (await both(`before ${id}`))[id];
      if (!state?.visible) continue;
      await page.locator(`${surface} #${id}`).click();
      await exported.locator(`#${id}`).click();
      const opened = await both(`after clicking ${id}`);
      if (state.expanded !== null) expect(opened[id]?.expanded, `${id} flips`).not.toBe(state.expanded);
      if ((opened[id]?.visible ?? false) && state.expanded !== null) {
        // Toggle back the same way (keyboard activation: Enter on the focused trigger).
        await page.locator(`${surface} #${id}`).focus();
        await page.keyboard.press("Enter");
        await exported.locator(`#${id}`).focus();
        await exported.keyboard.press("Enter");
        const closed = await both(`after toggling ${id} back with Enter`);
        expect(closed[id]?.expanded).toBe(state.expanded);
      }
      // An opened dialog closes with Escape in both, natively.
      if ((await page.locator(`${surface} dialog[open]`).count()) > 0) {
        await page.keyboard.press("Escape");
        await exported.keyboard.press("Escape");
        await expect(page.locator(`${surface} dialog[open]`)).toHaveCount(0);
        await expect(exported.locator("dialog[open]")).toHaveCount(0);
        await both(`after closing the dialog opened by ${id}`);
      }
    }
    // A disclosure that is open closes on Escape in both runtimes, and its trigger reports it.
    await fresh();
    await page.locator(`${surface} #t-1`).click();
    await exported.locator("#t-1").click();
    expect((await both("dropdown open"))["t-1"]?.expanded).toBe("true");
    await page.keyboard.press("Escape");
    await exported.keyboard.press("Escape");
    expect((await both("dropdown closed by Escape"))["t-1"]?.expanded).toBe("false");
    await exitPreview(page);
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
    await exported.close();
  });

  test("Design shows no runtime ARIA state; it appears only in Preview", async ({ page }) => {
    const { document } = componentsDocument();
    await openInEditor(page, document, document.children?.[0]?.children?.[0]?.id ?? "");
    await expect(page.locator(`${surface} [aria-expanded]`)).toHaveCount(0);
    await enterPreview(page);
    await expect(page.locator(`${surface} [aria-expanded]`).first()).toBeAttached();
    await exitPreview(page);
    await expect(page.locator(`${surface} [aria-expanded]`)).toHaveCount(0);
  });
});

async function motion(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) => {
    const style = getComputedStyle(element);
    return { duration: style.transitionDuration, delay: style.transitionDelay, property: style.transitionProperty };
  });
}

/**
 * Changes opacity from 1 to 0.25 and reports the computed value 400 ms later:
 * complete under reduced motion; still mid-transition otherwise (the authored
 * transition waits 200 ms, then runs 500 ms). 400 ms, not less: headless
 * WebKit applies even a 0.01ms transition only on a later rendering update.
 */
async function opacityAfter400ms(page: Page, selector: string): Promise<string> {
  // WebKit does not run transitions in a background tab, so measure on the front page.
  await page.bringToFront();
  return page.locator(selector).evaluate(async (element: HTMLElement) => {
    element.style.setProperty("opacity", "0.25");
    await new Promise((resolve) => setTimeout(resolve, 400));
    const value = getComputedStyle(element).opacity;
    element.style.removeProperty("opacity");
    return value;
  });
}

for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test.describe(`B7: authored motion with prefers-reduced-motion: ${reducedMotion}`, () => {
    test.use({ contextOptions: { reducedMotion } });

    test("Preview and the exported page compute the same transition and behave the same", async ({ page, context }) => {
      await openInEditor(page, motionDocument(), "d-motion");
      await enterPreview(page);
      const exported = await context.newPage();
      await openExport(exported, motionDocument(), `motion-${reducedMotion}`);

      const previewMotion = await motion(page, `${surface} #d-motion`);
      const exportMotion = await motion(exported, "#d-motion");
      expect(previewMotion).toEqual(exportMotion);
      if (reducedMotion === "reduce") {
        expect(Number.parseFloat(previewMotion.duration)).toBeLessThan(0.001);
        expect(previewMotion.delay).toBe("0s");
        expect(await opacityAfter400ms(page, `${surface} #d-motion`)).toBe("0.25");
        expect(await opacityAfter400ms(exported, "#d-motion")).toBe("0.25");
      } else {
        expect(previewMotion).toMatchObject({ duration: "0.5s", delay: "0.2s", property: "opacity" });
        expect(Number(await opacityAfter400ms(page, `${surface} #d-motion`))).toBeGreaterThan(0.25);
        expect(Number(await opacityAfter400ms(exported, "#d-motion"))).toBeGreaterThan(0.25);
      }

      // The interaction itself works the same either way.
      await page.getByRole("button", { name: "Toggle box" }).click();
      await exported.getByRole("button", { name: "Toggle box" }).click();
      await expect(page.locator(`${surface} #d-motion`)).toBeHidden();
      await expect(exported.locator("#d-motion")).toBeHidden();
      await exported.close();

      // The authored transition is unchanged in the document.
      await exitPreview(page);
      await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
    });
  });
}

test.describe("cross-defect: an expandable panel with media, under reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("aria-expanded, media and reduced motion agree in Preview and on the exported page; Preview exit and re-entry start clean", async ({ page, context }) => {
    const document = hiddenMediaDocument(server.base);
    await openInEditor(page, document, "v-loop");
    const exported = await context.newPage();
    await openExport(exported, document, "cross-defect");
    await enterPreview(page);

    const sides = [
      { name: "Preview", page, scope: `${surface} ` },
      { name: "Export", page: exported, scope: "" },
    ];
    for (const side of sides) {
      const trigger = side.page.locator(`${side.scope}#b-hidden`);
      await expect(trigger, side.name).toHaveAttribute("aria-expanded", "false");
      await trigger.click();
      await expect(trigger, side.name).toHaveAttribute("aria-expanded", "true");
      const video = side.page.locator(`${side.scope}#v-hidden-auto`);
      await waitLoaded(video);
      await expectPlaying(video, `${side.name} v-hidden-auto shown`);
      expect(await side.page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), `${side.name} runs with reduced motion`).toBe(true);
      const handle = await video.elementHandle();
      await trigger.click();
      await expect(trigger, side.name).toHaveAttribute("aria-expanded", "false");
      expect(await handle?.evaluate((element: HTMLMediaElement) => element.paused), `${side.name} paused when hidden`).toBe(true);
      await trigger.click();
      await expectPlaying(video, `${side.name} v-hidden-auto shown again`);
    }

    // B3: leaving Preview while it plays stops it; re-entering starts from the authored state.
    const playing = page.locator(`${surface} #v-hidden-auto`);
    await exitPreview(page);
    await expectStopped(playing, "after Exit Preview");
    await expect(page.locator(`${surface} [aria-expanded]`)).toHaveCount(0);
    await enterPreview(page);
    await expect(page.locator(`${surface} #b-hidden`)).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(`${surface} #v-hidden-auto`)).toBeHidden();
    await exitPreview(page);
    await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
    await exported.close();
  });
});

test("document integrity: a Preview session with hide/show, media and Escape changes nothing authored", async ({ page }) => {
  await openInEditor(page, hiddenMediaDocument(server.base), "v-loop");
  const exportedCode = async () => {
    await page.getByRole("button", { name: "Export Code" }).click();
    const code = page.getByRole("dialog", { name: "Export Code" }).getByTestId("export-code");
    await expect(code).toBeVisible();
    const text = (await code.textContent()) ?? "";
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Export Code" })).toHaveCount(0);
    return text;
  };
  const before = await exportedCode();
  const status = await page.locator("[data-project-status]").getAttribute("data-project-status");
  for (let session = 0; session < 2; session++) {
    await enterPreview(page);
    await waitLoaded(page.locator(`${surface} #v-loop`));
    await start(page.locator(`${surface} #v-loop`));
    await page.getByRole("button", { name: "Toggle panel" }).click();
    await page.getByRole("button", { name: "Toggle hidden" }).click();
    await page.getByRole("button", { name: "Toggle panel" }).click();
    await page.keyboard.press("Escape");
    if (await page.getByRole("button", { name: "Exit Preview" }).count()) await exitPreview(page);
  }
  expect(await exportedCode()).toBe(before);
  await expect(page.locator("[data-project-status]")).toHaveAttribute("data-project-status", status ?? "");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
});
