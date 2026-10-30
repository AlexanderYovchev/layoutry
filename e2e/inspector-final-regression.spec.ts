import { expect, test, type Locator, type Page } from "@playwright/test";
import { buildExportDocument } from "../src/features/export/utils/buildExportDocument";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { gotoApp } from "./support/gotoApp";
import { CANVAS_ROOT, PAGE_WIDTH, openExport } from "./support/exportHarness";
import {
  compareMeasurements,
  exportElementKeys,
  measureCanvas,
  measureExport,
} from "./support/exportParity";
import {
  clickInspectorChrome,
  computed,
  expectUndoAvailable,
  replaceText,
  selectOnCanvas,
} from "./support/inspector";

/**
 * BC-01.6 — final regression of the live CSS Inspector (BC-01.2-01.5) as a
 * whole: real Inspector edits across sections, verified live on the
 * Canvas, then Preview vs exported HTML/CSS over every computed property
 * the export parity harness compares, then save -> reload -> reopen, plus
 * history, keyboard, accessibility and cleanup checks.
 */

const status = (page: Page) => page.locator("[data-project-status]");

async function undo(page: Page) {
  // Ctrl+Z is deliberately ignored while focus is inside an input.
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  await page.keyboard.press("Control+z");
}

async function saveNewProject(page: Page, name: string) {
  await page.keyboard.press("Control+s");
  const dialog = page.getByRole("dialog", { name: "Save Project" });
  await dialog.getByRole("textbox", { name: "Project name" }).fill(name);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(status(page)).toHaveAttribute("data-project-status", "saved");
}

/** Ctrl+S with nothing focused. Project commands refuse to run while ANY transaction is open, so "saved" also proves none was left orphaned. */
async function saveAndExpectNoOpenTransaction(page: Page) {
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  await page.keyboard.press("Control+s");
  await expect(status(page)).toHaveAttribute("data-project-status", "saved");
}

function savedDocument(page: Page): Promise<EditorElementNode> {
  return page.evaluate(
    () =>
      new Promise<EditorElementNode>((resolve, reject) => {
        const request = indexedDB.open("layoutry-projects");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const all = database
            .transaction("documents")
            .objectStore("documents")
            .getAll();
          all.onsuccess = () => {
            database.close();
            resolve(JSON.parse(all.result[0].text).document);
          };
          all.onerror = () => reject(all.error);
        };
      }),
  );
}

/** The section panel whose header is `name` (labels such as "Blur" exist in several sections). */
async function section(page: Page, name: string): Promise<Locator> {
  const header = page.getByRole("button", { name, exact: true }).first();
  const id = await header.getAttribute("id");
  return page.locator(`[aria-labelledby="${id}"]`);
}

/** Types `value` into the field, checks the Canvas changed BEFORE blur (live), then commits with Enter. */
async function liveEdit(
  page: Page,
  field: Locator,
  value: string,
  check: { id: string; property: string; expected: string | RegExp },
) {
  await field.click();
  await field.press("Control+a");
  await page.keyboard.type(value);
  const poll = expect.poll(() => computed(page, check.id, check.property));
  if (typeof check.expected === "string") await poll.toBe(check.expected);
  else await poll.toMatch(check.expected);
  await expect(field).toBeFocused();
  await field.press("Enter");
}

const byLabel = (scope: Page | Locator, label: string) =>
  scope.getByLabel(label, { exact: true }).first();

async function enterPreviewAtExportWidth(page: Page) {
  await page.addStyleTag({
    content: `[data-document-surface] { width: ${PAGE_WIDTH + 2}px !important; max-width: none !important; }`,
  });
  await page.getByRole("button", { name: "Enter Preview" }).click();
  await expect(
    page.getByRole("button", { name: "Exit Preview" }),
  ).toBeVisible();
  await page.mouse.move(0, 0);
}

