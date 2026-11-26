import { describe, expect, it } from "vitest";
import {
  computeInactiveStyling,
  resolveAncestorScope,
} from "@/features/editor/rules/inactiveStyling";
import {
  evaluateContextCapability,
  vectorObjectSelfAtomApplicability,
} from "@/features/editor/rules/stylingContextPredicates";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { StyleRule } from "@/features/editor/types/styleRules";

const page: EditorElementNode = { id: "page-root", tag: "page" };
const flowParent: EditorElementNode = { id: "div-flow", tag: "div" };
const flexParent: EditorElementNode = {
  id: "div-flex",
  tag: "div",
  flowLayout: { display: "flex" },
};
const gridParent: EditorElementNode = {
  id: "div-grid",
  tag: "div",
  flowLayout: { display: "grid" },
};
const freeParent: EditorElementNode = {
  id: "div-free",
  tag: "div",
  layoutMode: "free",
};

const rule = (extra: Partial<StyleRule>): StyleRule => ({
  id: "r",
  target: "element",
  condition: { self: ["hover"] },
  groups: { background: { color: "#000000" } },
  ...extra,
});

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe("context predicates (BC-17.1.3 §5.6)", () => {
  const p: EditorElementNode = { id: "p", tag: "p" };

  it("float and clear apply in normal flow and are inapplicable in Flex, Grid, Free and out-of-flow contexts", () => {
    expect(evaluateContextCapability("float", p, flowParent).status).toBe(
      "applicable",
    );
    expect(evaluateContextCapability("clear", p, flowParent).status).toBe(
      "applicable",
    );
    for (const parent of [flexParent, gridParent, freeParent])
      expect(evaluateContextCapability("float", p, parent).status).toBe(
        "inapplicable",
      );
    expect(
      evaluateContextCapability(
        "float",
        { ...p, position: { position: "absolute" } },
        flowParent,
      ).status,
    ).toBe("inapplicable");
    expect(
      evaluateContextCapability(
        "float",
        { ...p, position: { position: "relative" } },
        flowParent,
      ).status,
    ).toBe("applicable");
  });

  it("shape-outside needs a float", () => {
    expect(evaluateContextCapability("shapeOutside", p, flowParent)).toEqual({
      status: "inapplicable",
      reason: "Needs a float.",
    });
    expect(
      evaluateContextCapability("shapeOutside", p, flowParent, {
        float: "inline-start",
      }).status,
    ).toBe("applicable");
    expect(
      evaluateContextCapability("shapeOutside", p, flexParent, {
        float: "left",
      }).status,
    ).toBe("inapplicable");
  });

  it("insets and logical sizes on Free children are an editor limitation, not a CSS fact", () => {
    for (const capability of [
      "physicalInsets",
      "logicalInsets",
      "logicalSize",
    ] as const) {
      expect(evaluateContextCapability(capability, p, freeParent).status).toBe(
        "limitation",
      );
      expect(evaluateContextCapability(capability, p, flowParent).status).toBe(
        "applicable",
      );
    }
  });

  it("first-line and first-letter need a block container", () => {
    expect(evaluateContextCapability("firstLine", p, flowParent).status).toBe(
      "applicable",
    );
    expect(
      evaluateContextCapability(
        "firstLetter",
        { id: "d", tag: "div", flowLayout: { display: "flex" } },
        flowParent,
      ).status,
    ).toBe("inapplicable");
    expect(
      evaluateContextCapability(
        "firstLine",
        { ...p, display: { display: "inline" } },
        flowParent,
      ).status,
    ).toBe("inapplicable");
  });

  it("vector objects never have their own focus states", () => {
    expect(vectorObjectSelfAtomApplicability("focus-visible").status).toBe(
      "inapplicable",
    );
    expect(vectorObjectSelfAtomApplicability("hover").status).toBe(
      "applicable",
    );
  });
});

