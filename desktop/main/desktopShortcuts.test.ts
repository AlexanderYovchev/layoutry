// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  classifyDesktopShortcut,
  installDesktopShortcuts,
  type ShortcutInput,
} from "./desktopShortcuts";

function key(
  key: string,
  modifiers: Partial<ShortcutInput> = {},
): ShortcutInput {
  return {
    type: "keyDown",
    key,
    control: false,
    shift: false,
    alt: false,
    meta: false,
    ...modifiers,
  };
}

const production = { devToolsEnabled: false };
const development = { devToolsEnabled: true };

describe("classifyDesktopShortcut", () => {
  it.each([
    ["Ctrl+R", key("r", { control: true })],
    ["Ctrl+Shift+R", key("R", { control: true, shift: true })],
    ["F5", key("F5")],
    ["Shift+F5", key("F5", { shift: true })],
    ["Ctrl+F5", key("F5", { control: true })],
  ])("blocks reload shortcut %s", (_label, input) => {
    expect(classifyDesktopShortcut(input, production)).toBe("block-reload");
  });

  it.each([
    ["Ctrl+Z", key("z", { control: true })],
    ["Ctrl+Shift+Z", key("Z", { control: true, shift: true })],
    ["Ctrl+Y", key("y", { control: true })],
    ["Ctrl+C", key("c", { control: true })],
    ["Ctrl+X", key("x", { control: true })],
    ["Ctrl+V", key("v", { control: true })],
    ["Ctrl+D", key("d", { control: true })],
    ["Ctrl+A", key("a", { control: true })],
    ["Delete", key("Delete")],
    ["Backspace", key("Backspace")],
    ["plain r", key("r")],
    ["Alt+R", key("r", { alt: true })],
    ["Escape", key("Escape")],
  ])("passes %s through to the editor", (_label, input) => {
    expect(classifyDesktopShortcut(input, production)).toBe("pass-through");
  });

  it("ignores key-up events", () => {
    expect(
      classifyDesktopShortcut({ ...key("F5"), type: "keyUp" }, production),
    ).toBe("pass-through");
  });

  it("only toggles DevTools when explicitly enabled for development", () => {
    expect(classifyDesktopShortcut(key("F12"), production)).toBe(
      "pass-through",
    );
    expect(
      classifyDesktopShortcut(
        key("I", { control: true, shift: true }),
        production,
      ),
    ).toBe("pass-through");
    expect(classifyDesktopShortcut(key("F12"), development)).toBe(
      "toggle-devtools",
    );
    expect(
      classifyDesktopShortcut(
        key("I", { control: true, shift: true }),
        development,
      ),
    ).toBe("toggle-devtools");
  });
});

describe("installDesktopShortcuts", () => {
  function setup(options = production) {
    const on = vi.fn();
    const toggleDevTools = vi.fn();
    installDesktopShortcuts({ on, toggleDevTools }, options);
    const listener = on.mock.calls.find(
      ([name]) => name === "before-input-event",
    )?.[1];
    function press(input: ShortcutInput) {
      const event = { preventDefault: vi.fn() };
      listener(event, input);
      return event.preventDefault;
    }
    return { press, toggleDevTools };
  }

  it("swallows reload shortcuts before the page or Chromium sees them", () => {
    const { press } = setup();
    expect(press(key("r", { control: true }))).toHaveBeenCalled();
    expect(press(key("F5"))).toHaveBeenCalled();
  });

  it("leaves editor shortcuts alone", () => {
    const { press } = setup();
    expect(press(key("z", { control: true }))).not.toHaveBeenCalled();
    expect(press(key("y", { control: true }))).not.toHaveBeenCalled();
  });

  it("toggles DevTools only in development", () => {
    const dev = setup(development);
    expect(dev.press(key("F12"))).toHaveBeenCalled();
    expect(dev.toggleDevTools).toHaveBeenCalledTimes(1);

    const prod = setup(production);
    prod.press(key("F12"));
    expect(prod.toggleDevTools).not.toHaveBeenCalled();
  });
});
