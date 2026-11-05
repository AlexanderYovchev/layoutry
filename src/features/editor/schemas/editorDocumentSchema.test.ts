import { describe, expect, it } from "vitest";
import { editorElementNodeSchema } from "./editorDocumentSchema";

describe("editorElementNodeSchema — embed attributes (BC-02.3)", () => {
  const embed = { id: "iframe-1", tag: "iframe", src: "https://example.com/embed", title: "Embedded content" };

  it("accepts an ordinary embed", () => {
    expect(editorElementNodeSchema.safeParse(embed).success).toBe(true);
  });

  it.each([
    ["sandbox", "allow-top-navigation allow-same-origin allow-scripts"],
    ["srcdoc", "<script>top.location='https://evil.test'</script>"],
    ["srcDoc", "<script></script>"],
    ["allow", "camera; microphone; fullscreen"],
    ["allowFullScreen", true],
    ["referrerPolicy", "unsafe-url"],
  ])("refuses an imported %s field: the document has no way to carry iframe security attributes", (field, value) => {
    expect(editorElementNodeSchema.safeParse({ ...embed, [field]: value }).success).toBe(false);
  });

  it("refuses a javascript: embed source", () => {
    expect(editorElementNodeSchema.safeParse({ ...embed, src: "javascript:alert(1)" }).success).toBe(false);
  });

  it("still accepts a data: source, which the renderer and the export then refuse to frame (no schema change)", () => {
    expect(editorElementNodeSchema.safeParse({ ...embed, src: "data:text/html,<b>x</b>" }).success).toBe(true);
  });
});
