import { expect, test, type Locator, type Page } from "@playwright/test";
import type { EditorElementNode } from "../src/features/editor/types/document";
import { exportHtmlCss } from "../src/features/export/utils/exportHtmlCss";
import { serializeProject } from "../src/features/project/utils/serializeProject";
import { gotoApp } from "./support/gotoApp";

/*
 * BC-02.4 — B1: form controls must be operable in Preview, the way they are
 * on the exported page, while Design keeps its editing behavior. Everything
 * typed or toggled in Preview is runtime state only: it never reaches the
 * document, the undo history or the saved/unsaved status, and it is gone
 * when Preview ends.
 */

const EDITOR = "http://localhost:3000";

const formDocument: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    {
      id: "form-1",
      tag: "form",
      children: [
        { id: "label-name", tag: "label", children: [{ id: "label-name-text", tag: "p", text: "Name" }, { id: "i-text", tag: "input", inputType: "text", name: "name", value: "Ada", htmlId: "f-text" }] },
        { id: "i-email", tag: "input", inputType: "email", name: "email", placeholder: "you@example.com", htmlId: "f-email" },
        { id: "i-pass", tag: "input", inputType: "password", name: "password", htmlId: "f-pass" },
        { id: "i-num", tag: "input", inputType: "number", name: "count", value: "5", htmlId: "f-num" },
        { id: "i-search", tag: "input", inputType: "search", name: "q", htmlId: "f-search" },
        { id: "i-url", tag: "input", inputType: "url", name: "site", htmlId: "f-url" },
        { id: "i-tel", tag: "input", inputType: "tel", name: "phone", value: "123", htmlId: "f-tel" },
        { id: "t-area", tag: "textarea", name: "bio", value: "Hello", htmlId: "f-area" },
        { id: "label-check", tag: "label", children: [{ id: "i-check", tag: "input", inputType: "checkbox", name: "subscribe", htmlId: "f-check" }, { id: "label-check-text", tag: "p", text: "Subscribe" }] },
        { id: "i-radio-1", tag: "input", inputType: "radio", name: "plan", value: "basic", checked: true, htmlId: "f-radio-1" },
        { id: "i-radio-2", tag: "input", inputType: "radio", name: "plan", value: "pro", htmlId: "f-radio-2" },
        { id: "i-radio-3", tag: "input", inputType: "radio", name: "plan", value: "team", htmlId: "f-radio-3" },
        {
          id: "sel",
          tag: "select",
          name: "size",
          htmlId: "f-select",
          children: [
            { id: "o-1", tag: "option", text: "Small", value: "s" },
            { id: "o-2", tag: "option", text: "Medium", value: "m", selected: true },
            { id: "o-3", tag: "option", text: "Large", value: "l" },
          ],
        },
        { id: "b-send", tag: "button", text: "Send" },
      ],
    },
    { id: "form-2", tag: "form", children: [{ id: "i-single", tag: "input", inputType: "text", name: "only", value: "single", htmlId: "f-single" }] },
  ],
};

const AUTHORED: Record<string, string> = { "i-text": "Ada", "i-email": "", "i-pass": "", "i-num": "5", "i-search": "", "i-url": "", "i-tel": "123", "t-area": "Hello", "i-single": "single" };

const control = (page: Page, nodeId: string): Locator => page.locator(`[data-document-surface] [data-node-id="${nodeId}"]`);
const enterPreview = (page: Page) => page.getByRole("button", { name: "Enter Preview" }).click();
const exitPreview = (page: Page) => page.getByRole("button", { name: "Exit Preview" }).click();

async function openForm(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await gotoApp(page);
  const file = serializeProject({
    metadata: { id: "00000000-0000-4000-8000-000000000240", name: "BC-02.4 forms", createdAt: "2026-11-05T00:00:00.000Z", updatedAt: "2026-11-05T00:00:00.000Z" },
    document: formDocument,
  });
  await page.getByTestId("project-import-input").setInputFiles({ name: "forms.layoutry", mimeType: "application/json", buffer: Buffer.from(file) });
  await expect(control(page, "i-single")).toBeAttached({ timeout: 60_000 });
  await page.evaluate(() => Reflect.set(window, "__bc024Marker", "intact"));
}

