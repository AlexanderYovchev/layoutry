import { expect, test } from "@playwright/test";

test("home page renders the application shell regions", async ({ page }) => {
  await page.goto("/");

  const banner = page.getByRole("banner", { name: "Application menu bar" });
  await expect(banner).toBeVisible();
  await expect(banner.getByText("Layoutry")).toBeVisible();
  await expect(
    page.getByRole("toolbar", { name: "Creation toolbar" }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Resource panel" }),
  ).toBeVisible();
  await expect(page.getByRole("main", { name: "Workspace" })).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Inspector panel" }),
  ).toBeVisible();
  await expect(page.getByText("No element selected")).toBeVisible();
  await expect(
    page.getByRole("contentinfo", { name: "Status bar" }),
  ).toBeVisible();
});
