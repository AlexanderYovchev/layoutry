// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DocumentStyleCompiler,
  printChunks,
  type NodeChunks,
} from "@/features/canvas/styling/documentStyleCompiler";
import { StyleSheetHost } from "@/features/canvas/utils/styleSheetHost";
import type { EditorElementNode } from "@/features/editor/types/document";

/*
 * BC-17.3 — the host's incremental CSSOM edits must always leave the sheet
 * in exactly the canonical order the compiler prints (order key, then
 * node), however the changes arrived.
 */

/** The rule texts of a CSS string, normalized through the engine's own parser. */
function parsedRules(css: string): string[] {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  const rules = Array.from(style.sheet?.cssRules ?? []).map(
    (rule) => rule.cssText,
  );
  style.remove();
  return rules;
}

function installedRules(): string[] {
  const element = document.querySelector<HTMLStyleElement>(
    "style[data-ly-document-styles]",
  );
  return Array.from(element?.sheet?.cssRules ?? []).map((rule) => rule.cssText);
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RULE_KEYS = [0, 2, 3, 8, 28];

function randomChunks(random: () => number, id: string): NodeChunks {
  const chunks = new Map<number, string[]>();
  for (const key of RULE_KEYS) {
    if (random() < 0.5) continue;
    const count = 1 + Math.floor(random() * 2);
    chunks.set(
      key,
      Array.from(
        { length: count },
        (_, n) =>
          `.ly-n-${id}${key > 0 ? `:where([data-k="${key}-${n}"])` : ""} { width: ${Math.floor(random() * 500)}px; }`,
      ),
    );
  }
  return chunks;
}

describe("StyleSheetHost", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    for (const element of document.querySelectorAll("style")) element.remove();
  });

  for (const seed of [1, 2, 3, 4, 5]) {
    it(`seed ${seed}: random per-key replacements, insertions and removals keep the canonical order`, () => {
      const random = mulberry32(seed);
      const host = new StyleSheetHost(document, "design", "s1");
      const model = new Map<string, NodeChunks>();
      const ids = Array.from({ length: 12 }, (_, n) => `n${n}`);
      for (let step = 0; step < 120; step += 1) {
        const id = ids[Math.floor(random() * ids.length)];
        const next = random() < 0.15 ? null : randomChunks(random, id);
        host.apply({ changed: new Map([[id, next]]) });
        if (next) model.set(id, next);
        else model.delete(id);
        expect(installedRules()).toEqual(parsedRules(printChunks(model)));
      }
      host.dispose();
      expect(
        document.querySelectorAll("style[data-ly-document-styles]"),
      ).toHaveLength(0);
    });
  }

  it("rewrites only the order keys whose text changed", () => {
    const host = new StyleSheetHost(document, "design", "s1");
    const document1: EditorElementNode = {
      id: "root",
      tag: "div",
      children: [{ id: "p", tag: "p", text: "x", filters: { opacity: 50 } }],
    };
    const compiler = new DocumentStyleCompiler("design", "s1");
    host.apply(compiler.update(document1));
    const before = host.mutations;
    // The paragraph's base rule changes; its default rule (another key) does not.
    host.apply(
      compiler.update({
        ...document1,
        children: [{ id: "p", tag: "p", text: "x", filters: { opacity: 25 } }],
      }),
    );
    expect(host.mutations - before).toBe(2);
    expect(installedRules().join("\n")).toContain("opacity: 0.25");
  });

  it("counts a rule the engine refuses instead of failing, and owns only what was installed", () => {
    // jsdom parses leniently; a real engine throws on a selector it does not know (e.g. ::-moz-progress-bar in Chromium).
    const insertRule = CSSStyleSheet.prototype.insertRule;
    vi.spyOn(CSSStyleSheet.prototype, "insertRule").mockImplementation(
      function (this: CSSStyleSheet, rule: string, index?: number) {
        if (rule.includes("::-unknown-part"))
          throw new DOMException("unknown selector", "SyntaxError");
        return insertRule.call(this, rule, index);
      },
    );
    const host = new StyleSheetHost(document, "design", "s1");
    host.apply({
      changed: new Map([
        [
          "a",
          new Map([
            [
              1,
              [
                ".ly-n-a { width: 1px; }",
                ".ly-n-a::-unknown-part { width: 2px; }",
              ],
            ],
          ]),
        ],
      ]),
    });
    expect(host.rejected).toBe(1);
    expect(host.ruleCount).toBe(1);
    host.apply({ changed: new Map([["a", null]]) });
    expect(host.ruleCount).toBe(0);
  });
});
