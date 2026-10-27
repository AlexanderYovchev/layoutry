import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  matchProjectShortcut,
  useProjectKeyboardShortcuts,
  type ProjectShortcutHandlers,
} from "@/features/project/hooks/useProjectKeyboardShortcuts";

function key(
  init: KeyboardEventInit,
  target: EventTarget = window,
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

function mountHandlers() {
  const handlers: ProjectShortcutHandlers = {
    onNewProject: vi.fn(),
    onOpenProject: vi.fn(),
    onSave: vi.fn(),
    onSaveAs: vi.fn(),
  };
  const hook = renderHook(() => useProjectKeyboardShortcuts(handlers));
  return { handlers, hook };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("matchProjectShortcut", () => {
  const base = {
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    repeat: false,
  };

  it.each([
    [{ key: "s", ctrlKey: true }, "onSave"],
    [{ key: "s", metaKey: true }, "onSave"],
    [{ key: "S", ctrlKey: true, shiftKey: true }, "onSaveAs"],
    [{ key: "o", ctrlKey: true }, "onOpenProject"],
    [{ key: "n", metaKey: true }, "onNewProject"],
  ])("maps %o to %s", (event, expected) => {
    expect(matchProjectShortcut({ ...base, ...event })).toBe(expected);
  });

  it.each([
    [{ key: "s" }],
    [{ key: "s", ctrlKey: true, altKey: true }],
    [{ key: "s", ctrlKey: true, repeat: true }],
    [{ key: "o", ctrlKey: true, shiftKey: true }],
    // The editor's own shortcuts are never claimed.
    [{ key: "z", ctrlKey: true }],
    [{ key: "c", ctrlKey: true }],
    [{ key: "v", ctrlKey: true }],
    [{ key: "d", ctrlKey: true }],
    [{ key: "y", ctrlKey: true }],
    [{ key: "Delete" }],
  ])("ignores %o", (event) => {
    expect(matchProjectShortcut({ ...base, ...event })).toBeNull();
  });
});

describe("useProjectKeyboardShortcuts", () => {
  it("runs the command and prevents the browser's own Save dialog", () => {
    const { handlers } = mountHandlers();
    const event = key({ key: "s", ctrlKey: true });
    expect(handlers.onSave).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves unrelated keys alone", () => {
    const { handlers } = mountHandlers();
    const event = key({ key: "z", ctrlKey: true });
    expect(event.defaultPrevented).toBe(false);
    expect(
      Object.values(handlers).every(
        (handler) => vi.mocked(handler).mock.calls.length === 0,
      ),
    ).toBe(true);
  });

  it("also works while an Inspector field has focus", () => {
    const { handlers } = mountHandlers();
    const input = document.createElement("input");
    document.body.append(input);
    key({ key: "s", ctrlKey: true, shiftKey: true }, input);
    expect(handlers.onSaveAs).toHaveBeenCalledOnce();
  });

  it("does nothing while a modal dialog is open", () => {
    const { handlers } = mountHandlers();
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    document.body.append(dialog);
    const event = key({ key: "o", ctrlKey: true });
    expect(handlers.onOpenProject).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("keeps the browser's Save page dialog away while a modal dialog is open", () => {
    const { handlers } = mountHandlers();
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    document.body.append(dialog);
    const save = key({ key: "s", ctrlKey: true });
    const saveAs = key({ key: "S", ctrlKey: true, shiftKey: true });
    expect(handlers.onSave).not.toHaveBeenCalled();
    expect(handlers.onSaveAs).not.toHaveBeenCalled();
    expect(save.defaultPrevented).toBe(true);
    expect(saveAs.defaultPrevented).toBe(true);
  });

  it("registers one listener and removes it on unmount", () => {
    const { handlers, hook } = mountHandlers();
    hook.rerender();
    key({ key: "s", ctrlKey: true });
    expect(handlers.onSave).toHaveBeenCalledTimes(1);
    hook.unmount();
    key({ key: "s", ctrlKey: true });
    expect(handlers.onSave).toHaveBeenCalledTimes(1);
  });
});
