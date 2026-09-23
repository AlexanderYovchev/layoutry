import { describe, expect, it } from "vitest";
import { createCollapsibleNode } from "./interactionCompositions";

/**
 * Checkpoint 1.15.6.8 — the Collapsible proof composition. Must be an
 * ordinary tree of existing primitives (div/button/p) with exactly ONE
 * generic interaction binding authored on the Button — never a
 * `tag: "collapsible"`, never a `collapsibleOpen`/`componentType` field.
 */

type AnyNode = { id: string; tag: string; children?: AnyNode[]; interactions?: { id: string }[] };

function collectIds(node: AnyNode): string[] {
  return [node.id, ...(node.children ?? []).flatMap(collectIds), ...((node.interactions ?? []).map((i) => i.id))];
}

describe("createCollapsibleNode", () => {
  it("is div (Flex Column) > button, div > p — genuine primitives only", () => {
    const node = createCollapsibleNode();
    expect(node.tag).toBe("div");
    expect(node.flowLayout?.display).toBe("flex");
    const [trigger, content] = node.children!;
    expect(trigger.tag).toBe("button");
    expect(trigger.text).toBe("Toggle Content");
    expect(content.tag).toBe("div");
    expect(content.children![0].tag).toBe("p");
    expect(content.children![0].text).toBe("Collapsible content");
  });

  it("authors exactly one click->toggle interaction on the Button, targeting the content Container's real internal id", () => {
    const node = createCollapsibleNode();
    const [trigger, content] = node.children!;

    expect(trigger.interactions).toHaveLength(1);
    expect(trigger.interactions![0]).toMatchObject({ trigger: "click", action: "toggle", targetId: content.id });
  });

  it("the content Container itself carries no interaction of its own", () => {
    const [, content] = createCollapsibleNode().children!;
    expect(content.interactions).toBeUndefined();
  });

  it("stores no proprietary component tag or state field anywhere", () => {
    const node = createCollapsibleNode() as unknown as Record<string, unknown>;
    expect(node.tag).not.toBe("collapsible");
    expect(node.collapsibleOpen).toBeUndefined();
    expect(node.componentType).toBeUndefined();
    const [trigger, content] = (node as unknown as { children: Record<string, unknown>[] }).children;
    expect(trigger.collapsibleOpen).toBeUndefined();
    expect(content.collapsibleOpen).toBeUndefined();
  });

  it("never uses Free/absolute positioning anywhere in the composition", () => {
    function collectNodes(n: AnyNode & { layoutMode?: string; freeLayout?: unknown; children?: AnyNode[] }): typeof n[] {
      return [n, ...((n.children as typeof n[] | undefined) ?? []).flatMap(collectNodes)];
    }
    for (const n of collectNodes(createCollapsibleNode() as unknown as AnyNode & { layoutMode?: string; freeLayout?: unknown })) {
      expect(n.layoutMode).not.toBe("free");
      expect(n.freeLayout).toBeUndefined();
    }
  });

  it("has no hardcoded HTML id/class anywhere in the composition", () => {
    function collectNodes(n: AnyNode & Record<string, unknown>): (AnyNode & Record<string, unknown>)[] {
      return [n, ...((n.children as (AnyNode & Record<string, unknown>)[] | undefined) ?? []).flatMap(collectNodes)];
    }
    for (const n of collectNodes(createCollapsibleNode() as unknown as AnyNode & Record<string, unknown>)) {
      expect((n as Record<string, unknown>).htmlId).toBeUndefined();
      expect((n as Record<string, unknown>).className).toBeUndefined();
    }
  });

  it("every node and every interaction gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createCollapsibleNode() as unknown as AnyNode);
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createCollapsibleNode() as unknown as AnyNode);
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});
