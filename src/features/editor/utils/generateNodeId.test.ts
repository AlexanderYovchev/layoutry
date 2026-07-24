import { describe, expect, it } from "vitest";
import { generateNodeId } from "./generateNodeId";

describe("generateNodeId", () => {
  it("prefixes the id with the given tag", () => {
    expect(generateNodeId("button")).toMatch(/^button-/);
  });

  it("generates a different id on every call", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateNodeId("div")));
    expect(ids.size).toBe(50);
  });
});
