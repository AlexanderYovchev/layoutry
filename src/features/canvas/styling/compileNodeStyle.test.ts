// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  compileNodeStyle,
  type CompileNodeStyleInput,
} from "@/features/canvas/styling/compileNodeStyle";
import {
  printSelector,
  printStyleRule,
  StylePrintError,
} from "@/features/canvas/styling/printStyleRules";
import * as typography from "@/features/canvas/utils/resolveTypographyStyle";
import type { EditorElementNode } from "@/features/editor/types/document";
import { createPaginationNode } from "@/features/editor/factories/navigationCompositions";
import { getPaginationParts } from "@/features/editor/types/pagination";
import type { StyleRule } from "@/features/editor/types/styleRules";

const page: EditorElementNode = { id: "page-root", tag: "page" };

function input(
  node: EditorElementNode,
  extra: Partial<CompileNodeStyleInput> = {},
): CompileNodeStyleInput {
  return {
    node,
    ancestors: [page],
    parentLayoutMode: "flow",
    parentFlowDisplay: "block",
    surface: "preview",
    nodeClass: `ly-n-${node.id}`,
    classFor: (id) => `ly-n-${id}`,
    counterIdentifiers: new Map(),
    includeDefaults: true,
    ...extra,
  };
}

const sheet = (
  node: EditorElementNode,
  extra: Partial<CompileNodeStyleInput> = {},
) =>
  compileNodeStyle(input(node, extra))
    .rules.map((r) => printStyleRule(r))
    .join("\n");
const rule = (extra: Partial<StyleRule>): StyleRule => ({
  id: "r",
  target: "element",
  condition: { self: ["hover"] },
  groups: { background: { color: "#1d4ed8" } },
  ...extra,
});

describe("compileNodeStyle: base styling and defaults", () => {
  it("prints the default presentations at order 0 (:where, zero specificity) and the authored base at order 1", () => {
    const ir = compileNodeStyle(
      input({
        id: "b",
        tag: "button",
        text: "Go",
        background: { color: "#2563eb" },
      }),
    );
    expect(ir.rules.map((r) => [r.bucket, printSelector(r.selector)])).toEqual([
      [0, ":where(.ly-n-b)"],
      [1, ".ly-n-b"],
    ]);
    expect(ir.rules[0].declarations).toContainEqual(["display", "inline-flex"]);
    expect(ir.rules[1].declarations).toContainEqual([
      "background-color",
      "#2563eb",
    ]);
  });

  it("is deterministic: equal input, equal output", () => {
    const node: EditorElementNode = {
      id: "p",
      tag: "p",
      text: "x",
      typography: { color: "#111111" },
      styleRules: [rule({})],
    };
    expect(compileNodeStyle(input(node))).toEqual(
      compileNodeStyle(input(structuredClone(node))),
    );
  });

  it("drops transitions on Design (the motion safety gate) and keeps them for Preview", () => {
    const node: EditorElementNode = {
      id: "b",
      tag: "button",
      transition: {
        property: "opacity",
        durationMs: 200,
        timingFunction: "ease",
        delayMs: 0,
      },
    };
    expect(sheet(node, { surface: "design" })).not.toContain("transition");
    expect(sheet(node, { surface: "preview" })).toContain(
      "transition-duration: 200ms",
    );
    expect(compileNodeStyle(input(node)).hasTransition).toBe(true);
  });

  it("refuses unsafe authored values instead of printing them, with a diagnostic", () => {
    const ir = compileNodeStyle(
      input({
        id: "p",
        tag: "p",
        typography: { color: "red; } body { background: url(x)" },
      }),
    );
    expect(ir.rules.map((r) => printStyleRule(r)).join("")).not.toContain(
      "body",
    );
    expect(ir.diagnostics.map((d) => d.code)).toContain("invalid-css-value");
  });

  it("re-serializes background-image URLs with CSS string escaping, so </style> can't appear", () => {
    const text = sheet({
      id: "d",
      tag: "div",
      background: {
        sourceType: "image",
        image: 'https://x.test/a".png?</style><script>',
      },
    });
    expect(text).toContain(
      'url("https://x.test/a\\".png?\\3c /style>\\3c script>")',
    );
    expect(text).not.toContain("</style>");
  });
});

