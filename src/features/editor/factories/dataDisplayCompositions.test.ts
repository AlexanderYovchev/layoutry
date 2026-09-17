import { describe, expect, it } from "vitest";
import {
  createAvatarNode,
  createAvatarWithTextNode,
  createBadgeNode,
  createMetadataRowNode,
  createStatCardNode,
} from "./dataDisplayCompositions";

/**
 * Checkpoint 1.15.6.6 — Components -> Data Display. Every factory here
 * must produce ONLY ordinary primitives (div/img/p), never a proprietary
 * component tag (badge/avatar/statCard/metadataRow), and never a
 * `badgeVariant`/`statType`/`displayVariant`-style state field — these
 * tests assert that boundary directly, plus the generic "fresh id
 * everywhere" guarantee every composition factory in this codebase
 * already provides.
 */

type AnyNode = { id: string; tag: string; children?: AnyNode[] };

function collectIds(node: AnyNode): string[] {
  return [node.id, ...(node.children ?? []).flatMap(collectIds)];
}

function collectTags(node: AnyNode): string[] {
  return [node.tag, ...(node.children ?? []).flatMap(collectTags)];
}

describe("Badge (Checkpoint 1.15.6.6, Part C)", () => {
  it("is a genuine div > p, not a synthetic badge tag", () => {
    const node = createBadgeNode();
    expect(node.tag).toBe("div");
    expect(node.children).toHaveLength(1);
    expect(node.children![0].tag).toBe("p");
    expect(node.children![0].text).toBe("Badge");
  });

  it("uses managed Flex layout, never Free", () => {
    const node = createBadgeNode();
    expect(node.layoutMode).not.toBe("free");
    expect(node.flowLayout?.display).toBe("flex");
  });

  it("uses a pill radius via the existing generic Border Radius system, not a shape field", () => {
    const node = createBadgeNode() as unknown as Record<string, unknown>;
    expect(node.borderRadius).toEqual({
      topLeft: { value: 9999, unit: "px" },
      topRight: { value: 9999, unit: "px" },
      bottomRight: { value: 9999, unit: "px" },
      bottomLeft: { value: 9999, unit: "px" },
    });
    expect(node.pill).toBeUndefined();
    expect(node.shape).toBeUndefined();
  });

  it("stores no proprietary variant/state field on the node at all", () => {
    const node = createBadgeNode() as unknown as Record<string, unknown>;
    expect(node.badgeVariant).toBeUndefined();
    expect(node.badgeType).toBeUndefined();
    expect(node.componentType).toBeUndefined();
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createBadgeNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createBadgeNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Avatar (Checkpoint 1.15.6.6, Part D)", () => {
  it("is a single, genuine Image node — no wrapper, no synthetic avatar tag", () => {
    const node = createAvatarNode();
    expect(node.tag).toBe("img");
    expect(node.children).toBeUndefined();
  });

  it("configures a square aspect ratio, cover object-fit, and circular radius via existing generic fields", () => {
    const node = createAvatarNode();
    expect(node.aspectRatio).toEqual({ mode: "ratio", width: 1, height: 1 });
    expect(node.mediaFit).toEqual({ objectFit: "cover" });
    expect(node.borderRadius).toEqual({
      topLeft: { value: 50, unit: "%" },
      topRight: { value: 50, unit: "%" },
      bottomRight: { value: 50, unit: "%" },
      bottomLeft: { value: 50, unit: "%" },
    });
  });

  it("stores no avatar-specific field anywhere on the node", () => {
    const node = createAvatarNode() as unknown as Record<string, unknown>;
    expect(node.avatarSrc).toBeUndefined();
    expect(node.avatarSize).toBeUndefined();
    expect(node.avatarShape).toBeUndefined();
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createAvatarNode() as unknown as AnyNode);
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createAvatarNode() as unknown as AnyNode);
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Avatar with Text (Checkpoint 1.15.6.6, Part E)", () => {
  it("is div (Flex Row) > img, div (Flex Column) > p, p", () => {
    const node = createAvatarWithTextNode();
    expect(node.tag).toBe("div");
    expect(node.flowLayout?.flex?.direction).toBe("row");
    const [avatar, textGroup] = node.children!;
    expect(avatar.tag).toBe("img");
    expect(textGroup.tag).toBe("div");
    expect(textGroup.flowLayout?.flex?.direction).toBe("column");
    const [name, subtitle] = textGroup.children!;
    expect(name.tag).toBe("p");
    expect(name.text).toBe("Alex Morgan");
    expect(subtitle.tag).toBe("p");
    expect(subtitle.text).toBe("Product Designer");
  });

  it("the avatar Image uses a fixed-size flex column, the text group grows — the same FlexChildSettings mechanism Horizontal Card already used", () => {
    const [avatar, textGroup] = createAvatarWithTextNode().children!;
    expect(avatar.flexChild).toEqual({ grow: 0, shrink: 0, basis: 44, alignSelf: "center" });
    expect(textGroup.flexChild).toEqual({ grow: 1, shrink: 1, basis: "auto", alignSelf: "stretch" });
  });

  it("stores no user/profile data model anywhere on any node", () => {
    const node = createAvatarWithTextNode() as unknown as Record<string, unknown>;
    function collectNodes(n: AnyNode & Record<string, unknown>): (AnyNode & Record<string, unknown>)[] {
      return [n, ...((n.children as (AnyNode & Record<string, unknown>)[] | undefined) ?? []).flatMap(collectNodes)];
    }
    for (const n of collectNodes(node as unknown as AnyNode & Record<string, unknown>)) {
      expect(n.user).toBeUndefined();
      expect(n.profile).toBeUndefined();
      expect(n.username).toBeUndefined();
      expect(n.role).toBeUndefined();
      expect(n.avatarUrl).toBeUndefined();
      expect(n.userId).toBeUndefined();
    }
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createAvatarWithTextNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createAvatarWithTextNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Stat Card (Checkpoint 1.15.6.6, Part F)", () => {
  it("is div > p, p, p — the value stays a Paragraph, never a Heading", () => {
    const node = createStatCardNode();
    expect(node.tag).toBe("div");
    const tags = node.children?.map((c) => c.tag) ?? [];
    expect(tags).toEqual(["p", "p", "p"]);
    const [label, value, supporting] = node.children!;
    expect(label.text).toBe("Total Visitors");
    expect(value.text).toBe("12,450");
    expect(supporting.text).toBe("+8.2% from last month");
  });

  it("emphasis comes from authored typography, not semantic heading level", () => {
    const [label, value] = createStatCardNode().children!;
    expect(value.typography?.fontSize?.value).toBeGreaterThan(label.typography?.fontSize?.value ?? 0);
    expect(value.typography?.fontWeight).toBe(700);
  });

  it("the supporting trend text uses a neutral authored color, not a success/error color", () => {
    const [, , supporting] = createStatCardNode().children!;
    expect(supporting.typography?.color).toBe("#71717a");
  });

  it("stores no stat/trend/status state field anywhere on any node", () => {
    const node = createStatCardNode() as unknown as Record<string, unknown>;
    function collectNodes(n: AnyNode & Record<string, unknown>): (AnyNode & Record<string, unknown>)[] {
      return [n, ...((n.children as (AnyNode & Record<string, unknown>)[] | undefined) ?? []).flatMap(collectNodes)];
    }
    for (const n of collectNodes(node as unknown as AnyNode & Record<string, unknown>)) {
      expect(n.statValue).toBeUndefined();
      expect(n.statTrend).toBeUndefined();
      expect(n.statLabel).toBeUndefined();
      expect(n.trend).toBeUndefined();
      expect(n.status).toBeUndefined();
    }
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createStatCardNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createStatCardNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Metadata Row (Checkpoint 1.15.6.6, Part I)", () => {
  it("is div (Flex Row, space-between) > p, p", () => {
    const node = createMetadataRowNode();
    expect(node.tag).toBe("div");
    expect(node.flowLayout?.flex?.justifyContent).toBe("space-between");
    const [key, value] = node.children!;
    expect(key.tag).toBe("p");
    expect(key.text).toBe("Status");
    expect(value.tag).toBe("p");
    expect(value.text).toBe("Active");
  });

  it("stores no key/value/metadata field anywhere on any node", () => {
    const node = createMetadataRowNode() as unknown as Record<string, unknown>;
    function collectNodes(n: AnyNode & Record<string, unknown>): (AnyNode & Record<string, unknown>)[] {
      return [n, ...((n.children as (AnyNode & Record<string, unknown>)[] | undefined) ?? []).flatMap(collectNodes)];
    }
    for (const n of collectNodes(node as unknown as AnyNode & Record<string, unknown>)) {
      expect(n.key).toBeUndefined();
      expect(n.value).toBeUndefined();
      expect(n.metadata).toBeUndefined();
      expect(n.field).toBeUndefined();
      expect(n.property).toBeUndefined();
    }
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createMetadataRowNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createMetadataRowNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Every Data Display composition (Checkpoint 1.15.6.6, general)", () => {
  const factories = [
    ["Badge", createBadgeNode],
    ["Avatar", createAvatarNode],
    ["Avatar with Text", createAvatarWithTextNode],
    ["Stat Card", createStatCardNode],
    ["Metadata Row", createMetadataRowNode],
  ] as const;

  it.each(factories)("%s never uses Free/absolute positioning anywhere in the composition", (_label, factory) => {
    function collectNodes(n: AnyNode): AnyNode[] {
      return [n, ...(n.children ?? []).flatMap(collectNodes)];
    }
    for (const n of collectNodes(factory() as unknown as AnyNode)) {
      expect((n as unknown as { layoutMode?: string }).layoutMode).not.toBe("free");
      expect((n as unknown as { freeLayout?: unknown }).freeLayout).toBeUndefined();
    }
  });

  it.each(factories)("%s only ever uses genuine existing HTML primitives", (_label, factory) => {
    const tags = new Set(collectTags(factory() as unknown as AnyNode));
    for (const tag of tags) {
      expect(["div", "img", "p"]).toContain(tag);
    }
  });

  it.each(factories)("%s has no hardcoded HTML id/class anywhere in the composition", (_label, factory) => {
    function collectNodes(n: AnyNode & Record<string, unknown>): AnyNode[] {
      return [n, ...((n.children as (AnyNode & Record<string, unknown>)[] | undefined) ?? []).flatMap(collectNodes)];
    }
    for (const n of collectNodes(factory() as unknown as AnyNode & Record<string, unknown>)) {
      expect((n as Record<string, unknown>).htmlId).toBeUndefined();
      expect((n as Record<string, unknown>).className).toBeUndefined();
    }
  });
});
