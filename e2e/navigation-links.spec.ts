import { expect, test, type Locator, type Page } from "@playwright/test";
import { NAVIGATION_LINKS_COPY } from "../src/features/inspector/utils/navigationLinksCopy";
import { gotoApp } from "./support/gotoApp";
import { canvasNode, computed, selectOnCanvas } from "./support/inspector";

/*
 * BC-06.2 — the Inspector's Navigation links section in the real editor:
 * Add / Remove / Move (pointer and keyboard), the count, inherited styling,
 * the 12-link cap, the Wrap hint, Undo/Redo, Navbar with CTA, Preview,
 * Export, Save + reopen, the BC06-D1 save fix through the real UI, and the
 * narrowest Inspector width.
 */

const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector panel" });
/** The Navigation links section: the innermost element containing its heading. */
const section = (page: Page) =>
  inspector(page)
    .locator("div")
    .filter({ has: page.getByRole("heading", { name: NAVIGATION_LINKS_COPY.title, exact: true }) })
    .last();
const linkList = (page: Page) => section(page).getByRole("list", { name: NAVIGATION_LINKS_COPY.title });
const button = (page: Page, name: string) => section(page).getByRole("button", { name, exact: true });
const undo = (page: Page) => page.getByRole("button", { name: "Undo", exact: true }).click();
const redo = (page: Page) => page.getByRole("button", { name: "Redo", exact: true }).click();

async function insertNavbar(page: Page, name: "Basic Navbar" | "Navbar with CTA"): Promise<string> {
  await page.getByRole("button", { name: "Components" }).click();
  await page.getByRole("menuitem", { name: new RegExp(`^${name}`) }).click();
  const navs = page.locator('[data-document-surface] [data-node-type="nav"]');
  const id = await navs.last().getAttribute("data-node-id");
  if (!id) throw new Error(`${name} was not inserted`);
  await expect(section(page)).toBeVisible();
  return id;
}

/** The nav's children on the Canvas, as "a:Text" / "button:Text", in document order. */
function canvasChildren(page: Page, navId: string): Promise<string[]> {
  return canvasNode(page, navId).evaluate((nav) =>
    Array.from(nav.children)
      .filter((child) => child.hasAttribute("data-node-id"))
      .map((child) => `${child.tagName.toLowerCase()}:${(child.textContent ?? "").trim()}`),
  );
}

function rowNames(page: Page): Promise<string[]> {
  return linkList(page)
    .getByRole("listitem")
    .evaluateAll((rows) => rows.map((row) => (row.querySelector("button")?.getAttribute("aria-label") ?? "").replace(/^Select /, "")));
}

async function saveNewProject(page: Page, name: string) {
  await page.keyboard.press("Control+s");
  const dialog = page.getByRole("dialog", { name: "Save Project" });
  await dialog.getByRole("textbox", { name: "Project name" }).fill(name);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.locator("[data-project-status]")).toHaveAttribute("data-project-status", "saved");
}

async function expectNoHorizontalOverflow(target: Locator, label: string) {
  const overflow = await target.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const escaping = Array.from(element.querySelectorAll<HTMLElement>("*"))
      .filter((child) => child.getClientRects().length > 0)
      .filter((child) => {
        const rect = child.getBoundingClientRect();
        return rect.width > 0 && (rect.left < box.left - 0.5 || rect.right > box.right + 0.5);
      })
      .map((child) => `${child.tagName.toLowerCase()} "${(child.textContent ?? "").slice(0, 30)}"`);
    const scroller = element.closest<HTMLElement>(".overflow-y-auto");
    return { escaping, scrolls: scroller ? scroller.scrollWidth > scroller.clientWidth : false };
  });
  expect(overflow.escaping, `${label}: nothing escapes the section`).toEqual([]);
  expect(overflow.scrolls, `${label}: the Inspector does not scroll sideways`).toBe(false);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await gotoApp(page);
});

