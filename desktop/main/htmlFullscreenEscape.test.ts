// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { installHtmlFullscreenControl, isFullscreenEscape, type FullscreenWindow } from "./htmlFullscreenEscape";

describe("Escape leaves element fullscreen (BC-08.4)", () => {
  it("only Escape key-down, only while an element is fullscreen", () => {
    expect(isFullscreenEscape({ type: "keyDown", key: "Escape" }, true)).toBe(true);
    expect(isFullscreenEscape({ type: "keyUp", key: "Escape" }, true)).toBe(false);
    expect(isFullscreenEscape({ type: "keyDown", key: "Enter" }, true)).toBe(false);
    expect(isFullscreenEscape({ type: "keyDown", key: "Escape" }, false)).toBe(false);
  });

  it("follows the window's element-fullscreen events and consumes only that Escape", () => {
    const windowListeners = new Map<string, () => void>();
    let inputListener: Parameters<FullscreenWindow["webContents"]["on"]>[1] = () => {};
    const setFullScreen = vi.fn<(flag: boolean) => void>();
    const window: FullscreenWindow = {
      on: vi.fn((name: string, listener: () => void) => windowListeners.set(name, listener)),
      setFullScreen,
      webContents: { on: vi.fn((_name: string, listener: typeof inputListener) => (inputListener = listener)) },
    };
    installHtmlFullscreenControl(window);
    const event = { preventDefault: vi.fn() };
    inputListener(event, { type: "keyDown", key: "Escape" });
    expect(setFullScreen).not.toHaveBeenCalled();
    windowListeners.get("enter-html-full-screen")?.();
    inputListener(event, { type: "keyDown", key: "Escape" });
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(setFullScreen).toHaveBeenCalledWith(false);
    windowListeners.get("leave-html-full-screen")?.();
    inputListener(event, { type: "keyDown", key: "Escape" });
    expect(setFullScreen).toHaveBeenCalledTimes(1);
  });

  it("a removed player that was granted fullscreen returns the window to normal (Electron can miss the exit)", () => {
    const windowListeners = new Map<string, () => void>();
    const setFullScreen = vi.fn<(flag: boolean) => void>();
    const window: FullscreenWindow = {
      on: vi.fn((name: string, listener: () => void) => windowListeners.set(name, listener)),
      setFullScreen,
      webContents: { on: vi.fn() },
    };
    const control = installHtmlFullscreenControl(window);
    windowListeners.get("enter-html-full-screen")?.();
    control.granted(["ly-video-a"]);
    control.playerRemoved("ly-video-other");
    expect(setFullScreen).not.toHaveBeenCalled();
    control.playerRemoved("ly-video-a");
    expect(setFullScreen).toHaveBeenCalledWith(false);
    // After a normal exit nothing is left to undo.
    control.granted(["ly-video-b"]);
    windowListeners.get("leave-html-full-screen")?.();
    control.playerRemoved("ly-video-b");
    expect(setFullScreen).toHaveBeenCalledTimes(1);
  });
});