describe("computeInactiveStyling", () => {
  it("keeps a custom Progress part inactive on the native variant, and active again after switching back, without changing data", () => {
    const label = rule({
      id: "label",
      target: "progress.label",
      condition: {},
      groups: { typography: { color: "#111111" } },
    });
    const native = deepFreeze<EditorElementNode>({
      id: "pr",
      tag: "progress",
      styleRules: [
        label,
        rule({ id: "fill", target: "progress.fill", condition: {} }),
      ],
    });
    expect(computeInactiveStyling(native, [page]).rules).toEqual([
      {
        ruleId: "label",
        reason: "target-other-variant",
        message: expect.stringContaining("other variant"),
      },
    ]);
    expect(
      computeInactiveStyling({ ...native, progressVariant: "custom" }, [page])
        .rules,
    ).toEqual([]);
  });

  it("marks states the profile lacks and uncurated compounds, but not curated ones", () => {
    const paragraph: EditorElementNode = {
      id: "p",
      tag: "p",
      styleRules: [rule({ id: "checked", condition: { self: ["checked"] } })],
    };
    expect(computeInactiveStyling(paragraph, [page]).rules[0]?.reason).toBe(
      "state-not-applicable",
    );
    const checkbox = (
      self: StyleRule["condition"]["self"],
    ): EditorElementNode => ({
      id: "c",
      tag: "input",
      inputType: "checkbox",
      styleRules: [rule({ id: "x", condition: { self } })],
    });
    expect(
      computeInactiveStyling(checkbox(["hover", "checked"]), [page]).rules,
    ).toEqual([]);
    expect(
      computeInactiveStyling(checkbox(["checked", "disabled"]), [page]).rules[0]
        ?.reason,
    ).toBe("compound-not-curated");
  });

  it("resolves ancestor scopes against the current tree", () => {
    const parentHover = rule({
      id: "a",
      condition: { ancestor: { scope: { kind: "parent" }, atom: "hover" } },
    });
    const icon: EditorElementNode = {
      id: "img",
      tag: "img",
      styleRules: [parentHover],
    };
    expect(computeInactiveStyling(icon, [page, flowParent]).rules).toEqual([]);
    // At the top level there is no styleable parent: the rule is kept but inactive.
    expect(computeInactiveStyling(icon, [page]).rules[0]?.reason).toBe(
      "ancestor-unresolved",
    );
    // A paragraph can't be "expanded", so a parent(expanded) rule under it is inactive.
    const expanded = {
      ...icon,
      styleRules: [
        rule({
          id: "e",
          condition: {
            ancestor: { scope: { kind: "parent" }, atom: "expanded" },
          },
        }),
      ],
    };
    expect(
      computeInactiveStyling(expanded, [page, { id: "p", tag: "p" }]).rules[0]
        ?.reason,
    ).toBe("ancestor-state-not-applicable");
    expect(
      computeInactiveStyling(expanded, [page, { id: "b", tag: "button" }])
        .rules,
    ).toEqual([]);
    expect(
      resolveAncestorScope({ kind: "component" }, [
        page,
        { id: "form", tag: "form" },
        flowParent,
      ])?.id,
    ).toBe("form");
    expect(
      resolveAncestorScope({ kind: "profile", profile: "list" }, [
        page,
        { id: "ul", tag: "ul" },
        { id: "li", tag: "li" },
      ])?.id,
    ).toBe("ul");
  });

  it("marks groups and fields a pseudo-element can't take", () => {
    const input: EditorElementNode = {
      id: "i",
      tag: "input",
      styleRules: [
        rule({
          id: "ph",
          target: "placeholder",
          condition: {},
          groups: {
            border: { top: { style: "solid" } },
            typography: { color: "#999999", textAlign: "center" },
          },
        }),
      ],
    };
    const { rules, fields } = computeInactiveStyling(input, [page]);
    expect(rules).toEqual([]);
    expect(
      fields.map((field) => [field.group, field.field ?? null, field.reason]),
    ).toEqual([
      ["typography", "textAlign", "field-not-applicable"],
      ["border", null, "group-not-applicable"],
    ]);
  });

  it("marks first-line on a Flexbox container as inactive by context", () => {
    const flex: EditorElementNode = {
      id: "d",
      tag: "div",
      flowLayout: { display: "flex" },
      styleRules: [
        rule({
          id: "fl",
          target: "first-line",
          condition: {},
          groups: { typography: { color: "#000000" } },
        }),
      ],
    };
    expect(computeInactiveStyling(flex, [page]).rules[0]?.reason).toBe(
      "target-context",
    );
  });

  it("marks direction, writing mode and counters in a non-default state as editor limitations", () => {
    const p: EditorElementNode = {
      id: "p",
      tag: "p",
      styleRules: [
        rule({
          id: "h",
          groups: {
            typography: {
              color: "#000000",
              direction: "rtl",
              writingMode: "vertical-rl",
            },
            counters: {
              increment: [{ counter: { kind: "builtin", name: "list-item" } }],
            },
          },
        }),
      ],
    };
    expect(
      computeInactiveStyling(p, [page]).fields.map((field) => [
        field.group,
        field.field ?? null,
        field.reason,
      ]),
    ).toEqual([
      ["typography", "direction", "context-limitation"],
      ["typography", "writingMode", "context-limitation"],
      ["counters", null, "context-limitation"],
    ]);
  });

  it("marks a Free child's logical size and logical insets (base and rules) as a limitation, and leaves physical geometry alone", () => {
    const child = deepFreeze<EditorElementNode>({
      id: "p",
      tag: "p",
      freeLayout: { x: 1, y: 2, width: 30, height: 40 },
      logicalSize: { inlineSize: { value: 10, unit: "rem" } },
      position: {
        position: "relative",
        insetLogical: { inlineStart: "auto" },
        top: { value: 1, unit: "px" },
      },
    });
    const free = computeInactiveStyling(child, [page, freeParent]);
    expect(
      free.fields.map((field) => [
        field.source.kind,
        field.group,
        field.field ?? null,
        field.reason,
      ]),
    ).toEqual([
      ["base", "position", "insetLogical", "context-limitation"],
      ["base", "logicalSize", null, "context-limitation"],
    ]);
    expect(computeInactiveStyling(child, [page, flowParent]).fields).toEqual(
      [],
    );
  });

  it("is deterministic and never mutates the document (inputs are frozen)", () => {
    const node = deepFreeze<EditorElementNode>({
      id: "p",
      tag: "p",
      styleRules: [rule({ id: "x", target: "marker", condition: {} })],
    });
    const first = computeInactiveStyling(node, [page]);
    expect(computeInactiveStyling(node, [page])).toEqual(first);
    expect(first.rules[0]?.reason).toBe("target-not-applicable");
  });
});
