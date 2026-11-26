import { beforeEach, describe, expect, it } from "vitest";
import {
  copiedCounterContext,
  reconcilePastedCounters,
} from "@/features/editor/commands/counterReferenceCommands";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import {
  counterCssIdentifiers,
  type CounterDefinition,
} from "@/features/editor/types/counters";
import type { EditorElementNode } from "@/features/editor/types/document";
import { cloneNodeWithFreshIds } from "@/features/editor/utils/cloneNodeWithFreshIds";
import { checkDocumentIntegrity } from "@/features/project/utils/checkDocumentIntegrity";
import { DEFAULT_PROJECT_LIMITS } from "@/features/project/rules/projectLimits";

const steps: CounterDefinition = { id: "counter-steps", name: "Steps" };
const card = (id: string, counterId = "counter-steps"): EditorElementNode => ({
  id,
  tag: "div",
  counters: { increment: [{ counter: { kind: "document", id: counterId } }] },
  styleRules: [
    {
      id: `rule-${id}`,
      target: "before",
      condition: {},
      groups: {},
      content: {
        kind: "parts",
        parts: [
          { kind: "text", text: "Step " },
          {
            kind: "counter",
            counter: { kind: "document", id: counterId },
            style: { kind: "predefined", style: "decimal" },
          },
        ],
      },
    },
  ],
});
const doc = (
  counters: CounterDefinition[],
  ...children: EditorElementNode[]
): EditorElementNode => ({
  id: "page-root",
  tag: "page",
  children,
  ...(counters.length > 0 ? { styleAssets: { counters } } : {}),
});
const ids = (node: EditorElementNode) => [
  ...(node.counters?.increment ?? []).map((operation) =>
    operation.counter.kind === "document"
      ? operation.counter.id
      : operation.counter.name,
  ),
  ...(node.styleRules ?? []).flatMap((rule) =>
    rule.content?.kind === "parts"
      ? rule.content.parts.flatMap((part) =>
          part.kind === "counter"
            ? [part.counter.kind === "document" ? part.counter.id : ""]
            : [],
        )
      : [],
  ),
];
const valid = (document: EditorElementNode) =>
  expect(checkDocumentIntegrity(document, DEFAULT_PROJECT_LIMITS)).toBeNull();

describe("counterCssIdentifiers (P-4: derived, safe identifiers)", () => {
  it("derives c-<slug> in [a-z0-9-], suffixes collisions, and never prints a reserved keyword or authored character", () => {
    const identifiers = counterCssIdentifiers([
      { id: "a", name: "Steps" },
      { id: "b", name: "steps!" },
      { id: "c", name: "</style><script>" },
      { id: "d", name: "Überschrift 1" },
      { id: "e", name: "日本" },
      { id: "f", name: "none" },
    ]);
    expect([...identifiers.values()]).toEqual([
      "c-steps",
      "c-steps-2",
      "c-style-script",
      "c-uberschrift-1",
      "c-counter",
      "c-none",
    ]);
    for (const identifier of identifiers.values())
      expect(identifier).toMatch(/^c-[a-z0-9-]+$/);
  });
});