async function values(page: Page): Promise<Record<string, string>> {
  const entries: [string, string][] = [];
  for (const id of Object.keys(AUTHORED)) entries.push([id, await control(page, id).inputValue()]);
  return Object.fromEntries(entries);
}

async function toggles(page: Page) {
  return {
    check: await control(page, "i-check").isChecked(),
    radio: [await control(page, "i-radio-1").isChecked(), await control(page, "i-radio-2").isChecked(), await control(page, "i-radio-3").isChecked()],
    select: await control(page, "sel").inputValue(),
  };
}

const AUTHORED_TOGGLES = { check: false, radio: [true, false, false], select: "m" };

/** The exported code is a pure function of the document: identical text means an identical document. */
async function exportedCode(page: Page): Promise<string> {
  await page.getByRole("button", { name: "Export Code" }).click();
  const code = page.getByRole("dialog", { name: "Export Code" }).getByTestId("export-code");
  await expect(code).toBeVisible();
  const text = (await code.textContent()) ?? "";
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Export Code" })).toHaveCount(0);
  return text;
}

async function expectEditorIntact(page: Page) {
  await page.waitForTimeout(500);
  expect(page.url().startsWith(EDITOR)).toBe(true);
  expect(new URL(page.url()).search).toBe("");
  expect(await page.evaluate(() => Reflect.get(window, "__bc024Marker"))).toBe("intact");
}

test.beforeEach(async ({ page }) => {
  await openForm(page);
});

test("Design: a click selects the control and typing does not change it (editing stays a deliberate double-click)", async ({ page }) => {
  await control(page, "i-text").click();
  await expect(page.getByLabel("Placeholder", { exact: true })).toBeVisible();
  await page.keyboard.type("zzz");
  expect(await control(page, "i-text").inputValue()).toBe("Ada");
  await control(page, "i-check").click();
  expect(await control(page, "i-check").isChecked()).toBe(false);
  expect(await control(page, "sel").evaluate((select) => select.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })))).toBe(false);
});

test("Preview: text fields and the textarea accept typing, deleting, selecting and pasting", async ({ page }) => {
  await enterPreview(page);
  const text = control(page, "i-text");
  await text.click();
  await page.keyboard.press("End");
  await page.keyboard.type("XYZ");
  await expect(text).toHaveValue("AdaXYZ");
  await page.keyboard.press("Backspace");
  await expect(text).toHaveValue("AdaXY");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Grace");
  await expect(text).toHaveValue("Grace");
  // Paste: the browser's insert-text path, the same one a clipboard paste uses.
  await page.keyboard.insertText(" Hopper");
  await expect(text).toHaveValue("Grace Hopper");

  for (const [id, typed] of [["i-email", "a@b.co"], ["i-pass", "secret"], ["i-search", "query"], ["i-url", "https://x.test"]] as const) {
    await control(page, id).click();
    await page.keyboard.type(typed);
    await expect(control(page, id)).toHaveValue(typed);
  }
  // Tel accepts any character in a browser; the Design-time filter does not apply in Preview.
  await control(page, "i-tel").click();
  await page.keyboard.press("End");
  await page.keyboard.type("4a");
  await expect(control(page, "i-tel")).toHaveValue("1234a");

  const area = control(page, "t-area");
  await area.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("World");
  await expect(area).toHaveValue("Hello\nWorld");
});

test("Preview: a mouse drag inside a field selects text and never moves the element", async ({ page }) => {
  const before = await exportedCode(page);
  await enterPreview(page);
  const text = control(page, "i-text");
  const box = await text.boundingBox();
  if (!box) throw new Error("no box");
  await page.mouse.move(box.x + 4, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2, { steps: 8 });
  await page.mouse.move(box.x + box.width - 4, box.y + box.height * 3, { steps: 8 });
  await page.mouse.up();
  const selection = await text.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd]);
  expect(selection[1]).toBeGreaterThan(selection[0] ?? 0);
  await exitPreview(page);
  expect(await exportedCode(page)).toBe(before);
});

