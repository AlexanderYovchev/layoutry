import { expect, test } from "@playwright/test";

test("home page identifies Layoutry and confirms the dev foundation is operational", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByText("Layoutry")).toBeVisible();
  await expect(
    page.getByText("Build layouts visually. Own the code."),
  ).toBeVisible();
  await expect(
    page.getByText("Development foundation operational."),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Editor canvas" }),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Style inspector" }),
  ).toBeVisible();
});
