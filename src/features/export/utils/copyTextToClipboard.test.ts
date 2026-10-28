import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "@/features/export/utils/copyTextToClipboard";

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value });
}

describe("copyTextToClipboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, "execCommand");
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("writes the exact text with the Clipboard API", async () => {
    const writeText = vi.fn(async () => undefined);
    setClipboard({ writeText });
    expect(await copyTextToClipboard("<p>\n  &amp;\n</p>")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("<p>\n  &amp;\n</p>");
  });

  it("falls back to a selected read-only textarea, removed afterwards, keeping focus", async () => {
    setClipboard(undefined);
    let copied: string | null = null;
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => {
        const active = document.activeElement;
        copied = active instanceof HTMLTextAreaElement && active.readOnly ? active.value : null;
        return true;
      }),
    });
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    expect(await copyTextToClipboard("a { color: red; }")).toBe(true);
    expect(copied).toBe("a { color: red; }");
    expect(document.querySelector("textarea")).toBeNull();
    expect(button).toHaveFocus();
    button.remove();
  });

  it("reports failure when neither way works", async () => {
    setClipboard({ writeText: vi.fn(async () => Promise.reject(new Error("denied"))) });
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn(() => false) });
    expect(await copyTextToClipboard("x")).toBe(false);
  });
});