test.describe("live edit matrix -> Canvas, Preview, Export, save and reopen", () => {
  test("numeric and color edits across sections go live, then Preview == Export on every compared property, and survive save/reopen", async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1600, height: 1000 });
    await gotoApp(page);
    await saveNewProject(page, "BC-01.6 matrix");

    // Heading — typography numeric + color.
    await selectOnCanvas(page, "heading-1");
    await liveEdit(page, byLabel(page, "Font size"), "44", {
      id: "heading-1",
      property: "font-size",
      expected: "44px",
    });
    await liveEdit(page, byLabel(page, "Line height"), "1.3", {
      id: "heading-1",
      property: "line-height",
      // WebKit reports 57.200001px for the same value.
      expected: /^57\.2(0000\d)?px$/,
    });
    await liveEdit(page, byLabel(page, "Letter spacing"), "1", {
      id: "heading-1",
      property: "letter-spacing",
      expected: "1px",
    });
    await liveEdit(page, byLabel(page, "Text color"), "#aa0000", {
      id: "heading-1",
      property: "color",
      expected: "rgb(170, 0, 0)",
    });

    // Paragraph — spacing.
    await selectOnCanvas(page, "paragraph-1");
    await liveEdit(page, byLabel(page, "Padding (all sides)"), "12", {
      id: "paragraph-1",
      property: "padding-top",
      expected: "12px",
    });
    await liveEdit(page, byLabel(page, "Margin (all sides)"), "8", {
      id: "paragraph-1",
      property: "margin-top",
      expected: "8px",
    });

    // Button — size, border, radius, background, transform, opacity, shadow.
    await selectOnCanvas(page, "button-1");
    await liveEdit(page, byLabel(page, "Width"), "260", {
      id: "button-1",
      property: "width",
      expected: "260px",
    });
    await liveEdit(page, byLabel(page, "Border width"), "2", {
      id: "button-1",
      property: "border-top-width",
      expected: "2px",
    });
    await liveEdit(page, byLabel(page, "Border color"), "#0000ff", {
      id: "button-1",
      property: "border-top-color",
      expected: "rgb(0, 0, 255)",
    });
    await liveEdit(page, byLabel(page, "Border radius"), "14", {
      id: "button-1",
      property: "border-top-left-radius",
      expected: "14px",
    });
    await liveEdit(page, byLabel(page, "Background color"), "#ffeeaa", {
      id: "button-1",
      property: "background-color",
      expected: "rgb(255, 238, 170)",
    });
    await liveEdit(page, byLabel(page, "Rotate"), "90", {
      id: "button-1",
      property: "transform",
      expected: /^matrix\((6\.1\d*e-17|0), 1, -1/,
    });
    await liveEdit(page, byLabel(page, "Opacity (exact value)"), "80", {
      id: "button-1",
      property: "opacity",
      expected: "0.8",
    });
    const shadow = await section(page, "Box Shadow");
    // With no layers yet, the section offers a single "Add Shadow" button.
    await shadow
      .getByRole("button", { name: "Add Shadow", exact: true })
      .click();
    await liveEdit(page, byLabel(shadow, "Blur"), "9", {
      id: "button-1",
      property: "box-shadow",
      expected: /9px/,
    });
    await liveEdit(page, byLabel(shadow, "Shadow color"), "#00ff00", {
      id: "button-1",
      property: "box-shadow",
      expected: /rgb\(0, 255, 0\)/,
    });

    // Section — gradient (numeric + color).
    await selectOnCanvas(page, "section-2");
    await (
      await section(page, "Background")
    )
      .getByRole("button", { name: "Gradient", exact: true })
      .click();
    await liveEdit(page, byLabel(page, "Angle"), "45", {
      id: "section-2",
      property: "background-image",
      expected: /45deg/,
    });
    await liveEdit(page, byLabel(page, "Gradient stop color"), "#ff00ff", {
      id: "section-2",
      property: "background-image",
      expected: /rgb\(255, 0, 255\)/,
    });

    // Image — filters, translate.
    await selectOnCanvas(page, "image-1");
    await liveEdit(page, byLabel(page, "Brightness"), "120", {
      id: "image-1",
      property: "filter",
      expected: /brightness\(1\.2\)/,
    });
    await liveEdit(page, byLabel(page, "Translate X"), "6", {
      id: "image-1",
      property: "transform",
      expected: /, 6, 0\)$/,
    });

    // Persist, then compare Preview with the exported page.
    await saveAndExpectNoOpenTransaction(page);
    const document = await savedDocument(page);
    const built = buildExportDocument(document);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const keys = exportElementKeys(built.document.root);

    await enterPreviewAtExportWidth(page);
    const preview = await measureCanvas(page);
    const height = await page
      .locator(CANVAS_ROOT)
      .evaluate((element) => element.getBoundingClientRect().height);
    const exportPage = await context.newPage();
    await openExport(exportPage, document, "standalone", { height });
    const exported = await measureExport(exportPage, keys);
    const parity = compareMeasurements(preview, exported);
    await testInfo.attach("parity.json", {
      body: JSON.stringify(
        {
          elements: parity.compared,
          propertyChecks: parity.propertyChecks,
          differences: parity.differences,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
    expect(parity.differences).toEqual([]);
    expect(parity.compared).toBeGreaterThan(5);

    // The edited values are what Preview shows (not just equal to export).
    const byKey = new Map(
      preview.map((element) => [element.key, element] as const),
    );
    const style = (key: string, property: string) =>
      byKey.get(key)?.style[property];
    expect(style("heading-1", "font-size")).toBe("44px");
    expect(style("paragraph-1", "padding-top")).toBe("12px");
    expect(style("button-1", "border-top-width")).toBe("2px");
    expect(style("image-1", "filter")).toBe("brightness(1.2)");

    // Unset properties stayed unset in the saved file.
    const savedHeading = document.children?.[0]?.children?.[0];
    expect(savedHeading?.typography?.fontSize).toEqual({
      value: 44,
      unit: "px",
    });
    expect(savedHeading?.spacing).toBeUndefined();
    const savedParagraph = document.children?.[0]?.children?.[1];
    expect(savedParagraph?.typography).toBeUndefined();

    // Reload the app and reopen the project: the same Preview styling.
    await exportPage.close();
    await page.goto("/");
    await gotoApp(page);
    await page.keyboard.press("Control+o");
    await page
      .getByRole("dialog", { name: "Open Project" })
      .getByRole("button", { name: "Open BC-01.6 matrix" })
      .click();
    await expect(status(page)).toHaveAttribute("data-project-status", "saved");
    await enterPreviewAtExportWidth(page);
    const reopened = await measureCanvas(page);
    const reopenParity = compareMeasurements(preview, reopened);
    expect(reopenParity.differences).toEqual([]);
  });
});

test.describe("more live numeric controls", () => {
  test("Position offsets and a flex container gap update before blur and undo in one step", async ({
    page,
  }) => {
    await gotoApp(page);
    await selectOnCanvas(page, "button-1");
    const position = await section(page, "Position");
    await position
      .getByRole("button", { name: "Relative", exact: true })
      .click();
    await liveEdit(page, byLabel(position, "All sides"), "7", {
      id: "button-1",
      property: "top",
      expected: "7px",
    });
    await undo(page);
    await expect.poll(() => computed(page, "button-1", "top")).not.toBe("7px");

    // The fixture's sections are not flex containers; a Navbar is.
    await page.getByRole("button", { name: "Components" }).click();
    await page.getByRole("menuitem", { name: /^Basic Navbar/ }).click();
    const navId = await page
      .locator('[data-document-surface] [data-node-type="nav"]')
      .first()
      .getAttribute("data-node-id");
    if (!navId) throw new Error("navbar not inserted");
    await selectOnCanvas(page, navId);
    const gap = byLabel(page, "Gap (all) (exact value)");
    await expect(gap).toBeVisible();
    await liveEdit(page, gap, "40", {
      id: navId,
      property: "row-gap",
      expected: "40px",
    });
    await undo(page);
    await expect.poll(() => computed(page, navId, "row-gap")).not.toBe("40px");
  });
});

test.describe("history and lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await saveNewProject(page, "BC-01.6 history");
    await selectOnCanvas(page, "heading-1");
  });

  test("collapsing the section mid-edit commits and leaves no open transaction", async ({
    page,
  }) => {
    await replaceText(page, "Font size", "40");
    await page.getByRole("button", { name: "Typography", exact: true }).click();
    expect(await computed(page, "heading-1", "font-size")).toBe("40px");
    await saveAndExpectNoOpenTransaction(page);
    await undo(page);
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("30px");
  });

  test("deleting the element from the Edit menu mid-edit: the edit and the delete are separate steps, nothing orphaned", async ({
    page,
  }) => {
    await replaceText(page, "Font size", "40");
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    await expect(page.locator('[data-node-id="heading-1"]')).toHaveCount(0);
    await saveAndExpectNoOpenTransaction(page);

    await undo(page);
    await expect(page.locator('[data-node-id="heading-1"]')).toHaveCount(1);
    expect(await computed(page, "heading-1", "font-size")).toBe("40px");
    await undo(page);
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("30px");
  });

  test("consecutive edits to different properties are separate undo steps; Tab commits and moves focus", async ({
    page,
  }) => {
    const fontSize = await replaceText(page, "Font size", "40");
    await fontSize.press("Tab");
    await expect(fontSize).not.toBeFocused();
    await replaceText(page, "Line height", "2");
    await clickInspectorChrome(page);
    expect(await computed(page, "heading-1", "line-height")).toBe("80px");

    await undo(page);
    await expect
      .poll(() => computed(page, "heading-1", "line-height"))
      .toBe("48px");
    expect(await computed(page, "heading-1", "font-size")).toBe("40px");
    await undo(page);
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("30px");
  });

  test("Ctrl+Z / Ctrl+Y inside a focused field are the browser's text undo, and the document never goes invalid", async ({
    page,
  }) => {
    const field = await replaceText(page, "Font size", "4");
    await page.keyboard.type("0");
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("40px");
    await field.press("Control+z");
    const afterUndo = await field.inputValue();
    // Whatever text the browser restores, the Canvas shows a valid size and
    // Escape still restores the pre-edit state.
    expect(await computed(page, "heading-1", "font-size")).toMatch(
      /^\d+(\.\d+)?px$/,
    );
    await field.press("Control+y");
    await field.press("Escape");
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("30px");
    await testInfo_note(page, `text after Ctrl+Z: "${afterUndo}"`);
    await saveAndExpectNoOpenTransaction(page);
  });

  test("a Canvas resize drag and a slider drag are each one undo step after live editing", async ({
    page,
  }) => {
    await selectOnCanvas(page, "button-1");
    // 20, not 6: the button's own default radius (control-radius) is 6px.
    await replaceText(page, "Border radius", "20");
    const handle = page.locator('[data-resize-handle="e"]').first();
    const box = await handle.boundingBox();
    if (!box) throw new Error("no resize handle");
    const widthBefore = await computed(page, "button-1", "width");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 60, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    const widthAfter = await computed(page, "button-1", "width");
    expect(widthAfter).not.toBe(widthBefore);

    const slider = page.getByRole("slider", { name: "Opacity" });
    await slider.scrollIntoViewIfNeeded();
    const sliderBox = await slider.boundingBox();
    if (!sliderBox) throw new Error("no slider");
    await page.mouse.move(
      sliderBox.x + sliderBox.width - 2,
      sliderBox.y + sliderBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      sliderBox.x + sliderBox.width / 2,
      sliderBox.y + sliderBox.height / 2,
      { steps: 5 },
    );
    await page.mouse.up();
    await expect
      .poll(() => computed(page, "button-1", "opacity"))
      .not.toBe("1");

    await undo(page);
    await expect.poll(() => computed(page, "button-1", "opacity")).toBe("1");
    expect(await computed(page, "button-1", "width")).toBe(widthAfter);
    await undo(page);
    await expect
      .poll(() => computed(page, "button-1", "width"))
      .toBe(widthBefore);
    expect(await computed(page, "button-1", "border-top-left-radius")).toBe(
      "20px",
    );
    await undo(page);
    await expect
      .poll(() => computed(page, "button-1", "border-top-left-radius"))
      .toBe("6px");
    await saveAndExpectNoOpenTransaction(page);
  });

  test("saving after Enter, after blur and after Escape stores exactly the committed state", async ({
    page,
  }) => {
    const field = await replaceText(page, "Font size", "41");
    await field.press("Enter");
    await saveAndExpectNoOpenTransaction(page);
    expect(
      (await savedDocument(page)).children?.[0]?.children?.[0]?.typography
        ?.fontSize?.value,
    ).toBe(41);

    await replaceText(page, "Font size", "42");
    await clickInspectorChrome(page);
    await saveAndExpectNoOpenTransaction(page);
    expect(
      (await savedDocument(page)).children?.[0]?.children?.[0]?.typography
        ?.fontSize?.value,
    ).toBe(42);

    await replaceText(page, "Font size", "43");
    await byLabel(page, "Font size").press("Escape");
    await expect(status(page)).toHaveAttribute("data-project-status", "saved");
    expect(
      (await savedDocument(page)).children?.[0]?.children?.[0]?.typography
        ?.fontSize?.value,
    ).toBe(42);
  });
});

