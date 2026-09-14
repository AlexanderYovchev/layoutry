import { describe, expect, it } from "vitest";
import { canContainChildren, canParentAcceptChild } from "./insertionRules";

describe("canContainChildren", () => {
  it("accepts the document root and structural container tags", () => {
    expect(canContainChildren("page")).toBe(true);
    expect(canContainChildren("body")).toBe(true);
    expect(canContainChildren("div")).toBe(true);
    expect(canContainChildren("section")).toBe(true);
  });

  it("accepts ul/ol (Checkpoint 1.6)", () => {
    expect(canContainChildren("ul")).toBe(true);
    expect(canContainChildren("ol")).toBe(true);
  });

  it("rejects leaf/text-bearing tags", () => {
    expect(canContainChildren("button")).toBe(false);
    expect(canContainChildren("h1")).toBe(false);
    expect(canContainChildren("p")).toBe(false);
    expect(canContainChildren("img")).toBe(false);
  });

  it("rejects li — a text-bearing leaf, not a container (Checkpoint 1.6)", () => {
    expect(canContainChildren("li")).toBe(false);
  });

  it("rejects input — a leaf, not a container (Checkpoint 1.10)", () => {
    expect(canContainChildren("input")).toBe(false);
  });
});

describe("canParentAcceptChild (Checkpoint 1.6)", () => {
  it("lets ul/ol accept li", () => {
    expect(canParentAcceptChild("ul", "li")).toBe(true);
    expect(canParentAcceptChild("ol", "li")).toBe(true);
  });

  it("rejects any non-li child inside ul/ol", () => {
    expect(canParentAcceptChild("ul", "h1")).toBe(false);
    expect(canParentAcceptChild("ul", "img")).toBe(false);
    expect(canParentAcceptChild("ol", "div")).toBe(false);
    expect(canParentAcceptChild("ol", "button")).toBe(false);
  });

  it("rejects li everywhere except ul/ol", () => {
    expect(canParentAcceptChild("div", "li")).toBe(false);
    expect(canParentAcceptChild("section", "li")).toBe(false);
    expect(canParentAcceptChild("page", "li")).toBe(false);
    expect(canParentAcceptChild("body", "li")).toBe(false);
    expect(canParentAcceptChild("form", "li")).toBe(false);
  });

  it("preserves every existing unrestricted Container/Section relationship", () => {
    expect(canParentAcceptChild("div", "h1")).toBe(true);
    expect(canParentAcceptChild("div", "p")).toBe(true);
    expect(canParentAcceptChild("div", "img")).toBe(true);
    expect(canParentAcceptChild("div", "a")).toBe(true);
    expect(canParentAcceptChild("div", "button")).toBe(true);
    expect(canParentAcceptChild("div", "div")).toBe(true);
    expect(canParentAcceptChild("section", "div")).toBe(true);
    expect(canParentAcceptChild("page", "section")).toBe(true);
  });

  it("still rejects a non-container parent regardless of child tag", () => {
    expect(canParentAcceptChild("h1", "p")).toBe(false);
    expect(canParentAcceptChild("button", "div")).toBe(false);
  });

  it("lets a whole ul/ol be nested into an ordinary container", () => {
    expect(canParentAcceptChild("div", "ul")).toBe(true);
    expect(canParentAcceptChild("section", "ol")).toBe(true);
  });
});

describe("Form + Input containment (Checkpoint 1.10)", () => {
  it("lets Form accept Input, exactly like any other unrestricted container", () => {
    expect(canParentAcceptChild("form", "input")).toBe(true);
  });

  it("lets every existing structural container accept Input — no Form-only restriction is introduced", () => {
    for (const parentTag of ["div", "section", "header", "nav", "main", "article", "aside", "footer"]) {
      expect(canParentAcceptChild(parentTag, "input")).toBe(true);
    }
  });

  it("still rejects Input inside a List — Checkpoint 1.6's ul/ol allowlist remains intact and unweakened", () => {
    expect(canParentAcceptChild("ul", "input")).toBe(false);
    expect(canParentAcceptChild("ol", "input")).toBe(false);
  });

  it("rejects Input as a parent regardless of child tag — Input is a leaf", () => {
    expect(canParentAcceptChild("input", "div")).toBe(false);
    expect(canParentAcceptChild("input", "li")).toBe(false);
  });
});

