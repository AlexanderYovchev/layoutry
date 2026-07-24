import { describe, expect, it } from "vitest";
import { mergeRefs } from "./utils";

describe("mergeRefs", () => {
  it("calls every provided ref callback with the same element", () => {
    const calls: Array<string | null> = [];
    const refA = (el: string | null) => calls.push(`a:${el}`);
    const refB = (el: string | null) => calls.push(`b:${el}`);

    mergeRefs(refA, refB)("node");

    expect(calls).toEqual(["a:node", "b:node"]);
  });

  it("skips undefined refs without throwing", () => {
    const calls: Array<string | null> = [];
    const refA = (el: string | null) => calls.push(`a:${el}`);

    expect(() => mergeRefs(refA, undefined)("node")).not.toThrow();
    expect(calls).toEqual(["a:node"]);
  });

  it("forwards null on unmount", () => {
    const calls: Array<string | null> = [];
    const refA = (el: string | null) => calls.push(el);

    mergeRefs(refA)(null);

    expect(calls).toEqual([null]);
  });
});
