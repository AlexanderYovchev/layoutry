import { describe, expect, it } from "vitest";
import { documentNodeAttributes } from "./documentNodeAttributes";

describe("documentNodeAttributes", () => {
  it("stamps the node's own id and tag as data attributes", () => {
    expect(documentNodeAttributes({ id: "heading-1", tag: "h1" }, "body-1")).toEqual({
      "data-node-id": "heading-1",
      "data-node-type": "h1",
      "data-parent-id": "body-1",
    });
  });

  it("renders an empty parent id for the document root", () => {
    expect(documentNodeAttributes({ id: "page-root", tag: "page" }, null)).toEqual({
      "data-node-id": "page-root",
      "data-node-type": "page",
      "data-parent-id": "",
    });
  });
});