describe("Label containment (Checkpoint 1.11)", () => {
  it("is a real container — accepts children", () => {
    expect(canContainChildren("label")).toBe(true);
  });

  it("accepts Input, matching the wrapping association model", () => {
    expect(canParentAcceptChild("label", "input")).toBe(true);
  });

  it("accepts other ordinary leaf/container content, following the same broad philosophy every other structural primitive uses", () => {
    expect(canParentAcceptChild("label", "img")).toBe(true);
    expect(canParentAcceptChild("label", "div")).toBe(true);
    expect(canParentAcceptChild("label", "p")).toBe(true);
  });

  it("Form accepts Label, and Container accepts Label — no Form-only restriction", () => {
    expect(canParentAcceptChild("form", "label")).toBe(true);
    expect(canParentAcceptChild("div", "label")).toBe(true);
  });

  it("is rejected directly inside UL/OL — Checkpoint 1.6's li-only allowlist remains unweakened", () => {
    expect(canParentAcceptChild("ul", "label")).toBe(false);
    expect(canParentAcceptChild("ol", "label")).toBe(false);
  });

  it("still rejects li — Label's own child policy doesn't touch the ul/ol allowlist", () => {
    expect(canParentAcceptChild("label", "li")).toBe(false);
  });
});

describe("Checkbox/Radio containment (Checkpoint 1.12)", () => {
  it("reuses Input's exact containment rules unchanged — checkbox/radio share the same tag, so no new containment logic exists or is needed", () => {
    expect(canParentAcceptChild("form", "input")).toBe(true);
    expect(canParentAcceptChild("label", "input")).toBe(true);
    expect(canParentAcceptChild("ul", "input")).toBe(false);
  });
});

describe("Textarea containment (Checkpoint 1.12)", () => {
  it("is a leaf — rejects all children", () => {
    expect(canContainChildren("textarea")).toBe(false);
  });

  it("is insertable into Form, Label, Container, and ordinary structural containers — no Form-only restriction", () => {
    for (const parentTag of ["form", "label", "div", "section", "header", "main"]) {
      expect(canParentAcceptChild(parentTag, "textarea"), parentTag).toBe(true);
    }
  });

  it("is rejected inside UL/OL — Checkpoint 1.6's li-only allowlist remains intact", () => {
    expect(canParentAcceptChild("ul", "textarea")).toBe(false);
    expect(canParentAcceptChild("ol", "textarea")).toBe(false);
  });

  it("rejects Textarea as a parent regardless of child tag", () => {
    expect(canParentAcceptChild("textarea", "div")).toBe(false);
  });
});

describe("Select/Option containment (Checkpoint 1.13)", () => {
  it("Select is a real container (Checkpoint 1.13's own select -> option allowlist entry)", () => {
    expect(canContainChildren("select")).toBe(true);
  });

  it("Option is a leaf — rejects all children, the same shape as List Item", () => {
    expect(canContainChildren("option")).toBe(false);
  });

  it("lets Select accept Option", () => {
    expect(canParentAcceptChild("select", "option")).toBe(true);
  });

  it("rejects any non-option child inside Select", () => {
    for (const childTag of ["p", "h1", "input", "textarea", "div", "label", "button", "li"]) {
      expect(canParentAcceptChild("select", childTag), childTag).toBe(false);
    }
  });

  it("rejects Option everywhere except Select", () => {
    for (const parentTag of ["div", "section", "form", "label", "ul", "ol", "header", "main"]) {
      expect(canParentAcceptChild(parentTag, "option"), parentTag).toBe(false);
    }
  });

  it("rejects Option as a parent regardless of child tag", () => {
    expect(canParentAcceptChild("option", "div")).toBe(false);
  });

  it("Form/Container/ordinary structural containers accept Select, no Form-only restriction", () => {
    for (const parentTag of ["form", "label", "div", "section", "header", "main"]) {
      expect(canParentAcceptChild(parentTag, "select"), parentTag).toBe(true);
    }
  });

  it("is rejected inside UL/OL — Checkpoint 1.6's li-only allowlist remains intact and unweakened", () => {
    expect(canParentAcceptChild("ul", "select")).toBe(false);
    expect(canParentAcceptChild("ol", "select")).toBe(false);
  });

  it("UL/OL's own li-only rule remains unweakened by the new select allowlist entry", () => {
    expect(canParentAcceptChild("ul", "li")).toBe(true);
    expect(canParentAcceptChild("ul", "option")).toBe(false);
    expect(canParentAcceptChild("select", "li")).toBe(false);
  });
});

