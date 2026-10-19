import { expect, test, type Page } from "@playwright/test";
import { gotoApp, waitForHydration } from "./support/gotoApp";

/**
 * UI-1.6 — collapsing the side panels in a real browser: the workspace
 * reclaims the width, nothing overflows, and the expanded width
 * preferences survive both a collapse and a reload.
 */
const width = (page: Page, name: string) =>
  page
    .getByRole("complementary", { name })
    .evaluate((el) => Math.round(el.getBoundingClientRect().width));

const workspaceWidth = (page: Page) =>
  page
    .getByRole("main", { name: "Workspace" })
    .evaluate((el) => Math.round(el.getBoundingClientRect().width));

const horizontalOverflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

test("collapsing both side panels gives the workspace their width and restores cleanly", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoApp(page);
  const workspaceBefore = await workspaceWidth(page);

  await page.getByRole("button", { name: "Collapse Resource panel" }).click();
  await page.getByRole("button", { name: "Collapse Inspector panel" }).click();

  await expect.poll(() => width(page, "Resource panel")).toBe(66);
  await expect.poll(() => width(page, "Inspector panel")).toBe(56);
  expect(await workspaceWidth(page)).toBe(
    workspaceBefore + (280 - 66) + (300 - 56),
  );
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "Expand Resource panel" }).click();
  await page.getByRole("button", { name: "Expand Inspector panel" }).click();
  await expect.poll(() => width(page, "Resource panel")).toBe(280);
  await expect.poll(() => width(page, "Inspector panel")).toBe(300);
  expect(await workspaceWidth(page)).toBe(workspaceBefore);
});

test("a resized panel width survives a collapse and a reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoApp(page);

  const handle = page.getByRole("separator", {
    name: "Resize Inspector Panel",
  });
  const box = await handle.boundingBox();
  if (!box) throw new Error("resize handle not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 60, box.y + 300, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => width(page, "Inspector panel")).toBe(360);

  await page.getByRole("button", { name: "Collapse Inspector panel" }).click();
  await expect.poll(() => width(page, "Inspector panel")).toBe(56);
  await page.getByRole("button", { name: "Expand Inspector panel" }).click();
  await expect.poll(() => width(page, "Inspector panel")).toBe(360);

  await page.reload();
  await waitForHydration(page);
  await expect.poll(() => width(page, "Inspector panel")).toBe(360);
});
