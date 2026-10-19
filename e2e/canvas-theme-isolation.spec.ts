import { expect, test, type Page } from "@playwright/test";
import { gotoApp } from "./support/gotoApp";

/**
 * Regression coverage for UI-1.4.1 — the editor's light/dark theme must
 * never change the user's page. Needs a real browser: jsdom can't
 * evaluate `prefers-color-scheme`, which is what Tailwind's `dark:`
 * variant (scoped away from [data-document-surface] in globals.css)
 * depends on.
 */
const PROPS = [
  "color",
  "backgroundColor",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "borderTopColor",
  "borderTopWidth",
  "colorScheme",
  "width",
  "height",
] as const;

function documentStyles(page: Page) {
  return page.evaluate((props) => {
    const surface = document.querySelector("[data-document-surface]");
    if (!surface) throw new Error("document surface not found");
    // The surface's own border and shadow are the editor's frame around
    // the page (themed by design), so only its descendants are compared.
    return [...surface.querySelectorAll("*")]
      .filter((el) => !el.closest("[data-canvas-overlay]"))
      .map((el) => {
        const style = getComputedStyle(el);
        return [el.tagName, ...props.map((prop) => style[prop])].join("|");
      });
  }, PROPS);
}

test("switching the editor between light and dark never restyles the user's page", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await gotoApp(page);

  // A representative mix: text, a button, and native form controls.
  const library = page.getByRole("complementary", { name: "Resource panel" });
  for (const name of [
    "Button",
    "Text Input",
    "Checkbox",
    "Select",
    "Textarea",
  ]) {
    await library.getByRole("button", { name, exact: true }).click();
  }
  await page.keyboard.press("Escape");

  const light = await documentStyles(page);
  await page.emulateMedia({ colorScheme: "dark" });
  const dark = await documentStyles(page);

  expect(dark).toEqual(light);
  await expect(page.locator("[data-document-surface]")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  // Editor chrome, by contrast, still follows the OS theme.
  await expect(
    page.getByRole("banner", { name: "Application menu bar" }),
  ).toHaveCSS("background-color", "rgb(15, 17, 23)");
});