describe("Table containment (Checkpoint 1.14)", () => {
  it("Table/Thead/Tbody/Tfoot/Tr are all real containers", () => {
    expect(canContainChildren("table")).toBe(true);
    expect(canContainChildren("thead")).toBe(true);
    expect(canContainChildren("tbody")).toBe(true);
    expect(canContainChildren("tfoot")).toBe(true);
    expect(canContainChildren("tr")).toBe(true);
  });

  it("Th/Td are leaves — the same shape as List Item/Option", () => {
    expect(canContainChildren("th")).toBe(false);
    expect(canContainChildren("td")).toBe(false);
  });

  it("Table accepts only Thead/Tbody/Tfoot — direct Table -> Tr is deliberately rejected (see this checkpoint's report, section E)", () => {
    expect(canParentAcceptChild("table", "thead")).toBe(true);
    expect(canParentAcceptChild("table", "tbody")).toBe(true);
    expect(canParentAcceptChild("table", "tfoot")).toBe(true);
    expect(canParentAcceptChild("table", "tr")).toBe(false);
  });

  it("rejects any non-section child inside Table", () => {
    for (const childTag of ["tr", "th", "td", "p", "div", "input", "li", "option"]) {
      expect(canParentAcceptChild("table", childTag), childTag).toBe(false);
    }
  });

  it("Thead/Tbody/Tfoot each accept only Tr", () => {
    expect(canParentAcceptChild("thead", "tr")).toBe(true);
    expect(canParentAcceptChild("tbody", "tr")).toBe(true);
    expect(canParentAcceptChild("tfoot", "tr")).toBe(true);
  });

  it("rejects any non-tr child inside Thead/Tbody/Tfoot", () => {
    for (const parentTag of ["thead", "tbody", "tfoot"]) {
      for (const childTag of ["th", "td", "p", "div", "table"]) {
        expect(canParentAcceptChild(parentTag, childTag), `${parentTag} -> ${childTag}`).toBe(false);
      }
    }
  });

  it("Tr accepts only Th/Td", () => {
    expect(canParentAcceptChild("tr", "th")).toBe(true);
    expect(canParentAcceptChild("tr", "td")).toBe(true);
  });

  it("rejects any non-cell child inside Tr", () => {
    for (const childTag of ["p", "div", "tr", "thead", "input", "li", "option"]) {
      expect(canParentAcceptChild("tr", childTag), childTag).toBe(false);
    }
  });

  it("rejects Thead/Tbody/Tfoot/Tr/Th/Td everywhere except their one constrained parent", () => {
    for (const parentTag of ["div", "section", "form", "label", "ul", "ol", "select", "header", "main"]) {
      for (const childTag of ["thead", "tbody", "tfoot", "tr", "th", "td"]) {
        expect(canParentAcceptChild(parentTag, childTag), `${parentTag} -> ${childTag}`).toBe(false);
      }
    }
  });

  it("rejects Thead/Tbody/Tfoot/Tr/Th/Td as a parent for anything other than their own allowed child", () => {
    expect(canParentAcceptChild("th", "div")).toBe(false);
    expect(canParentAcceptChild("td", "p")).toBe(false);
  });

  it("Table itself is insertable into ordinary structural containers, exactly like Select/List — no Form-only restriction", () => {
    for (const parentTag of ["form", "label", "div", "section", "header", "main"]) {
      expect(canParentAcceptChild(parentTag, "table"), parentTag).toBe(true);
    }
  });

  it("is rejected inside UL/OL/Select — every prior constrained-parent allowlist remains intact and unweakened", () => {
    expect(canParentAcceptChild("ul", "table")).toBe(false);
    expect(canParentAcceptChild("select", "table")).toBe(false);
    expect(canParentAcceptChild("ul", "tr")).toBe(false);
    expect(canParentAcceptChild("select", "td")).toBe(false);
  });

  it("does not weaken UL/OL's li-only rule or Select's option-only rule", () => {
    expect(canParentAcceptChild("ul", "li")).toBe(true);
    expect(canParentAcceptChild("select", "option")).toBe(true);
  });
});

describe("SVG containment (Checkpoint 1.15.5)", () => {
  it("SVG is a leaf — rejects all children (this checkpoint's own explicit 'SVG = leaf' scoping, section 27)", () => {
    expect(canContainChildren("svg")).toBe(false);
  });

  it("is insertable anywhere an ordinary leaf visual element is allowed — Container/Section/Form and every other unrestricted structural container", () => {
    for (const parentTag of ["div", "section", "form", "label", "header", "nav", "main", "article", "aside", "footer"]) {
      expect(canParentAcceptChild(parentTag, "svg"), parentTag).toBe(true);
    }
  });

  it("is rejected inside every constrained-parent allowlist — UL/OL, Select, and Table's structural primitives", () => {
    expect(canParentAcceptChild("ul", "svg")).toBe(false);
    expect(canParentAcceptChild("ol", "svg")).toBe(false);
    expect(canParentAcceptChild("select", "svg")).toBe(false);
    expect(canParentAcceptChild("table", "svg")).toBe(false);
    expect(canParentAcceptChild("thead", "svg")).toBe(false);
    expect(canParentAcceptChild("tbody", "svg")).toBe(false);
    expect(canParentAcceptChild("tfoot", "svg")).toBe(false);
    expect(canParentAcceptChild("tr", "svg")).toBe(false);
  });

  it("rejects SVG as a parent regardless of child tag — SVG is a leaf", () => {
    expect(canParentAcceptChild("svg", "div")).toBe(false);
    expect(canParentAcceptChild("svg", "p")).toBe(false);
  });

  it("does not weaken any prior allowlist — UL/OL's li-only and Select's option-only rules remain intact", () => {
    expect(canParentAcceptChild("ul", "li")).toBe(true);
    expect(canParentAcceptChild("select", "option")).toBe(true);
  });
});
