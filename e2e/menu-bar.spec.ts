import { expect, test } from "@playwright/test";

test.describe("application menu bar", () => {
  test("opens a top-level menu, navigates it with the keyboard, and closes with Escape", async ({
    page,
  }) => {
    await page.goto("/");

    const fileTrigger = page.getByRole("menuitem", { name: "File" });
    await fileTrigger.click();

    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(fileTrigger).toHaveAttribute("aria-expanded", "true");

    // "New Project" and "Open Project" are disabled; the first enabled item
    // ("Open Recent") should receive focus.
    await page.keyboard.press("ArrowDown");
    await expect(
      page.getByRole("menuitem", { name: "Open Recent" }),
    ).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(fileTrigger).toBeFocused();
  });

  test("switches menus on hover once one is open, and closes on outside click", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("menuitem", { name: "File" }).click();
    await expect(
      page.getByRole("menuitem", { name: "New Project" }),
    ).toBeVisible();

    await page.getByRole("menuitem", { name: "Edit" }).hover();
    await expect(
      page.getByRole("menuitem", { name: "New Project" }),
    ).toBeHidden();
    await expect(page.getByRole("menuitem", { name: "Undo" })).toBeVisible();

    await page.mouse.click(700, 500);
    await expect(page.getByRole("menu")).toBeHidden();
  });

  test("does not activate disabled commands", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("menuitem", { name: "File" }).click();
    const saveItem = page.getByRole("menuitem", { name: "Save", exact: true });
    await expect(saveItem).toBeDisabled();

    await saveItem.click({ force: true });
    await expect(page.getByRole("menu")).toBeVisible();
  });

  test("toggles the Resource Panel from the View menu and can restore it", async ({
    page,
  }) => {
    await page.goto("/");

    const resourcePanel = page.getByRole("complementary", {
      name: "Resource panel",
    });
    await expect(resourcePanel).toBeVisible();

    await page.getByRole("menuitem", { name: "View" }).click();
    const resourcePanelToggle = page.getByRole("menuitemcheckbox", {
      name: "Resource Panel",
    });
    await expect(resourcePanelToggle).toHaveAttribute("aria-checked", "true");
    await resourcePanelToggle.click();

    await expect(resourcePanel).toBeHidden();

    await page.getByRole("menuitem", { name: "View" }).click();
    await page
      .getByRole("menuitemcheckbox", { name: "Resource Panel" })
      .click();

    await expect(resourcePanel).toBeVisible();
  });

  test("opens the About dialog from the Help menu and closes it with Escape", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByRole("menuitem", { name: "Help" }).click();
    await page.getByRole("menuitem", { name: "About Layoutry" }).click();

    const dialog = page.getByRole("dialog", { name: "About Layoutry" });
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("does not create document-level horizontal overflow with a menu open", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 720 });
    await page.goto("/");

    await page.getByRole("menuitem", { name: "Project" }).click();
    await expect(page.getByRole("menu")).toBeVisible();

    const scrollInfo = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollInfo.scrollWidth).toBeLessThanOrEqual(scrollInfo.clientWidth);
  });
});