/** Attaches a free-text observation to the current test's report. */
async function testInfo_note(page: Page, note: string) {
  await test
    .info()
    .attach("observation", { body: note, contentType: "text/plain" });
  void page;
}

test.describe("keyboard and validation", () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await selectOnCanvas(page, "button-1");
  });

  test("Backspace/Delete edit the draft live; letters, an exponent and a bare minus never reach the document", async ({
    page,
  }) => {
    await selectOnCanvas(page, "heading-1");
    const field = await replaceText(page, "Font size", "123");
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("123px");
    await field.press("Backspace");
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("12px");
    await field.press("Home");
    await field.press("Delete");
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("2px");

    for (const junk of ["px", "e", "-"]) {
      await field.press("Control+a");
      await page.keyboard.type(junk);
      expect(await computed(page, "heading-1", "font-size")).toBe("2px");
    }
    await field.press("Escape");
    await expect
      .poll(() => computed(page, "heading-1", "font-size"))
      .toBe("30px");
    await expectUndoAvailable(page, false);
  });

  test("negative and out-of-range values follow the existing rules; an error clears on Escape", async ({
    page,
  }) => {
    const width = await replaceText(page, "Border width", "-1");
    await expect(
      page.getByText("Border width can't be negative."),
    ).toBeVisible();
    await width.press("Escape");
    await expect(page.getByText("Border width can't be negative.")).toHaveCount(
      0,
    );

    // "2" and "25" are valid live values on the way; "250" is out of range,
    // so it is never previewed: the Canvas keeps the last valid one (0.25).
    const opacity = await replaceText(page, "Opacity (exact value)", "250");
    await expect.poll(() => computed(page, "button-1", "opacity")).toBe("0.25");
    await opacity.press("Enter");
    await expect.poll(() => computed(page, "button-1", "opacity")).toBe("1");
    await expect(opacity).toHaveValue("100");
  });
});

