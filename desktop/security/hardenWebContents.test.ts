// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { hardenWebContents } from "./hardenWebContents";

function setup() {
  const on = vi.fn();
  const setWindowOpenHandler = vi.fn();
  hardenWebContents({ on, setWindowOpenHandler });

  function listener(eventName: string) {
    const call = on.mock.calls.find(([name]) => name === eventName);
    if (!call) throw new Error(`no ${eventName} listener`);
    return call[1];
  }
  function fire(
    eventName: string,
    details: { url?: string; isMainFrame?: boolean },
  ) {
    const event = { ...details, preventDefault: vi.fn() };
    listener(eventName)(event);
    return event.preventDefault;
  }
  return { setWindowOpenHandler, fire };
}

describe("hardenWebContents", () => {
  it.each([
    "https://example.com",
    "http://example.com",
    "file:///C:/x",
    "app://layoutry/",
    "ms-settings:",
  ])(
    "denies window.open / target=_blank for %j without opening anything",
    (url) => {
      const { setWindowOpenHandler } = setup();
      const handler = setWindowOpenHandler.mock.calls[0][0];
      expect(handler({ url })).toEqual({ action: "deny" });
    },
  );

  it("keeps the main window on app://layoutry/", () => {
    const { fire } = setup();
    expect(
      fire("will-navigate", { url: "app://layoutry/" }),
    ).not.toHaveBeenCalled();
    expect(
      fire("will-navigate", { url: "https://example.com" }),
    ).toHaveBeenCalled();
    expect(
      fire("will-navigate", { url: "file:///C:/Windows/win.ini" }),
    ).toHaveBeenCalled();
    expect(
      fire("will-navigate", { url: "javascript:alert(1)" }),
    ).toHaveBeenCalled();
  });

  it("blocks main-frame redirects away from the app", () => {
    const { fire } = setup();
    expect(
      fire("will-redirect", { url: "https://example.com", isMainFrame: true }),
    ).toHaveBeenCalled();
    expect(
      fire("will-redirect", {
        url: "https://example.com/next",
        isMainFrame: false,
      }),
    ).not.toHaveBeenCalled();
  });

  it("lets authored iframes browse the web but never load local or privileged URLs", () => {
    const { fire } = setup();
    expect(
      fire("will-frame-navigate", {
        url: "https://example.com/embed",
        isMainFrame: false,
      }),
    ).not.toHaveBeenCalled();
    expect(
      fire("will-frame-navigate", {
        url: "file:///C:/Users/x.txt",
        isMainFrame: false,
      }),
    ).toHaveBeenCalled();
    expect(
      fire("will-frame-navigate", {
        url: "app://layoutry/",
        isMainFrame: false,
      }),
    ).toHaveBeenCalled();
  });

  it("never attaches a <webview>", () => {
    const { fire } = setup();
    expect(fire("will-attach-webview", {})).toHaveBeenCalled();
  });
});
