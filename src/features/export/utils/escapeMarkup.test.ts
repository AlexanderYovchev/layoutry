// @vitest-environment node
import { describe, expect, it } from "vitest";
import { escapeCssString, escapeHtmlAttribute, escapeHtmlText, stripNullCharacters } from "@/features/export/utils/escapeMarkup";

describe("escapeMarkup", () => {
  it("escapes text so markup cannot start", () => {
    expect(escapeHtmlText(`Tom & Jerry <script>alert(1)</script> > "q" 'a'`)).toBe(`Tom &amp; Jerry &lt;script&gt;alert(1)&lt;/script&gt; &gt; "q" 'a'`);
  });

  it("keeps Unicode and newlines untouched", () => {
    expect(escapeHtmlText("Ünïcødé — 漢字 🚀\nline two")).toBe("Ünïcødé — 漢字 🚀\nline two");
  });

  it("escapes attribute values so they cannot close their quotes", () => {
    expect(escapeHtmlAttribute(`x" onmouseover="alert(1)`)).toBe("x&quot; onmouseover=&quot;alert(1)");
    expect(escapeHtmlAttribute("it's <b>")).toBe("it&#39;s &lt;b&gt;");
  });

  it("serializes CSS strings with CSS escapes and never emits a raw <", () => {
    expect(escapeCssString('a"b\\c')).toBe('"a\\"b\\\\c"');
    expect(escapeCssString("line\nbreak")).toBe('"line\\a break"');
    expect(escapeCssString("</style><script>")).toBe('"\\3c /style>\\3c script>"');
  });

  it("removes NUL characters and reports it", () => {
    expect(stripNullCharacters("a\u0000b")).toEqual({ text: "ab", changed: true });
    expect(stripNullCharacters("ab")).toEqual({ text: "ab", changed: false });
  });
});