test("Preview: checkbox, label, radio group and select work with mouse and keyboard", async ({ page }) => {
  await enterPreview(page);
  const check = control(page, "i-check");
  await check.click();
  expect(await check.isChecked()).toBe(true);
  // WebKit does not focus a checkbox/radio on click (Safari behavior, the
  // same on the exported page), so keyboard steps focus it explicitly.
  await check.focus();
  await page.keyboard.press("Space");
  expect(await check.isChecked()).toBe(false);
  await page.getByText("Subscribe", { exact: true }).click();
  expect(await check.isChecked()).toBe(true);

  await control(page, "i-radio-2").click();
  expect((await toggles(page)).radio).toEqual([false, true, false]);
  await control(page, "i-radio-2").focus();
  await page.keyboard.press("ArrowDown");
  expect((await toggles(page)).radio).toEqual([false, false, true]);

  const select = control(page, "sel");
  expect(await select.evaluate((element) => element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true })))).toBe(true);
  await select.focus();
  await page.keyboard.press("ArrowDown");
  await expect(select).toHaveValue("l");
  await select.selectOption("s");
  await expect(select).toHaveValue("s");

  const number = control(page, "i-num");
  await number.click();
  await page.keyboard.press("ArrowUp");
  await expect(number).toHaveValue("6");
});