test.describe("accessibility and cleanup", () => {
  test("every Inspector form control has an accessible name", async ({
    page,
  }) => {
    await gotoApp(page);
    for (const id of ["heading-1", "button-1", "image-1", "section-1"]) {
      await selectOnCanvas(page, id);
      const unnamed = await page
        .locator(
          "[data-inspector-palette] input, [data-inspector-palette] select, [data-inspector-palette] textarea",
        )
        .evaluateAll((elements) =>
          elements
            .filter((element) => {
              const labelled =
                element.getAttribute("aria-label") ||
                element.getAttribute("aria-labelledby") ||
                (element.id &&
                  document.querySelector(
                    `label[for="${CSS.escape(element.id)}"]`,
                  )) ||
                element.closest("label");
              return (
                !labelled && (element as HTMLInputElement).type !== "hidden"
              );
            })
            .map((element) => element.outerHTML.slice(0, 120)),
        );
      expect(unnamed, id).toEqual([]);
    }
  });

  test("50 edit sessions leave no window listeners behind, and each keystroke re-measures typography at most a few times", async ({
    page,
  }) => {
    // 50 real click/type/commit cycles: slow in WebKit under parallel load.
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      const counts = { pointerdown: 0, keydown: 0, computed: 0 };
      Reflect.set(window, "__counts", counts);
      const add = window.addEventListener.bind(window);
      const remove = window.removeEventListener.bind(window);
      window.addEventListener = ((
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
      ) => {
        const capture =
          typeof options === "boolean" ? options : options?.capture;
        if (capture && (type === "pointerdown" || type === "keydown"))
          counts[type]++;
        add(type, listener, options);
      }) as typeof window.addEventListener;
      window.removeEventListener = ((
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | EventListenerOptions,
      ) => {
        const capture =
          typeof options === "boolean" ? options : options?.capture;
        if (capture && (type === "pointerdown" || type === "keydown"))
          counts[type]--;
        remove(type, listener, options);
      }) as typeof window.removeEventListener;
      const getComputed = window.getComputedStyle.bind(window);
      window.getComputedStyle = ((element: Element, pseudo?: string | null) => {
        counts.computed++;
        return getComputed(element, pseudo);
      }) as typeof window.getComputedStyle;
    });
    await gotoApp(page);
    await selectOnCanvas(page, "heading-1");
    const counts = () =>
      page.evaluate(() => ({
        ...(Reflect.get(window, "__counts") as Record<string, number>),
      }));
    const before = await counts();

    const field = byLabel(page, "Letter spacing");
    for (let i = 0; i < 50; i++) {
      await field.click();
      await field.press("Control+a");
      await page.keyboard.type(String(i % 5));
      await field.press(i % 2 === 0 ? "Enter" : "Escape");
    }
    const after = await counts();
    expect(after.pointerdown).toBe(before.pointerdown);
    expect(after.keydown).toBe(before.keydown);

    // getComputedStyle calls per keystroke while unset typography is being
    // measured (line height is unset on the heading).
    const fontSize = byLabel(page, "Font size");
    await fontSize.click();
    await fontSize.press("Control+a");
    const beforeTyping = (await counts()).computed;
    await page.keyboard.type("1234567890");
    const perKeystroke = ((await counts()).computed - beforeTyping) / 10;
    await fontSize.press("Escape");
    await test.info().attach("getComputedStyle-per-keystroke.json", {
      body: JSON.stringify({ perKeystroke }),
      contentType: "application/json",
    });
    expect(perKeystroke).toBeLessThanOrEqual(5);

    // Timing: one keystroke -> Canvas style, measured in the page.
    const latency = await page.evaluate(async () => {
      const input = document.querySelector<HTMLInputElement>(
        '[aria-label="Font size"]',
      );
      const target = document.querySelector(
        '[data-document-surface] [data-node-id="heading-1"]',
      );
      if (!input || !target) throw new Error("missing");
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      input.focus();
      const samples: number[] = [];
      for (let i = 0; i < 30; i++) {
        const value = String(20 + i);
        const start = performance.now();
        setter?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        while (getComputedStyle(target).fontSize !== `${value}px`)
          await new Promise((resolve) => setTimeout(resolve, 0));
        samples.push(performance.now() - start);
      }
      input.blur();
      samples.sort((a, b) => a - b);
      return { median: samples[15], p95: samples[28], max: samples[29] };
    });
    await test.info().attach("keystroke-latency-ms.json", {
      body: JSON.stringify(latency),
      contentType: "application/json",
    });
    expect(latency.median).toBeLessThan(50);
  });
});
