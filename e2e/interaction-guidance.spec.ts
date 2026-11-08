import { expect, test, type Locator, type Page } from "@playwright/test";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { INTERACTION_COPY } from "../src/features/inspector/utils/interactionGuidanceCopy";
import { gotoApp } from "./support/gotoApp";
import { importDocument } from "./support/parityFixtures";
import { canvasNode, selectOnCanvas } from "./support/inspector";

/*
 * BC-04.2 — Interaction controls guidance and explicit target selection,
 * in the real editor: the section's description, help icons (mouse,
 * keyboard, Escape), the conditional notes, a new interaction that does
 * nothing until its target is chosen (Design, Preview and the exported
 * page), a finished one that runs the same in Preview and Export,
 * independent interactions, Undo/Redo, and the section's width.
 */

const TRIGGER = "trigger";
const HEADING = "heading";
const PANEL = "panel";
const OTHER = "other";

function guidanceDocument(): EditorElementNode {
  return {
    id: "page-root",
    tag: "page",
    children: [
      {
        id: "main",
        tag: "section",
        children: [
          { id: HEADING, tag: "h1", text: "Welcome", htmlId: "heading" },
          {
            id: TRIGGER,
            tag: "button",
            text: "Show details",
            htmlId: "trigger",
          },
          {
            id: PANEL,
            tag: "p",
            text: "Details",
            htmlId: "panel",
            initialPreviewVisibility: "hidden",
          },
          { id: OTHER, tag: "p", text: "Unrelated", htmlId: "other" },
        ],
      },
    ],
  };
}

const inspector = (page: Page) =>
  page.getByRole("complementary", { name: "Inspector panel" });
/** The Interactions section: the innermost element containing its heading. */
const section = (page: Page) =>
  inspector(page)
    .locator("div")
    .filter({
      has: page.getByRole("heading", { name: "Interactions", exact: true }),
    })
    .last();
const undo = (page: Page) =>
  page.getByRole("button", { name: "Undo", exact: true }).click();
const redo = (page: Page) =>
  page.getByRole("button", { name: "Redo", exact: true }).click();
const enterPreview = (page: Page) =>
  page.getByRole("button", { name: "Enter Preview" }).click();
const exitPreview = (page: Page) =>
  page.getByRole("button", { name: "Exit Preview" }).click();

async function openSection(page: Page) {
  const header = inspector(page).getByRole("button", {
    name: "Interactions",
    exact: true,
  });
  if ((await header.getAttribute("aria-expanded")) !== "true")
    await header.click();
  await expect(header).toHaveAttribute("aria-expanded", "true");
}

async function start(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await gotoApp(page);
  await importDocument(page, guidanceDocument(), PANEL);
}

/** The tooltip that belongs to a help button: the last child of their shared wrapper. */
function tooltipOf(help: Locator): Locator {
  return help.locator("xpath=..").locator("xpath=./*[last()]");
}

async function opacity(locator: Locator): Promise<number> {
  return Number(
    await locator.evaluate((element) => getComputedStyle(element).opacity),
  );
}

/** Waits for the 150 ms opacity transition (WebKit under load can leave it a hair short of its end value). */
async function expectOpacity(locator: Locator, value: 0 | 1, label: string) {
  if (value === 1)
    await expect
      .poll(() => opacity(locator), { message: label })
      .toBeGreaterThan(0.9);
  else
    await expect
      .poll(() => opacity(locator), { message: label })
      .toBeLessThan(0.1);
}

/** Visibility of the authored targets in Preview (Canvas) or on the exported page. */
function visibility(page: Page, selector: (htmlId: string) => string) {
  return Promise.all(
    [HEADING, TRIGGER, PANEL, OTHER].map((id) =>
      page
        .locator(selector(id))
        .first()
        .evaluate((element) => {
          const style = getComputedStyle(element);
          return (
            !(element as HTMLElement).hidden &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            element.getBoundingClientRect().height > 0
          );
        }),
    ),
  );
}
const previewVisibility = (page: Page) =>
  visibility(page, (id) => `[data-document-surface] [data-node-id="${id}"]`);
const exportVisibility = (page: Page) => visibility(page, (id) => `#${id}`);

async function exportedHtml(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Export Code" }).click();
  const code = page
    .getByRole("dialog", { name: "Export Code" })
    .getByTestId("export-code");
  await expect(code).toBeVisible();
  const text = (await code.textContent()) ?? "";
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Export Code" })).toHaveCount(
    0,
  );
  return text;
}