test("Preview: Tab moves through the controls, and labels name them", async ({ page }) => {
  await enterPreview(page);
  await control(page, "i-text").focus();
  await page.keyboard.press("Tab");
  await expect(control(page, "i-email")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(control(page, "i-pass")).toBeFocused();
  await expect(page.getByRole("textbox", { name: "Name" })).toHaveAttribute("data-node-id", "i-text");
  await expect(page.getByRole("checkbox", { name: "Subscribe" })).toHaveAttribute("data-node-id", "i-check");
});

test("Preview: Escape inside a field keeps Preview open; Escape elsewhere still exits", async ({ page }) => {
  await enterPreview(page);
  await control(page, "i-text").click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Exit Preview" })).toBeVisible();
  await control(page, "i-text").evaluate((input: HTMLInputElement) => input.blur());
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Enter Preview" })).toBeVisible();
});

test("Preview: Ctrl+Z undoes typing in the field only, and Ctrl+S is never typed into it", async ({ page }) => {
  await enterPreview(page);
  const text = control(page, "i-text");
  await text.click();
  await page.keyboard.press("End");
  await page.keyboard.type("123");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(text).not.toHaveValue("Ada123");
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await page.keyboard.press("ControlOrMeta+s");
  await page.waitForTimeout(300);
  expect(await text.inputValue()).not.toContain("s");
});

test("Preview: Enter in a form never submits it or navigates the editor", async ({ page }) => {
  await enterPreview(page);
  await control(page, "i-single").click();
  await page.keyboard.press("Enter");
  await expectEditorIntact(page);
  await control(page, "i-text").click();
  await page.keyboard.press("Enter");
  await expectEditorIntact(page);
  await page.getByRole("button", { name: "Send" }).click();
  await expectEditorIntact(page);
});

test("runtime values never reach the document, history or saved status, and reset on every Preview", async ({ page }) => {
  const before = await exportedCode(page);
  const status = await page.locator("[data-project-status]").getAttribute("data-project-status");
  for (let session = 0; session < 2; session++) {
    await enterPreview(page);
    expect(await values(page)).toEqual(AUTHORED);
    expect(await toggles(page)).toEqual(AUTHORED_TOGGLES);
    await control(page, "i-text").fill("Changed");
    await control(page, "t-area").fill("Changed");
    await control(page, "i-num").fill("99");
    await control(page, "i-check").check();
    await control(page, "i-radio-3").check();
    await control(page, "sel").selectOption("l");
    expect((await values(page))["i-text"]).toBe("Changed");
    await exitPreview(page);
    expect(await values(page)).toEqual(AUTHORED);
    expect(await toggles(page)).toEqual(AUTHORED_TOGGLES);
  }
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await expect(page.locator("[data-project-status]")).toHaveAttribute("data-project-status", status ?? "");
  expect(await exportedCode(page)).toBe(before);
  await expectEditorIntact(page);
});

test("exported page: same defaults, same interactions", async ({ page }) => {
  const result = exportHtmlCss(formDocument, { mode: "standalone", title: "Forms" });
  expect(result.ok).toBe(true);
  const html = result.files.find((file) => file.path.endsWith(".html"))?.content ?? "";
  const host = "http://export-host.test/forms.html";
  await page.route(host, (route) => route.fulfill({ status: 200, contentType: "text/html", body: html }));
  await page.goto(host);
  const byId = (id: string) => page.locator(`#${id}`);
  const ids: Record<string, string> = { "i-text": "f-text", "i-email": "f-email", "i-pass": "f-pass", "i-num": "f-num", "i-search": "f-search", "i-url": "f-url", "i-tel": "f-tel", "t-area": "f-area", "i-single": "f-single" };
  for (const [nodeId, htmlId] of Object.entries(ids)) await expect(byId(htmlId), nodeId).toHaveValue(AUTHORED[nodeId] ?? "");
  await expect(byId("f-check")).not.toBeChecked();
  await expect(byId("f-radio-1")).toBeChecked();
  await expect(byId("f-select")).toHaveValue("m");
  await byId("f-text").click();
  await page.keyboard.press("End");
  await page.keyboard.type("XYZ");
  await expect(byId("f-text")).toHaveValue("AdaXYZ");
  await page.getByText("Subscribe", { exact: true }).click();
  await expect(byId("f-check")).toBeChecked();
  await byId("f-radio-2").click();
  await byId("f-radio-2").focus();
  await page.keyboard.press("ArrowDown");
  await expect(byId("f-radio-3")).toBeChecked();
  await byId("f-select").focus();
  await page.keyboard.press("ArrowDown");
  await expect(byId("f-select")).toHaveValue("l");
});

test("Preview: dragging an element never moves it (Preview must not edit the document)", async ({ page }) => {
  const before = await exportedCode(page);
  await enterPreview(page);
  const from = await page.getByRole("button", { name: "Send" }).boundingBox();
  const to = await control(page, "i-single").boundingBox();
  if (!from || !to) throw new Error("no box");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await exitPreview(page);
  expect(await exportedCode(page)).toBe(before);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
});

test("B8: dragging an element inside a free-layout container in Preview never moves it", async ({ page }) => {
  const file = serializeProject({
    metadata: { id: "00000000-0000-4000-8000-000000000241", name: "BC-02.4 free", createdAt: "2026-11-05T00:00:00.000Z", updatedAt: "2026-11-05T00:00:00.000Z" },
    document: {
      id: "page-root",
      tag: "page",
      children: [
        {
          id: "free-box",
          tag: "div",
          layoutMode: "free",
          dimensions: { preferredWidth: 600, preferredHeight: 300, offsetX: 0, offsetY: 0 },
          children: [
            { id: "free-text", tag: "p", text: "free text", freeLayout: { x: 20, y: 20, width: 200, height: 36 } },
            { id: "free-input", tag: "input", inputType: "text", value: "free", freeLayout: { x: 20, y: 120, width: 200, height: 36 } },
          ],
        },
      ],
    },
  });
  await page.getByTestId("project-import-input").setInputFiles({ name: "free.layoutry", mimeType: "application/json", buffer: Buffer.from(file) });
  await expect(control(page, "free-input")).toBeAttached({ timeout: 60_000 });
  const before = await exportedCode(page);
  await enterPreview(page);
  for (const id of ["free-text", "free-input"]) {
    const box = await control(page, id).boundingBox();
    if (!box) throw new Error("no box");
    await page.mouse.move(box.x + 10, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 160, box.y + 140, { steps: 12 });
    await page.mouse.up();
  }
  await exitPreview(page);
  expect(await exportedCode(page)).toBe(before);
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
});