test("Basic Navbar: add, inherited style, edit, keyboard move, remove, Undo/Redo", async ({ page }) => {
  const navId = await insertNavbar(page, "Basic Navbar");
  await expect(section(page).getByText("4 links")).toBeVisible();
  expect(await rowNames(page)).toEqual(["Home", "About", "Services", "Contact"]);
  await expect(button(page, "Move Home up")).toBeDisabled();
  await expect(button(page, "Move Contact down")).toBeDisabled();

  // Add link: one new link after Contact, styled like it.
  await button(page, "Add link").click();
  await expect(section(page).getByText("5 links")).toBeVisible();
  expect(await canvasChildren(page, navId)).toEqual(["a:Home", "a:About", "a:Services", "a:Contact", "a:New link"]);
  const newLinkId = await canvasNode(page, navId).locator(":scope > a").last().getAttribute("data-node-id");
  const contactId = await canvasNode(page, navId).locator(":scope > a").nth(3).getAttribute("data-node-id");
  if (!newLinkId || !contactId) throw new Error("links missing");
  for (const property of ["color", "font-size", "text-decoration-line", "padding-left"]) {
    expect(await computed(page, newLinkId, property), property).toBe(await computed(page, contactId, property));
  }
  await expect(canvasNode(page, newLinkId)).toHaveAttribute("href", "#");

  // Edit its destination (Link section) and its label (Canvas text editing).
  await section(page).getByRole("button", { name: "Select New link" }).click();
  const destination = inspector(page).getByRole("textbox", { name: "Link destination" });
  await destination.fill("/blog");
  await destination.press("Enter");
  await canvasNode(page, newLinkId).dblclick();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Blog");
  await page.keyboard.press("Enter");
  await expect(canvasNode(page, newLinkId)).toHaveText("Blog");
  await expect(canvasNode(page, newLinkId)).toHaveAttribute("href", "/blog");

  // Back to the nav; move Blog up with the keyboard, then down.
  await selectOnCanvas(page, navId);
  await expect(button(page, "Move Blog up")).toBeVisible();
  await button(page, "Move Blog up").focus();
  await page.keyboard.press("Enter");
  expect(await canvasChildren(page, navId)).toEqual(["a:Home", "a:About", "a:Services", "a:Blog", "a:Contact"]);
  await expect(button(page, "Move Blog up")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(button(page, "Move Blog down")).toBeFocused();
  await page.keyboard.press("Space");
  expect(await canvasChildren(page, navId)).toEqual(["a:Home", "a:About", "a:Services", "a:Contact", "a:Blog"]);
  // Blog reached the end: focus moved to its other Move button, not the page.
  await expect(button(page, "Move Blog up")).toBeFocused();

  // Remove About specifically.
  await button(page, "Remove About").click();
  expect(await canvasChildren(page, navId)).toEqual(["a:Home", "a:Services", "a:Contact", "a:Blog"]);
  await expect(button(page, "Remove Services")).toBeFocused();
  await expect(section(page).getByText("4 links")).toBeVisible();

  await undo(page);
  expect(await canvasChildren(page, navId)).toEqual(["a:Home", "a:About", "a:Services", "a:Contact", "a:Blog"]);
  await redo(page);
  expect(await canvasChildren(page, navId)).toEqual(["a:Home", "a:Services", "a:Contact", "a:Blog"]);
  // One more Undo reverts exactly one move.
  await undo(page);
  await undo(page);
  expect(await canvasChildren(page, navId)).toEqual(["a:Home", "a:About", "a:Services", "a:Blog", "a:Contact"]);
});

test("the 12-link maximum and the Wrap hint from 6 links", async ({ page }) => {
  await insertNavbar(page, "Basic Navbar");
  await expect(section(page).getByText(NAVIGATION_LINKS_COPY.wrapHint)).toBeHidden();
  await button(page, "Add link").click();
  await expect(section(page).getByText("5 links")).toBeVisible();
  await expect(section(page).getByText(NAVIGATION_LINKS_COPY.wrapHint)).toBeHidden();
  await button(page, "Add link").click();
  await expect(section(page).getByText("6 links")).toBeVisible();
  await expect(section(page).getByText(NAVIGATION_LINKS_COPY.wrapHint)).toBeVisible();

  const add = button(page, "Add link");
  for (let count = 7; count <= 12; count++) {
    await add.click();
    await expect(section(page).getByText(`${count} links`)).toBeVisible();
  }
  await expect(add).toHaveAttribute("aria-disabled", "true");
  await expect(add).toHaveAttribute("title", NAVIGATION_LINKS_COPY.maximum);
  await expect(section(page).getByText(NAVIGATION_LINKS_COPY.maximumNote)).toBeVisible();
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(section(page).getByText("12 links")).toBeVisible();
  await expect(add).toBeFocused();

  // Turning on Wrap (the existing Content Layout control) hides the hint; nothing turned it on automatically.
  await inspector(page).getByRole("button", { name: "Wrap", exact: true }).click();
  await expect(section(page).getByText(NAVIGATION_LINKS_COPY.wrapHint)).toBeHidden();

  // Remove one: Add link is available again.
  await button(page, "Remove Home").click();
  await expect(section(page).getByText("11 links")).toBeVisible();
  await expect(add).not.toHaveAttribute("aria-disabled", "true");
});

test("Navbar with CTA: the button is never listed, moved or removed; Preview, Export and Save/reopen agree", async ({ page, browserName }) => {
  const navId = await insertNavbar(page, "Navbar with CTA");
  expect(await rowNames(page)).toEqual(["Home", "Features", "Pricing"]);
  await expect(section(page).getByText("3 links")).toBeVisible();
  await expect(button(page, "Move Pricing down")).toBeDisabled();

  await button(page, "Add link").click();
  await button(page, "Move Home down").click();
  await button(page, "Remove Features").click();
  const expected = ["a:Home", "a:Pricing", "a:New link", "button:Get Started"];
  expect(await canvasChildren(page, navId)).toEqual(expected);

  // Preview: same order; links stay real links, reachable with Tab in document order.
  await page.getByRole("button", { name: "Enter Preview" }).click();
  await expect(page.getByRole("button", { name: "Exit Preview" })).toBeVisible();
  expect(await canvasChildren(page, navId)).toEqual(expected);
  const previewNav = canvasNode(page, navId);
  await previewNav.locator(":scope > a").first().focus();
  const focusOrder: string[] = [];
  for (let i = 0; i < 4; i++) {
    focusOrder.push(await page.evaluate(() => `${document.activeElement?.tagName.toLowerCase()}:${document.activeElement?.textContent?.trim()}`));
    await page.keyboard.press("Tab");
  }
  // WebKit, like Safari by default, leaves links out of the Tab order, so from the
  // first link Tab goes straight to the CTA. The link order itself is checked above.
  if (browserName === "webkit") expect(focusOrder.slice(0, 2)).toEqual([expected[0], expected[3]]);
  else expect(focusOrder).toEqual(expected);
  await page.getByRole("button", { name: "Exit Preview" }).click();

  // Export: the same anchors in the same nav, in the same order, before the CTA button.
  await page.getByRole("button", { name: "Export Code" }).click();
  const dialog = page.getByRole("dialog", { name: "Export Code" });
  const html = (await dialog.getByTestId("export-code").textContent()) ?? "";
  const navMarkup = /<nav[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? "";
  const exportedChildren = Array.from(navMarkup.matchAll(/<(a|button)\b[^>]*>([^<]*)<\/\1>/g)).map((match) => `${match[1]}:${match[2].trim()}`);
  expect(exportedChildren).toEqual(expected);
  expect(navMarkup).toMatch(/<a class="[^"]*ly-link[^"]*" href="#">New link<\/a>/);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Save, reload, reopen: unchanged.
  await saveNewProject(page, "BC-06.2 navbar");
  await page.reload();
  await gotoApp(page);
  await page.keyboard.press("Control+o");
  const library = page.getByRole("dialog", { name: "Open Project" });
  await library.getByRole("button", { name: "Open BC-06.2 navbar" }).click();
  await expect(library).toBeHidden();
  await expect(canvasNode(page, navId)).toBeVisible();
  expect(await canvasChildren(page, navId)).toEqual(expected);
  await selectOnCanvas(page, navId);
  expect(await rowNames(page)).toEqual(["Home", "Pricing", "New link"]);
});

test("removing a link or trimming a list that an interaction targets keeps the project saveable (BC06-D1)", async ({ page }) => {
  const navId = await insertNavbar(page, "Basic Navbar");
  const aboutId = await canvasNode(page, navId).locator(":scope > a").nth(1).getAttribute("data-node-id");
  if (!aboutId) throw new Error("About missing");

  // The Home link toggles About.
  const homeId = await canvasNode(page, navId).locator(":scope > a").first().getAttribute("data-node-id");
  if (!homeId) throw new Error("Home missing");
  await section(page).getByRole("button", { name: "Select Home" }).click();
  const interactionsHeader = inspector(page).getByRole("button", { name: "Interactions", exact: true });
  if ((await interactionsHeader.getAttribute("aria-expanded")) !== "true") await interactionsHeader.click();
  await inspector(page).getByRole("button", { name: "Add Interaction" }).click();
  await inspector(page).getByLabel("Target", { exact: true }).selectOption(aboutId);

  await selectOnCanvas(page, navId);
  await button(page, "Remove About").click();
  await saveNewProject(page, "BC-06.2 integrity");
  await expect(page.getByText("This project couldn't be written")).toHaveCount(0);

  // A List trimmed below an item a Button targets also saves (the original BC06-D1 reproduction).
  await page.getByRole("button", { name: "HTML", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Unordered List/ }).click();
  const listId = await page.locator('[data-document-surface] [data-node-type="ul"]').last().getAttribute("data-node-id");
  if (!listId) throw new Error("list not inserted");
  const thirdItemId = await canvasNode(page, listId).locator(":scope > li").nth(2).getAttribute("data-node-id");
  if (!thirdItemId) throw new Error("third item missing");
  await selectOnCanvas(page, homeId);
  await inspector(page).getByRole("button", { name: "Add Interaction" }).click();
  await inspector(page).getByLabel("Target", { exact: true }).last().selectOption(thirdItemId);
  await selectOnCanvas(page, listId);
  const items = inspector(page).getByLabel("Items", { exact: true });
  await items.fill("2");
  await items.press("Enter");
  await expect(canvasNode(page, listId).locator(":scope > li")).toHaveCount(2);
  await page.keyboard.press("Control+s");
  await expect(page.locator("[data-project-status]")).toHaveAttribute("data-project-status", "saved");
  await expect(page.getByText("This project couldn't be written")).toHaveCount(0);
});

test("at the narrowest Inspector width the rows, buttons and notes stay inside the section", async ({ page }) => {
  await insertNavbar(page, "Basic Navbar");
  const handle = page.getByRole("separator", { name: "Resize Inspector Panel" });
  const box = await handle.boundingBox();
  if (!box) throw new Error("resize handle not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(1599, box.y + 300, { steps: 10 });
  await page.mouse.up();
  const minimum = await handle.getAttribute("aria-valuemin");
  await expect(handle).toHaveAttribute("aria-valuenow", minimum ?? "");

  // A long label, the hint and the maximum note at once.
  await section(page).getByRole("button", { name: "Select Home" }).click();
  const navId = await page.locator('[data-document-surface] [data-node-type="nav"]').last().getAttribute("data-node-id");
  if (!navId) throw new Error("nav missing");
  const homeId = await canvasNode(page, navId).locator(":scope > a").first().getAttribute("data-node-id");
  if (!homeId) throw new Error("Home missing");
  await canvasNode(page, homeId).dblclick();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("A very long navigation label that cannot fit");
  await page.keyboard.press("Enter");
  await selectOnCanvas(page, navId);
  for (let i = 0; i < 8; i++) await button(page, "Add link").click();
  await expect(section(page).getByText("12 links")).toBeVisible();
  await expect(section(page).getByText(NAVIGATION_LINKS_COPY.wrapHint)).toBeVisible();
  await expect(section(page).getByText(NAVIGATION_LINKS_COPY.maximumNote)).toBeVisible();

  await expectNoHorizontalOverflow(section(page), `Inspector at ${minimum}px`);
  const longRemove = button(page, "Remove A very long navigation label that cannot fit");
  await longRemove.scrollIntoViewIfNeeded();
  await expect(longRemove).toBeVisible();
  const sectionBox = await section(page).boundingBox();
  const removeBox = await longRemove.boundingBox();
  if (!sectionBox || !removeBox) throw new Error("no boxes");
  expect(removeBox.x + removeBox.width).toBeLessThanOrEqual(sectionBox.x + sectionBox.width + 0.5);
});