async function openExported(page: Page, html: string): Promise<Page> {
  const exported = await page.context().newPage();
  await exported.setViewportSize({ width: 1200, height: 900 });
  await exported.setContent(html);
  return exported;
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await section(page).evaluate((element) => {
    const box = element.getBoundingClientRect();
    const escaping = Array.from(element.querySelectorAll<HTMLElement>("*"))
      .filter(
        (child) =>
          child.getClientRects().length > 0 &&
          getComputedStyle(child).opacity !== "0",
      )
      .filter((child) => {
        const rect = child.getBoundingClientRect();
        return (
          rect.width > 0 &&
          (rect.left < box.left - 0.5 || rect.right > box.right + 0.5)
        );
      })
      .map(
        (child) =>
          `${child.tagName.toLowerCase()} "${(child.textContent ?? "").slice(0, 30)}"`,
      );
    const scroller = element.closest<HTMLElement>(".overflow-y-auto");
    return {
      escaping,
      scrolls: scroller ? scroller.scrollWidth > scroller.clientWidth : false,
    };
  });
  expect(overflow.escaping, `${label}: nothing escapes the section`).toEqual(
    [],
  );
  expect(
    overflow.scrolls,
    `${label}: the Inspector doesn't scroll sideways`,
  ).toBe(false);
}

