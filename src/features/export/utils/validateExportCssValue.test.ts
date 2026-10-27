// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isExportableColor, isExportableFontFamily, isStructurallySafeCssValue, validateCssDeclarationValue } from "@/features/export/utils/validateExportCssValue";

describe("validateExportCssValue", () => {
  it.each(["#fff", "#11223344", "rgb(1, 2, 3)", "rgba(1,2,3,0.5)", "rgb(0 0 0 / 0.1)", "hsl(200, 50%, 40%)", "oklch(54.6% 0.245 262.881)", "color-mix(in oklab, #000 40%, transparent)", "rebeccapurple", "transparent", "currentColor"])(
    "accepts the color %s",
    (value) => {
      expect(isExportableColor(value)).toBe(true);
    },
  );

  it.each(["red; background: url(x)", "#12", "rgb(1,2,3", "expression(alert(1))", "url(javascript:x)", "notacolor"])("rejects the color %j", (value) => {
    expect(isExportableColor(value)).toBe(false);
  });

  it.each(["Arial", "'Fira Sans', sans-serif", '"Segoe UI", Roboto, system-ui', "Times New Roman, serif"])("accepts the font family %j", (value) => {
    expect(isExportableFontFamily(value)).toBe(true);
  });

  it.each(["Arial; color: red", "'Unclosed, serif", "a\\62 c", "Arial}body{x:y", ""])("rejects the font family %j", (value) => {
    expect(isExportableFontFamily(value)).toBe(false);
  });

  it.each(["red;}body{display:none", "1px</style><script>", "10px !important", "0 /* comment */", "@import url(x)", "calc(1px", "a\\61", "x\ny"])(
    "rejects structurally unsafe value %j",
    (value) => {
      expect(isStructurallySafeCssValue(value)).toBe(false);
    },
  );

  it("keeps advanced but safe authored CSS", () => {
    for (const value of ["linear-gradient(135deg, #6366f1 0%, #ec4899 100%)", "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)", "min(100%, 240px)", "translateX(10px) rotate(6deg) scale(0.9)", "1 / span 2", "0 8px 16px -4px rgba(15, 23, 42, 0.35), inset 2px 2px 0 0 #f97316"]) {
      expect(isStructurallySafeCssValue(value)).toBe(true);
    }
  });

  it("reports the specific reason a declaration was dropped", () => {
    expect(validateCssDeclarationValue("color", "blue; x:y")).toMatchObject({ ok: false, code: "invalid-css-value" });
    expect(validateCssDeclarationValue("background-color", "bluish")).toMatchObject({ ok: false, code: "invalid-color" });
    expect(validateCssDeclarationValue("font-family", "'a")).toMatchObject({ ok: false, code: "invalid-css-value" });
    expect(validateCssDeclarationValue("font-family", "3D Font")).toMatchObject({ ok: false, code: "invalid-font-family" });
    expect(validateCssDeclarationValue("width", "240px")).toEqual({ ok: true });
  });
});
