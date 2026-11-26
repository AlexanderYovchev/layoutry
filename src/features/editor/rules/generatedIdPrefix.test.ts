import { describe, expect, it } from "vitest";
import {
  chooseGeneratedIdPrefix,
  generatedIdPrefixFor,
} from "@/features/editor/rules/generatedIdPrefix";

describe("generated-id prefix (BC-17.2, Report 1 §11)", () => {
  it('uses "ly-" when no authored id starts with it', () => {
    expect(chooseGeneratedIdPrefix([])).toBe("ly-");
    expect(chooseGeneratedIdPrefix(["hero", "lyrics", "ly"])).toBe("ly-");
  });

  it("moves to the next free prefix instead of restricting authored ids", () => {
    expect(chooseGeneratedIdPrefix(["ly-tab-1"])).toBe("ly1-");
    expect(chooseGeneratedIdPrefix(["ly-a", "ly1-b", "ly2-c"])).toBe("ly3-");
  });

  it("reads every authored htmlId in the document, at any depth, and is deterministic", () => {
    const document = {
      id: "page-root",
      tag: "page",
      children: [
        {
          id: "div-1",
          tag: "div",
          htmlId: "intro",
          children: [{ id: "p-1", tag: "p", htmlId: "ly-s1-grad0" }],
        },
      ],
    };
    expect(generatedIdPrefixFor(document)).toBe("ly1-");
    expect(generatedIdPrefixFor(document)).toBe(
      generatedIdPrefixFor(structuredClone(document)),
    );
  });
});