describe("reconcilePastedCounters", () => {
  it("same document: keeps ids, so a copied step continues the same sequence", () => {
    const document = doc([steps], card("a"), card("b"));
    expect(
      reconcilePastedCounters(
        document,
        ["b"],
        { sourceDocumentSessionId: 3, counters: [steps] },
        3,
      ),
    ).toBe(document);
  });

  it("same document: recreates a definition deleted since the copy, with its id", () => {
    const document = doc([], card("b"));
    const result = reconcilePastedCounters(
      document,
      ["b"],
      { sourceDocumentSessionId: 3, counters: [steps] },
      3,
    );
    expect(result.styleAssets?.counters).toEqual([steps]);
    expect(ids(result.children![0])).toEqual([
      "counter-steps",
      "counter-steps",
    ]);
    valid(result);
  });

  it("foreign document: maps to the destination counter with the same normalized name", () => {
    const local: CounterDefinition = { id: "counter-local", name: "  STEPS " };
    const document = doc([local], card("b"));
    const result = reconcilePastedCounters(
      document,
      ["b"],
      { sourceDocumentSessionId: 1, counters: [steps] },
      2,
    );
    expect(result.styleAssets?.counters).toEqual([local]);
    expect(ids(result.children![0])).toEqual([
      "counter-local",
      "counter-local",
    ]);
    valid(result);
  });

  it("foreign document: creates a fresh definition when no name matches, and never collides with existing ids", () => {
    const other: CounterDefinition = { id: "counter-steps", name: "Chapters" };
    const document = doc([other], card("b"));
    const result = reconcilePastedCounters(
      document,
      ["b"],
      { sourceDocumentSessionId: 1, counters: [steps] },
      2,
    );
    const created = result.styleAssets?.counters?.[1];
    expect(created?.name).toBe("Steps");
    expect(created?.id).not.toBe("counter-steps");
    expect(ids(result.children![0])).toEqual([created?.id, created?.id]);
    // The unrelated destination sequence is untouched (no accidental merge).
    expect(result.styleAssets?.counters?.[0]).toEqual(other);
    valid(result);
  });

  it("leaves documents without counter references untouched (the same object)", () => {
    const document = doc([], { id: "p", tag: "p" });
    expect(reconcilePastedCounters(document, ["p"], undefined, 0)).toBe(
      document,
    );
  });

  it("collects only the definitions the copied subtrees reference", () => {
    const document = doc([steps, { id: "unused", name: "Unused" }], card("a"));
    expect(copiedCounterContext(document, [document.children![0]], 5)).toEqual({
      sourceDocumentSessionId: 5,
      counters: [steps],
    });
  });
});

describe("cloneNodeWithFreshIds and style rules (BC-17.2)", () => {
  it("gives every cloned rule a fresh id and keeps everything else, including counter references", () => {
    const original: EditorElementNode = {
      id: "outer",
      tag: "div",
      children: [card("a")],
      styleRules: [
        {
          id: "rule-outer",
          target: "element",
          condition: { self: ["hover"] },
          groups: { filters: { opacity: 0.5 } },
        },
      ],
    };
    const clone = cloneNodeWithFreshIds(original);
    const ruleIds = [
      clone.styleRules![0].id,
      clone.children![0].styleRules![0].id,
    ];
    expect(ruleIds).not.toContain("rule-outer");
    expect(ruleIds).not.toContain("rule-a");
    expect(new Set(ruleIds).size).toBe(2);
    expect({ ...clone.styleRules![0], id: "x" }).toEqual({
      ...original.styleRules![0],
      id: "x",
    });
    expect(ids(clone.children![0])).toEqual(["counter-steps", "counter-steps"]);
    valid(doc([steps], original, clone));
  });

  it("leaves nodes without rules without a styleRules field", () => {
    expect(cloneNodeWithFreshIds({ id: "p", tag: "p" })).not.toHaveProperty(
      "styleRules",
    );
  });
});

describe("copy and paste across documents keep counter references valid (store)", () => {
  beforeEach(() => {
    useEditorStore.getState().replaceDocument(doc([steps], card("a")));
  });

  it("same document: duplicate and paste keep one sequence and integrity", () => {
    const store = useEditorStore.getState();
    store.selectOnly("a");
    useEditorStore.getState().copySelection();
    useEditorStore.getState().pasteClipboard();
    useEditorStore.getState().duplicateSelection();
    const document = useEditorStore.getState().document;
    expect(document.styleAssets?.counters).toEqual([steps]);
    valid(document);
    const ruleIds = (document.children ?? []).flatMap((node) =>
      (node.styleRules ?? []).map((rule) => rule.id),
    );
    expect(new Set(ruleIds).size).toBe(ruleIds.length);
  });

  it("another document (a new session token): the paste brings its counter along, so nothing dangles", () => {
    useEditorStore.getState().selectOnly("a");
    useEditorStore.getState().copySelection();
    useEditorStore.getState().replaceDocument(doc([], { id: "p-1", tag: "p" }));
    useEditorStore.getState().pasteClipboard();
    const document = useEditorStore.getState().document;
    expect(
      document.styleAssets?.counters?.map((definition) => definition.name),
    ).toEqual(["Steps"]);
    valid(document);
    // One undo removes the pasted element and the definition it brought.
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.styleAssets).toBeUndefined();
  });

  it("the session document token is never part of the document", () => {
    expect(JSON.stringify(useEditorStore.getState().document)).not.toContain(
      "documentSessionId",
    );
  });
});
