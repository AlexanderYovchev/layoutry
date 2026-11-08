import { expect, test, type Locator, type Page } from "@playwright/test";
import { INTERACTION_COPY } from "../../src/features/inspector/utils/interactionGuidanceCopy";
import { launchLayoutry, type LaunchedLayoutry } from "./support/layoutryApp";

/**
 * BC-04.2 in the real Electron window, on the starter page: the
 * Interactions section's guidance, help by keyboard (with the real 15 px
 * scrollbar beside it) and Escape, the keyboard note, and a new
 * interaction on the hero heading that no longer targets anything until a
 * target is chosen. In BC-04.1 the same steps defaulted to the heading's
 * own section, so one Preview click hid the heading.
 */

let layoutry: LaunchedLayoutry | undefined;

test.afterEach(async () => {
  await layoutry?.dispose();
  layoutry = undefined;
});

const node = (page: Page, id: string) =>
  page.locator(`[data-document-surface] [data-node-id="${id}"]`).first();
const inspector = (page: Page) =>
  page.getByRole("complementary", { name: "Inspector panel" });
const section = (page: Page) =>
  inspector(page)
    .locator("div")
    .filter({
      has: page.getByRole("heading", { name: "Interactions", exact: true }),
    })
    .last();
const shown = (locator: Locator) =>
  locator.evaluate(
    (element) =>
      element.getBoundingClientRect().height > 0 &&
      getComputedStyle(element).display !== "none",
  );

async function openSection(page: Page) {
  const header = inspector(page).getByRole("button", {
    name: "Interactions",
    exact: true,
  });
  if ((await header.getAttribute("aria-expanded")) !== "true")
    await header.click();
  await expect(header).toHaveAttribute("aria-expanded", "true");
}

test("Interaction guidance and explicit target selection in the desktop window", async () => {
  layoutry = await launchLayoutry();
  const { page } = layoutry;

  await node(page, "heading-1").click({ position: { x: 5, y: 5 } });
  await openSection(page);
  await expect(
    section(page).getByText(INTERACTION_COPY.description),
  ).toBeVisible();

  // Help by keyboard: shown on focus, inside the Inspector's scrolling area (not under its scrollbar), Escape hides it and keeps the selection.
  await inspector(page)
    .getByRole("button", { name: "Interactions", exact: true })
    .focus();
  await page.keyboard.press("Tab");
  const help = section(page).getByRole("button", {
    name: INTERACTION_COPY.initialStateHelp,
  });
  await expect(help).toBeFocused();
  const tooltip = help.locator("xpath=..").locator("xpath=./*[last()]");
  await expect
    .poll(() =>
      tooltip.evaluate((element) => Number(getComputedStyle(element).opacity)),
    )
    .toBeGreaterThan(0.9);
  const placement = await tooltip.evaluate((element) => {
    let scroller = element.parentElement;
    while (scroller && getComputedStyle(scroller).overflowY !== "auto")
      scroller = scroller.parentElement;
    if (!scroller) throw new Error("no scrolling ancestor");
    const area = scroller.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return {
      inside:
        rect.left >= area.left + scroller.clientLeft - 0.5 &&
        rect.right <=
          area.left + scroller.clientLeft + scroller.clientWidth + 0.5,
      scrollbar: scroller.offsetWidth - scroller.clientWidth,
    };
  });
  expect(
    placement.inside,
    `tooltip inside the Inspector's content area (scrollbar ${placement.scrollbar}px)`,
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect
    .poll(() =>
      tooltip.evaluate((element) => Number(getComputedStyle(element).opacity)),
    )
    .toBeLessThan(0.1);
  await expect(help).toBeFocused();
  await expect(section(page)).toBeVisible();

  // A new interaction on the heading asks for its target; the keyboard note explains the heading.
  await section(page).getByRole("button", { name: "Add Interaction" }).click();
  const target = section(page).getByLabel("Target", { exact: true });
  await expect(target).toBeFocused();
  await expect(target).toHaveValue("");
  expect(await target.locator("option").allTextContents()).toEqual([
    INTERACTION_COPY.targetPlaceholder,
    "Section (1 of 2)",
    "Heading (this element)",
    "Paragraph",
    "Primary Button",
    "Section (2 of 2)",
    "Image",
  ]);
  await expect(
    section(page).getByText(INTERACTION_COPY.keyboardNote),
  ).toBeVisible();
  await expect(
    section(page).getByText(INTERACTION_COPY.targetRequired),
  ).toBeVisible();

  // Unfinished: Preview leaves the page alone (BC-04.1: this click hid the heading's section).
  await page.getByRole("button", { name: "Enter Preview" }).click();
  await node(page, "heading-1").click();
  expect(await shown(node(page, "section-1")), "section still shown").toBe(
    true,
  );
  expect(await shown(node(page, "heading-1")), "heading still shown").toBe(
    true,
  );
  await page.getByRole("button", { name: "Exit Preview" }).click();

  // Finished: toggle the paragraph.
  await node(page, "heading-1").click({ position: { x: 5, y: 5 } });
  await openSection(page);
  await section(page).getByRole("button", { name: "Add Interaction" }).click();
  await section(page)
    .getByLabel("Target", { exact: true })
    .selectOption({ label: "Paragraph" });
  await expect(section(page).getByLabel("Target", { exact: true })).toHaveValue(
    "paragraph-1",
  );
  await page.getByRole("button", { name: "Enter Preview" }).click();
  await node(page, "heading-1").click();
  await expect
    .poll(() => shown(node(page, "paragraph-1")), {
      message: "paragraph hidden",
    })
    .toBe(false);
  expect(await shown(node(page, "heading-1")), "heading still shown").toBe(
    true,
  );
  await node(page, "heading-1").click();
  await expect
    .poll(() => shown(node(page, "paragraph-1")), {
      message: "paragraph shown again",
    })
    .toBe(true);
  await page.getByRole("button", { name: "Exit Preview" }).click();
});
