import { expect, test } from "@playwright/test";

/**
 * Permanent regression coverage for Checkpoint 1.15.6.2.1 — a real bug
 * that can only be reproduced in a genuine browser (jsdom's simplified
 * Selection/Range implementation does not reproduce it; see
 * useEditableText.test.tsx's own "Sequential Canvas Text Editing" suite
 * for the unit-level coverage this complements, and this checkpoint's
 * own report for the full `document.getSelection()` diagnosis): editing
 * and committing one text-bearing Canvas element via Enter, then
 * immediately double-clicking a DIFFERENT text-bearing element, used to
 * correctly focus and flip the second element to contentEditable while
 * leaving the browser's native Selection stale — still anchored inside
 * the first (no-longer-editable) element — so native Ctrl+A/typing
 * silently failed on the second element. Fixed generically in
 * useEditableText's own shared edit-start effect (re-anchors the
 * Selection inside whichever element is entering edit mode, every time),
 * so this is not Button/Link-specific — any two text-bearing tags in
 * sequence exercise the same fix.
 */
test("editing one Canvas text element and then another immediately afterward both commit correctly", async ({ page }) => {
  await page.goto("/");
  // Canvas queries are scoped to the Workspace: since UI-1.3 the Resource
  // panel library also shows tiles named like canvas content (e.g. "Menu").
  const canvas = page.getByRole("main", { name: "Workspace" });
  await page.getByRole("button", { name: "Components" }).click();
  await page.getByRole("menuitem", { name: /^Dropdown Button/ }).click();

  // First edit: the trigger Button.
  await canvas.getByRole("button", { name: "Menu" }).dblclick();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Options");
  await page.keyboard.press("Enter");
  await expect(canvas.getByRole("button", { name: "Options" })).toBeVisible();

  // Second edit, immediately after: a sibling Link. Before the fix, focus
  // and contenteditable="true" were both correct here, but native Ctrl+A
  // selected the whole page instead of just this Link, and typing did
  // nothing to it.
  const link1 = canvas.locator('[data-node-type="a"]').first();
  await link1.dblclick();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Home");
  await page.keyboard.press("Enter");
  await expect(canvas.getByRole("link", { name: "Home" })).toBeVisible();

  // Third edit, chained again, to guard against any two-in-a-row-only fix.
  const link2 = canvas.getByRole("link", { name: "Item 2" });
  await link2.dblclick();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("About");
  await page.keyboard.press("Enter");
  await expect(canvas.getByRole("link", { name: "About" })).toBeVisible();
});
