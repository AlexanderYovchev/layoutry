import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRANSITION_SETTINGS,
  getTransitionSettings,
  isValidTransitionDelayMs,
  isValidTransitionDurationMs,
  transitionSettingsEqual,
  withTransitionField,
} from "./transition";

describe("getTransitionSettings", () => {
  it("returns undefined for a node with no authored transition", () => {
    expect(getTransitionSettings({ tag: "div" } as never)).toBeUndefined();
  });

  it("returns the node's own transition unchanged", () => {
    const node = { transition: DEFAULT_TRANSITION_SETTINGS };
    expect(getTransitionSettings(node)).toBe(node.transition);
  });
});

describe("withTransitionField", () => {
  it("merges exactly one field, leaving the others untouched", () => {
    const next = withTransitionField(DEFAULT_TRANSITION_SETTINGS, "durationMs", 1000);
    expect(next).toEqual({ ...DEFAULT_TRANSITION_SETTINGS, durationMs: 1000 });
  });
});

describe("isValidTransitionDurationMs / isValidTransitionDelayMs", () => {
  it.each([0, 1, 200, 1000])("accepts %i", (value) => {
    expect(isValidTransitionDurationMs(value)).toBe(true);
    expect(isValidTransitionDelayMs(value)).toBe(true);
  });

  it.each([-1, NaN, Infinity, -Infinity])("rejects %s", (value) => {
    expect(isValidTransitionDurationMs(value)).toBe(false);
    expect(isValidTransitionDelayMs(value)).toBe(false);
  });
});

describe("transitionSettingsEqual", () => {
  it("treats two absent transitions as equal", () => {
    expect(transitionSettingsEqual(undefined, undefined)).toBe(true);
  });

  it("treats identical structural values as equal even as different object references", () => {
    expect(transitionSettingsEqual({ ...DEFAULT_TRANSITION_SETTINGS }, { ...DEFAULT_TRANSITION_SETTINGS })).toBe(true);
  });

  it("treats a defined and an absent transition as unequal", () => {
    expect(transitionSettingsEqual(DEFAULT_TRANSITION_SETTINGS, undefined)).toBe(false);
  });

  it("treats a differing field as unequal", () => {
    expect(transitionSettingsEqual(DEFAULT_TRANSITION_SETTINGS, { ...DEFAULT_TRANSITION_SETTINGS, durationMs: 999 })).toBe(false);
  });
});