test.describe("BC-04.2 Interaction guidance", () => {
  test("description, help icons by mouse and keyboard, Escape, and the notes", async ({
    page,
  }) => {
    await start(page);
    await selectOnCanvas(page, PANEL);
    await openSection(page);

    await expect(
      section(page).getByText(INTERACTION_COPY.description),
    ).toBeVisible();

    // Help: hover shows the tooltip.
    const initialHelp = section(page).getByRole("button", {
      name: INTERACTION_COPY.initialStateHelp,
    });
    await expect(initialHelp).toBeVisible();
    await expectOpacity(tooltipOf(initialHelp), 0, "tooltip hidden at rest");
    await initialHelp.hover();
    await expectOpacity(tooltipOf(initialHelp), 1, "tooltip shown on hover");
    await page.mouse.move(0, 0);
    await expectOpacity(
      tooltipOf(initialHelp),
      0,
      "tooltip hidden after hover",
    );

    // Keyboard: Tab from the section header reaches the help icon; focus shows it.
    await inspector(page)
      .getByRole("button", { name: "Interactions", exact: true })
      .focus();
    await page.keyboard.press("Tab");
    await expect(initialHelp).toBeFocused();
    await expectOpacity(tooltipOf(initialHelp), 1, "tooltip shown on focus");

    // Escape hides it, keeps focus and keeps the selection (the Inspector stays).
    await page.keyboard.press("Escape");
    await expectOpacity(tooltipOf(initialHelp), 0, "tooltip hidden by Escape");
    await expect(initialHelp).toBeFocused();
    await expect(section(page)).toBeVisible();
    // A second Escape is the editor's own: it clears the selection.
    await page.keyboard.press("Escape");
    await expect(section(page)).toHaveCount(0);

    // Hidden note follows Initial state.
    await selectOnCanvas(page, PANEL);
    await openSection(page);
    await expect(
      section(page).getByText(INTERACTION_COPY.initialHiddenNote),
    ).toBeVisible();
    await section(page)
      .getByLabel("Initial state", { exact: true })
      .selectOption("visible");
    await expect(
      section(page).getByText(INTERACTION_COPY.initialHiddenNote),
    ).toHaveCount(0);
    await undo(page);
    await expect(
      section(page).getByText(INTERACTION_COPY.initialHiddenNote),
    ).toBeVisible();

    // Keyboard note: a heading with an interaction, never a button.
    await selectOnCanvas(page, HEADING);
    await openSection(page);
    await section(page)
      .getByRole("button", { name: "Add Interaction" })
      .click();
    await expect(
      section(page).getByText(INTERACTION_COPY.keyboardNote),
    ).toBeVisible();
    await selectOnCanvas(page, TRIGGER);
    await openSection(page);
    await section(page)
      .getByRole("button", { name: "Add Interaction" })
      .click();
    await expect(
      section(page).getByText(INTERACTION_COPY.keyboardNote),
    ).toHaveCount(0);

    // Each interaction row has Action and Target help.
    await expect(
      section(page).getByRole("button", { name: INTERACTION_COPY.actionHelp }),
    ).toBeVisible();
    await expect(
      section(page).getByRole("button", { name: INTERACTION_COPY.targetHelp }),
    ).toBeVisible();
  });

  test("a new interaction needs its target: nothing runs until one is chosen, then Preview and Export agree", async ({
    page,
  }) => {
    await start(page);
    const htmlBefore = await exportedHtml(page);
    await selectOnCanvas(page, TRIGGER);
    await openSection(page);

    await section(page)
      .getByRole("button", { name: "Add Interaction" })
      .click();
    const target = section(page).getByLabel("Target", { exact: true });
    await expect(target).toBeFocused();
    await expect(target).toHaveValue("");
    await expect(target.locator("option:checked")).toHaveText(
      INTERACTION_COPY.targetPlaceholder,
    );
    await expect(
      section(page).getByText(INTERACTION_COPY.targetRequired),
    ).toBeVisible();
    await expect(
      section(page).getByLabel("Action", { exact: true }),
    ).toHaveValue("toggle");
    await expectNoHorizontalOverflow(page, "unfinished interaction");

    // Unfinished: the exported page is unchanged.
    expect(
      await exportedHtml(page),
      "an unfinished interaction is not exported",
    ).toBe(htmlBefore);
    await expect(target).toHaveValue("");

    // Unfinished: Preview runs nothing (the draft is dropped when Preview replaces the Inspector).
    await enterPreview(page);
    await canvasNode(page, TRIGGER).click();
    expect(
      await previewVisibility(page),
      "Preview after clicking an unfinished trigger",
    ).toEqual([true, true, false, true]);
    await exitPreview(page);
    await selectOnCanvas(page, TRIGGER);
    await openSection(page);
    await expect(
      section(page).getByLabel("Target", { exact: true }),
    ).toHaveCount(0);

    // Finish it: the target list is readable and marks the trigger itself.
    await section(page)
      .getByRole("button", { name: "Add Interaction" })
      .click();
    const options = await section(page)
      .getByLabel("Target", { exact: true })
      .locator("option")
      .allTextContents();
    expect(options).toEqual([
      INTERACTION_COPY.targetPlaceholder,
      "Section",
      "Heading",
      "Button (this element)",
      "Paragraph — Details",
      "Paragraph — Unrelated",
    ]);
    await section(page)
      .getByLabel("Target", { exact: true })
      .selectOption({ label: "Paragraph — Details" });
    await expect(
      section(page).getByLabel("Target", { exact: true }),
    ).toBeFocused();
    await expect(
      section(page).getByText(INTERACTION_COPY.targetRequired),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page, "finished interaction");

    // A second, independent interaction: hide the unrelated paragraph.
    await section(page)
      .getByRole("button", { name: "Add Interaction" })
      .click();
    await section(page)
      .getByLabel("Action", { exact: true })
      .last()
      .selectOption("hide");
    await section(page)
      .getByLabel("Target", { exact: true })
      .last()
      .selectOption({ label: "Paragraph — Unrelated" });
    await expect(
      section(page).getByLabel("Target", { exact: true }).first(),
    ).toHaveValue(PANEL);
    await expect(
      section(page).getByLabel("Action", { exact: true }).first(),
    ).toHaveValue("toggle");

    // Preview: toggle the panel, hide the paragraph; the heading is never affected.
    await enterPreview(page);
    await canvasNode(page, TRIGGER).click();
    expect(await previewVisibility(page), "Preview after one click").toEqual([
      true,
      true,
      true,
      false,
    ]);
    await canvasNode(page, TRIGGER).click();
    expect(await previewVisibility(page), "Preview after two clicks").toEqual([
      true,
      true,
      false,
      false,
    ]);
    await exitPreview(page);

    // Undo removes the second interaction, then the first; Redo brings them back.
    await selectOnCanvas(page, TRIGGER);
    await openSection(page);
    await undo(page);
    await expect(
      section(page).getByLabel("Target", { exact: true }),
    ).toHaveCount(1);
    await undo(page);
    await expect(
      section(page).getByLabel("Target", { exact: true }),
    ).toHaveCount(0);
    expect(
      await exportedHtml(page),
      "undoing both interactions restores the original export",
    ).toBe(htmlBefore);
    await redo(page);
    await expect(
      section(page).getByLabel("Target", { exact: true }),
    ).toHaveCount(1);
    await redo(page);
    await expect(
      section(page).getByLabel("Target", { exact: true }),
    ).toHaveCount(2);
    await expect(
      section(page).getByLabel("Target", { exact: true }).last(),
    ).toHaveValue(OTHER);

    // Removing keeps focus in the section.
    await section(page)
      .getByRole("button", { name: "Remove interaction" })
      .last()
      .click();
    await expect(
      section(page).getByRole("button", { name: "Add Interaction" }),
    ).toBeFocused();
    await undo(page);
    await expect(
      section(page).getByLabel("Target", { exact: true }),
    ).toHaveCount(2);

    // Export: the same. Last, because WebKit stops animation frames in the
    // editor tab once a second tab has opened, and Playwright's clicks wait
    // for frames (stability), so later editor clicks would time out.
    const html = await exportedHtml(page);
    const exported = await openExported(page, html);
    expect(await exportVisibility(exported), "Export at load").toEqual([
      true,
      true,
      false,
      true,
    ]);
    await exported.locator("#trigger").click();
    expect(await exportVisibility(exported), "Export after one click").toEqual([
      true,
      true,
      true,
      false,
    ]);
    await exported.locator("#trigger").click();
    expect(await exportVisibility(exported), "Export after two clicks").toEqual(
      [true, true, false, false],
    );
    await exported.close();
  });

  test("at the narrowest Inspector width every note, help icon and select stays inside the section", async ({
    page,
  }) => {
    await start(page);
    const handle = page.getByRole("separator", {
      name: "Resize Inspector Panel",
    });
    const box = await handle.boundingBox();
    if (!box) throw new Error("resize handle not visible");
    await page.mouse.move(box.x + box.width / 2, box.y + 300);
    await page.mouse.down();
    // Rightward shrinks the Inspector; stay inside the window (Firefox mishandles a move past its edge).
    await page.mouse.move(1599, box.y + 300, { steps: 10 });
    await page.mouse.up();
    const minimum = await handle.getAttribute("aria-valuemin");
    await expect(handle).toHaveAttribute("aria-valuenow", minimum ?? "");

    // The heading: keyboard note, a finished interaction to the longest label, an unfinished one.
    await selectOnCanvas(page, HEADING);
    await openSection(page);
    await section(page)
      .getByLabel("Initial state", { exact: true })
      .selectOption("hidden");
    await section(page)
      .getByRole("button", { name: "Add Interaction" })
      .click();
    await section(page)
      .getByLabel("Target", { exact: true })
      .selectOption({ label: "Heading (this element)" });
    await section(page)
      .getByRole("button", { name: "Add Interaction" })
      .click();
    for (const text of [
      INTERACTION_COPY.description,
      INTERACTION_COPY.initialHiddenNote,
      INTERACTION_COPY.keyboardNote,
      INTERACTION_COPY.targetRequired,
    ]) {
      await expect(section(page).getByText(text)).toBeVisible();
    }
    await expectNoHorizontalOverflow(page, `Inspector at ${minimum}px`);

    // Every help tooltip, shown, stays inside the Inspector panel.
    const panel = await inspector(page).boundingBox();
    if (!panel) throw new Error("no Inspector");
    let checked = 0;
    for (const help of await section(page)
      .getByRole("button", { name: /./ })
      .filter({ hasNot: page.locator("text=Add Interaction") })
      .all()) {
      const name = (await help.getAttribute("aria-label")) ?? "";
      if (!Object.values(INTERACTION_COPY).includes(name as never)) continue;
      await help.focus();
      const tooltip = tooltipOf(help);
      await expectOpacity(tooltip, 1, `${name.slice(0, 20)} shown`);
      const rect = await tooltip.boundingBox();
      expect(
        rect &&
          rect.x >= panel.x - 0.5 &&
          rect.x + rect.width <= panel.x + panel.width + 0.5,
        `"${name.slice(0, 30)}…" tooltip inside the Inspector`,
      ).toBe(true);
      checked++;
    }
    expect(checked, "Initial state, and Action and Target on both rows").toBe(
      5,
    );
  });

  test("an existing project's interactions open unchanged", async ({
    page,
  }) => {
    const document = guidanceDocument();
    const trigger = document.children![0].children!.find(
      (node) => node.id === TRIGGER,
    )!;
    trigger.interactions = [
      { id: "int-saved", trigger: "click", action: "show", targetId: PANEL },
    ];
    await page.setViewportSize({ width: 1600, height: 1000 });
    await gotoApp(page);
    await importDocument(page, document, PANEL);
    await selectOnCanvas(page, TRIGGER);
    await openSection(page);
    await expect(
      section(page).getByLabel("Action", { exact: true }),
    ).toHaveValue("show");
    await expect(
      section(page).getByLabel("Target", { exact: true }),
    ).toHaveValue(PANEL);
    await expect(section(page).getByRole("alert")).toHaveCount(0);

    await enterPreview(page);
    await canvasNode(page, TRIGGER).click();
    expect(await previewVisibility(page)).toEqual([true, true, true, true]);
  });
});