describe("compileNodeStyle: rules, cascade buckets and selectors", () => {
  it("equalizes specificity with :where() and sorts states into their global buckets", () => {
    const node: EditorElementNode = {
      id: "b",
      tag: "button",
      styleRules: [
        rule({
          id: "d",
          condition: { self: ["disabled"] },
          groups: { background: { color: "#94a3b8" } },
        }),
        rule({ id: "h" }),
        rule({
          id: "f",
          condition: { self: ["focus-visible"] },
          groups: {
            outline: { style: "solid", width: { value: 2, unit: "px" } },
          },
        }),
        rule({
          id: "a",
          condition: { ancestor: { scope: { kind: "parent" }, atom: "hover" } },
          groups: { transform: { scale: 1.1 } },
        }),
      ],
    };
    const ir = compileNodeStyle(
      input(node, { ancestors: [page, { id: "card", tag: "div" }] }),
    );
    expect(ir.rules.map((r) => [r.bucket, printSelector(r.selector)])).toEqual([
      [0, ":where(.ly-n-b)"],
      [14, '.ly-n-b:where(:is(:disabled, [aria-disabled="true"]))'],
      [3, ".ly-n-b:where(:hover)"],
      [6, ".ly-n-b:where(:focus-visible)"],
      [2, ".ly-n-b:where(.ly-n-card:hover *)"],
    ]);
  });

  it("prints a curated compound in the compound bucket, and keeps an uncurated one stored but unprinted", () => {
    const checkbox: EditorElementNode = {
      id: "c",
      tag: "input",
      inputType: "checkbox",
      styleRules: [
        rule({ id: "hc", condition: { self: ["hover", "checked"] } }),
        rule({ id: "cd", condition: { self: ["checked", "disabled"] } }),
      ],
    };
    const printed = compileNodeStyle(input(checkbox)).rules.filter(
      (r) => r.bucket > 1,
    );
    expect(printed.map((r) => [r.bucket, printSelector(r.selector)])).toEqual([
      [12, ".ly-n-c:where(:hover):where(:checked)"],
    ]);
  });

  it("on Design, interaction states are forced-only, and document states also match their forced form", () => {
    const node: EditorElementNode = {
      id: "b",
      tag: "button",
      styleRules: [
        rule({ id: "h" }),
        rule({ id: "d", condition: { self: ["disabled"] } }),
      ],
    };
    const selectors = compileNodeStyle(input(node, { surface: "design" }))
      .rules.slice(1)
      .map((r) => printSelector(r.selector));
    expect(selectors).toEqual([
      '.ly-n-b:where([data-ly-force~="hover"])',
      '.ly-n-b:where(:is(:is(:disabled, [aria-disabled="true"]), [data-ly-force~="disabled"]))',
    ]);
    expect(
      compileNodeStyle(input(node, { surface: "preview" }))
        .rules.map((r) => printStyleRule(r))
        .join(""),
    ).not.toContain("data-ly-force");
  });

  it("prints pseudo-elements, generated content and counters from typed parts only", () => {
    const node: EditorElementNode = {
      id: "h",
      tag: "h2",
      counters: { increment: [{ counter: { kind: "document", id: "steps" } }] },
      styleRules: [
        {
          id: "before",
          target: "before",
          condition: {},
          groups: { typography: { color: "#2563eb" } },
          content: {
            kind: "parts",
            parts: [
              { kind: "text", text: 'Step "1" \\ </style>' },
              {
                kind: "counter",
                counter: { kind: "document", id: "steps" },
                style: { kind: "predefined", style: "upper-roman" },
              },
              {
                kind: "counters",
                counter: { kind: "builtin", name: "list-item" },
                separator: ".",
                style: { kind: "predefined", style: "decimal" },
              },
              { kind: "glyph", glyph: "arrow-right" },
            ],
            altText: "",
          },
        },
      ],
    };
    const text = sheet(node, {
      counterIdentifiers: new Map([["steps", "c-steps"]]),
    });
    expect(text).toContain("counter-increment: c-steps 1;");
    expect(text).toContain(".ly-n-h::before {");
    expect(text).toContain(
      'content: "Step \\"1\\" \\\\ \\3c /style>" counter(c-steps, upper-roman) counters(list-item, ".", decimal) "→" / "";',
    );
    expect(text).not.toContain("</style>");
  });

  it("emits physical declarations before logical ones inside one rule, and keeps both", () => {
    const node: EditorElementNode = {
      id: "p",
      tag: "p",
      spacing: { margin: { left: 4 }, marginLogical: { inlineStart: 12 } },
      typography: { direction: "rtl" },
    };
    const base = compileNodeStyle(input(node))
      .rules.find((r) => r.bucket === 1)!
      .declarations.map(([property]) => property);
    expect(base.indexOf("margin-left")).toBeGreaterThanOrEqual(0);
    expect(base.indexOf("margin-inline-start")).toBeGreaterThan(
      base.indexOf("margin-left"),
    );
    expect(base).toContain("direction");
  });

  it("never prints a Free child's logical insets or size (editor limitation), and keeps its physical geometry", () => {
    const node: EditorElementNode = {
      id: "c",
      tag: "p",
      freeLayout: { x: 1, y: 2, width: 30, height: 40 },
      logicalSize: { inlineSize: { value: 9, unit: "rem" } },
    };
    const text = sheet(node, {
      parentLayoutMode: "free",
      ancestors: [page, { id: "f", tag: "div", layoutMode: "free" }],
    });
    expect(text).toContain("left: 1px;");
    expect(text).not.toContain("inline-size");
  });

  it("scopes Pagination role-group rules to the component's own direct children, before the children's own rules", () => {
    const factory = createPaginationNode();
    const pagination: EditorElementNode = {
      ...factory,
      styleRules: [
        {
          id: "cur",
          target: "pagination.current",
          condition: {},
          groups: { background: { color: "#2563eb" } },
        },
      ],
    };
    const pages = getPaginationParts(pagination).pages.map(
      (page) => `.ly-n-${page.id}`,
    );
    expect(pages.length).toBeGreaterThan(1);
    const ir = compileNodeStyle(input(pagination));
    const roleRule = ir.rules.find((r) => r.tier === 0)!;
    // Direct children only (">"), so a nested component's links are never matched.
    expect(printSelector(roleRule.selector)).toBe(
      `.ly-n-${pagination.id} > :where(:is(${pages.join(", ")})):where([aria-current="page"])`,
    );
  });

  it("keeps inactive rules stored but unprinted (a custom-progress label on a native Progress)", () => {
    const node: EditorElementNode = {
      id: "pr",
      tag: "progress",
      styleRules: [rule({ id: "l", target: "progress.label", condition: {} })],
    };
    expect(
      compileNodeStyle(input(node)).rules.filter((r) => r.bucket > 1),
    ).toEqual([]);
  });

  it("expands native vendor parts into one rule per vendor selector, with appearance: none on the element", () => {
    const node: EditorElementNode = {
      id: "pr",
      tag: "progress",
      styleRules: [rule({ id: "f", target: "progress.fill", condition: {} })],
    };
    expect(
      compileNodeStyle(input(node))
        .rules.filter((r) => r.bucket === 1 && r.selector.pseudoElement)
        .map((r) => printSelector(r.selector)),
    ).toEqual([
      ".ly-n-pr::-webkit-progress-value",
      ".ly-n-pr::-moz-progress-bar",
    ]);
  });
});

