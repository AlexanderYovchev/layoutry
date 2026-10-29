import { expect, type Page } from "@playwright/test";

/** Shared helpers for the Inspector editing specs (BC-01.2, BC-01.3). */

export const canvasNode = (page: Page, id: string) =>
  page.locator(`[data-node-id="${id}"]`).first();

export const computed = (page: Page, id: string, property: string) =>
  canvasNode(page, id).evaluate(
    (element, prop) => getComputedStyle(element).getPropertyValue(prop),
    property,
  );

export async function selectOnCanvas(page: Page, id: string) {
  await canvasNode(page, id).click({ position: { x: 5, y: 5 } });
}

/** Clicks blank Inspector chrome: moves focus off the field like a user clicking elsewhere, without changing the selection. */
export async function clickInspectorChrome(page: Page) {
  await page
    .locator("[data-inspector-palette]")
    .first()
    .click({ position: { x: 5, y: 5 } });
}

/** From a fresh page (empty history), "one Undo restores it AND Undo is then disabled" proves an edit made exactly one entry. */
export async function expectUndoAvailable(page: Page, available: boolean) {
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const undo = page.getByRole("menuitem", { name: "Undo" });
  if (available) await expect(undo).toBeEnabled();
  else await expect(undo).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
}

export async function replaceText(page: Page, label: string, text: string) {
  const field = page.getByLabel(label, { exact: true });
  await field.click();
  await field.press("Control+a");
  await page.keyboard.type(text);
  return field;
}
