import { expect, test } from "@playwright/test";
import { launchLayoutry, type LaunchedLayoutry } from "./support/layoutryApp";

/**
 * BC-01.6 — the live CSS Inspector inside the real Electron window: valid
 * values reach the Canvas before blur, unset typography shows the rendered
 * defaults, Escape restores, and one edit is one undo step.
 */

let layoutry: LaunchedLayoutry;

test.beforeEach(async () => {
  layoutry = await launchLayoutry();
});

test.afterEach(async () => {
  await layoutry?.dispose();
});

const heading = () =>
  layoutry.page.locator('[data-document-surface] [data-node-id="heading-1"]');
const headingStyle = (property: string) =>
  heading().evaluate(
    (element, name) => getComputedStyle(element).getPropertyValue(name),
    property,
  );

test("live numeric and color edits, rendered typography defaults, Escape and one-step Undo in the desktop app", async () => {
  const { page } = layoutry;
  await heading().click({ position: { x: 5, y: 5 } });
  const fontSize = page.getByLabel("Font size", { exact: true });
  await expect(fontSize).toHaveValue("30");
  await expect(page.getByLabel("Line height", { exact: true })).toHaveValue(
    "1.2",
  );
  await expect(page.getByLabel("Letter spacing", { exact: true })).toHaveValue(
    "-0.75",
  );

  await fontSize.click();
  await fontSize.press("Control+a");
  await page.keyboard.type("44");
  await expect.poll(() => headingStyle("font-size")).toBe("44px");
  await expect(fontSize).toBeFocused();
  await fontSize.press("Escape");
  await expect.poll(() => headingStyle("font-size")).toBe("30px");

  const color = page.getByLabel("Text color", { exact: true });
  await color.click();
  await page.keyboard.type("#ff0000");
  await expect.poll(() => headingStyle("color")).toBe("rgb(255, 0, 0)");
  await color.press("Enter");

  await page.keyboard.press("Control+z");
  await expect.poll(() => headingStyle("color")).not.toBe("rgb(255, 0, 0)");
  await expect(color).toHaveValue("");
});