describe("printer safety", () => {
  it("refuses class tokens and fragments that could break out of the sheet", () => {
    expect(() => printSelector({ subject: "ly-x{}" })).toThrow(StylePrintError);
    expect(() => printSelector({ subject: "body" })).toThrow(StylePrintError);
    expect(() =>
      printSelector({ subject: "ly-a", conditions: ["</style>"] }),
    ).toThrow(StylePrintError);
    expect(() =>
      printStyleRule({
        bucket: 1,
        tier: 1,
        selector: { subject: "ly-a" },
        declarations: [["color;x", "red"]],
      }),
    ).toThrow(StylePrintError);
  });
});

describe("failure isolation", () => {
  it("keeps a node's committed geometry when another part of its styling throws, and reports it", () => {
    const spy = vi
      .spyOn(typography, "resolveTypographyStyle")
      .mockImplementation(() => {
        throw new Error("boom");
      });
    try {
      const ir = compileNodeStyle(
        input(
          {
            id: "c",
            tag: "p",
            freeLayout: { x: 5, y: 6, width: 30, height: 40 },
          },
          { parentLayoutMode: "free" },
        ),
      );
      expect(ir.diagnostics.map((d) => [d.severity, d.code])).toContainEqual([
        "error",
        "style-compile-failed",
      ]);
      expect(ir.rules.map((r) => printStyleRule(r)).join("")).toContain(
        "left: 5px;",
      );
    } finally {
      spy.mockRestore();
    }
  });
});
