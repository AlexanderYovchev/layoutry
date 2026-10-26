// @vitest-environment node
import { describe, expect, it } from "vitest";
import { outerMinimumForContent } from "./windowSizing";

const editorFloor = { width: 900, height: 600 };

describe("outerMinimumForContent", () => {
  it("adds the window frame to the editor's content floor", () => {
    // Windows 10 at 100%: 16px of side borders, 39px of title bar + borders.
    expect(
      outerMinimumForContent(
        editorFloor,
        { width: 1440, height: 900 },
        { width: 1424, height: 861 },
      ),
    ).toEqual({ width: 916, height: 639 });
  });

  it("is the content floor itself for a frameless window", () => {
    expect(
      outerMinimumForContent(
        editorFloor,
        { width: 1200, height: 800 },
        { width: 1200, height: 800 },
      ),
    ).toEqual(editorFloor);
  });

  it("never shrinks below the content floor", () => {
    expect(
      outerMinimumForContent(
        editorFloor,
        { width: 1000, height: 700 },
        { width: 1010, height: 710 },
      ),
    ).toEqual(editorFloor);
  });
});
