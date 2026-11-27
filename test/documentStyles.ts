import { DocumentStyleCompiler } from "@/features/canvas/styling/documentStyleCompiler";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { FlowDisplayMode } from "@/features/editor/types/flowLayout";
import type { ContainerLayoutMode } from "@/features/editor/types/layout";

/*
 * BC-17.3 — component tests render a Canvas element straight from a `node`
 * prop, outside DocumentCanvas, so no generated document stylesheet is
 * installed for them. This installs the REAL one (the same
 * DocumentStyleCompiler the Canvas uses) for that node's subtree, in the
 * same parent context the test renders it in, so a test can keep asserting
 * what the element actually computes (getComputedStyle — jsdom cascades
 * stylesheet rules, specificity, :where() and inline style).
 *
 * Call it again after a rerender with a changed node; it replaces that
 * node's previous sheet. test/setup.ts removes them after every test.
 */

const MARKER = "data-test-document-styles";
const PARENT_ID = "__ly-test-parent";

export interface DocumentStylesContext {
  parentLayoutMode?: ContainerLayoutMode;
  parentFlowDisplay?: FlowDisplayMode;
  /** Defaults to the store's current mode. */
  surface?: "design" | "preview";
}

export function installDocumentStyles(
  node: EditorElementNode,
  context: DocumentStylesContext = {},
): void {
  const { parentLayoutMode = "flow", parentFlowDisplay = "block" } = context;
  const surface =
    context.surface ??
    (useEditorStore.getState().editorMode === "preview" ? "preview" : "design");
  // The node is compiled as the only child of a synthetic parent that
  // gives it exactly the context the test renders it in.
  const parent: EditorElementNode =
    parentLayoutMode === "free"
      ? { id: PARENT_ID, tag: "div", layoutMode: "free", children: [node] }
      : {
          id: PARENT_ID,
          tag: "div",
          flowLayout: { display: parentFlowDisplay },
          children: [node],
        };
  const compiler = new DocumentStyleCompiler(surface);
  compiler.update(parent);
  // Replace this node's previous sheet; other nodes' sheets in the same test stay.
  for (const element of document.querySelectorAll(`style[${MARKER}]`))
    if (element.getAttribute("data-test-root") === node.id) element.remove();
  const style = document.createElement("style");
  style.setAttribute(MARKER, surface);
  style.setAttribute("data-test-root", node.id);
  style.textContent = compiler.printSheet();
  document.head.appendChild(style);
}

// A test sheet never changes after installDocumentStyles (a reinstall makes a
// new element), so its rules and their selector text are read once: jsdom
// re-serializes selectorText on every access, which dominated the cost.
const parsedRules = new WeakMap<
  HTMLStyleElement,
  { selectorText: string; style: CSSStyleDeclaration }[]
>();

function styleRulesOf(
  element: HTMLStyleElement,
): { selectorText: string; style: CSSStyleDeclaration }[] {
  let rules = parsedRules.get(element);
  if (!rules) {
    rules = Array.from(element.sheet?.cssRules ?? [])
      .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
      .map((rule) => ({ selectorText: rule.selectorText, style: rule.style }));
    parsedRules.set(element, rules);
  }
  return rules;
}

/**
 * What Layoutry itself declares for an element: the matching generated
 * rules (installDocumentStyles) in sheet order, then its inline style (a
 * live gesture override) — without UA defaults or initial values, which
 * getComputedStyle includes. Sheet order is the cascade order for the
 * generated rules: they are specificity-equalized (:where) and printed by
 * order key, so the last matching declaration wins. @media rules are
 * skipped (jsdom has no viewport).
 */
export function generatedStyleOf(
  element: HTMLElement | SVGElement,
): CSSStyleDeclaration {
  const style = document.createElement("div").style;
  // Every generated rule names its subject's own generated class, so only
  // rules mentioning one of the element's ly- classes can match (a cheap
  // pre-filter before the costly selector match).
  const classes = Array.from(element.classList).filter((token) =>
    token.startsWith("ly-"),
  );
  for (const sheetElement of document.querySelectorAll<HTMLStyleElement>(
    `style[${MARKER}]`,
  )) {
    for (const rule of styleRulesOf(sheetElement)) {
      if (
        !classes.some((token) => rule.selectorText.includes(`.${token}`)) ||
        !element.matches(rule.selectorText)
      )
        continue;
      for (const name of Array.from(rule.style))
        style.setProperty(
          name,
          rule.style.getPropertyValue(name),
          rule.style.getPropertyPriority(name),
        );
    }
  }
  for (const name of Array.from(element.style))
    style.setProperty(
      name,
      element.style.getPropertyValue(name),
      element.style.getPropertyPriority(name),
    );
  return style;
}

export function removeDocumentStyles(): void {
  for (const element of document.querySelectorAll(`style[${MARKER}]`))
    element.remove();
}
