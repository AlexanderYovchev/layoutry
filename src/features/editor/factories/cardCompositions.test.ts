import { describe, expect, it } from "vitest";
import {
  createBasicCardNode,
  createFeatureCardNode,
  createHorizontalCardNode,
  createImageCardNode,
  createPricingCardNode,
  createProfileCardNode,
} from "./cardCompositions";

/**
 * Checkpoint 1.15.6.4 — Components -> Cards & Content. Every factory here
 * must produce ONLY ordinary primitives (div/img/h3/p/a/button/ul/li),
 * never a proprietary component tag (card/cardComponent/profileCard), and
 * never a `cardVariant`/`cardType`-style state field — these tests assert
 * that boundary directly, plus the generic "fresh id everywhere" guarantee
 * every composition factory in this codebase already provides (see
 * navigationCompositions.test.ts, which this mirrors).
 */

type AnyNode = { id: string; tag: string; children?: AnyNode[] };

function collectIds(node: AnyNode): string[] {
  return [node.id, ...(node.children ?? []).flatMap(collectIds)];
}

function collectTags(node: AnyNode): string[] {
  return [node.tag, ...(node.children ?? []).flatMap(collectTags)];
}

describe("Basic Card (Checkpoint 1.15.6.4, Part C)", () => {
  it("is div > h3, p, a — no proprietary node type", () => {
    const node = createBasicCardNode();
    expect(node.tag).toBe("div");
    const tags = node.children?.map((c) => c.tag) ?? [];
    expect(tags).toEqual(["h3", "p", "a"]);
  });

  it("uses ordinary managed Flex Column layout, not Free", () => {
    const node = createBasicCardNode();
    expect(node.layoutMode).not.toBe("free");
    expect(node.flowLayout?.display).toBe("flex");
    expect(node.flowLayout?.flex?.direction).toBe("column");
  });

  it("stores no proprietary variant field on the node at all", () => {
    const node = createBasicCardNode() as unknown as Record<string, unknown>;
    expect(node.cardVariant).toBeUndefined();
    expect(node.cardType).toBeUndefined();
    expect(node.componentVariant).toBeUndefined();
    expect(node.presetType).toBeUndefined();
  });

  it("the heading explicitly authors a smaller font size than HeadingElement's own unconditional default", () => {
    const [heading] = createBasicCardNode().children ?? [];
    expect(heading.typography?.fontSize?.value).toBeLessThan(30);
  });

  it("does not stamp a manual dimensions/resize intent", () => {
    expect(createBasicCardNode().dimensions).toBeUndefined();
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createBasicCardNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createBasicCardNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Image Card (Checkpoint 1.15.6.4, Part D)", () => {
  it("is div > (img, div > h3, p, a) — the nested content-Container structure", () => {
    const node = createImageCardNode();
    expect(node.tag).toBe("div");
    expect(node.children).toHaveLength(2);
    const [image, content] = node.children!;
    expect(image.tag).toBe("img");
    expect(content.tag).toBe("div");
    expect(content.children?.map((c) => c.tag)).toEqual(["h3", "p", "a"]);
  });

  it("the Image uses ordinary aspectRatio/mediaFit fields — same wrapper/native-img ownership every other Image usage has, no special Card rendering path", () => {
    const [image] = createImageCardNode().children!;
    expect(image.aspectRatio).toEqual({ mode: "ratio", width: 16, height: 9 });
    expect(image.mediaFit?.objectFit).toBe("cover");
    expect(image.src).toBeUndefined();
  });

  it("the root clips overflow so the Image's square corners sit inside the root's rounded border", () => {
    const node = createImageCardNode();
    expect(node.display?.overflow).toBe("hidden");
  });

  it("the root's own padding is zero — the nested content Container carries the real padding instead", () => {
    const node = createImageCardNode();
    expect(node.spacing?.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    const [, content] = node.children!;
    expect(content.spacing?.padding.top).toBeGreaterThan(0);
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createImageCardNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createImageCardNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Horizontal Card (Checkpoint 1.15.6.4, Part E)", () => {
  it("is div > (img, div > h3, p, a) rooted in a Flex Row", () => {
    const node = createHorizontalCardNode();
    expect(node.flowLayout?.flex?.direction).toBe("row");
    const [image, content] = node.children!;
    expect(image.tag).toBe("img");
    expect(content.tag).toBe("div");
  });

  it("gives the Image a fixed-width flex-basis column via ordinary FlexChildSettings, not a stamped dimensions/manual resize", () => {
    const [image] = createHorizontalCardNode().children!;
    expect(image.flexChild).toEqual({ grow: 0, shrink: 0, basis: 160, alignSelf: "center" });
    expect(image.dimensions).toBeUndefined();
  });

  it("the content Container grows to fill the remaining row width", () => {
    const [, content] = createHorizontalCardNode().children!;
    expect(content.flexChild?.grow).toBe(1);
  });

  it("the Image gets a 1:1 aspect ratio so ImageElement's own unconditional height chrome gets out of the way", () => {
    const [image] = createHorizontalCardNode().children!;
    expect(image.aspectRatio).toEqual({ mode: "ratio", width: 1, height: 1 });
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createHorizontalCardNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createHorizontalCardNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Profile Card (Checkpoint 1.15.6.4, Part F)", () => {
  it("is div > img, h3, p, a — no Avatar/ProfileImage/User primitive", () => {
    const node = createProfileCardNode();
    const tags = node.children?.map((c) => c.tag) ?? [];
    expect(tags).toEqual(["img", "h3", "p", "a"]);
  });

  it("the avatar's circular look comes from ordinary Border Radius + aspect ratio on the existing Image node, not a special rendering path", () => {
    const [avatar] = createProfileCardNode().children!;
    expect(avatar.borderRadius?.topLeft).toEqual({ value: 50, unit: "%" });
    expect(avatar.aspectRatio).toEqual({ mode: "ratio", width: 1, height: 1 });
  });

  it("stores no user/profile/avatar-url data model anywhere on the node", () => {
    const [avatar] = createProfileCardNode().children! as unknown as Record<string, unknown>[];
    expect(avatar.avatarUrl).toBeUndefined();
    expect(avatar.userId).toBeUndefined();
    const node = createProfileCardNode() as unknown as Record<string, unknown>;
    expect(node.profile).toBeUndefined();
    expect(node.user).toBeUndefined();
  });

  it("uses authored placeholder content, not fake real-person data", () => {
    const [, name, role] = createProfileCardNode().children!;
    expect(typeof name.text).toBe("string");
    expect(typeof role.text).toBe("string");
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createProfileCardNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createProfileCardNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Feature Card (Checkpoint 1.15.6.4, Part G)", () => {
  it("is div > h3, p only — no fake authored Icon/SVG", () => {
    const node = createFeatureCardNode();
    const tags = node.children?.map((c) => c.tag) ?? [];
    expect(tags).toEqual(["h3", "p"]);
    expect(tags).not.toContain("svg");
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createFeatureCardNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createFeatureCardNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Pricing Card (Checkpoint 1.15.6.4, Part H)", () => {
  it("is div > h3, h3, p, ul > li x3, button — genuine list semantics for the feature list", () => {
    const node = createPricingCardNode();
    const tags = node.children?.map((c) => c.tag) ?? [];
    expect(tags).toEqual(["h3", "h3", "p", "ul", "button"]);
    const [, , , list] = node.children!;
    expect(list.children?.map((c) => c.tag)).toEqual(["li", "li", "li"]);
  });

  it("the CTA reuses the Primary Button preset's own authored style fields — an in-place action, not a Link", () => {
    const [, , , , cta] = createPricingCardNode().children!;
    expect(cta.tag).toBe("button");
    expect(cta.text).toBe("Choose Plan");
    expect(cta.background?.color).toBeDefined();
  });

  it("stores no pricing-specific state field anywhere on the node", () => {
    const node = createPricingCardNode() as unknown as Record<string, unknown>;
    expect(node.price).toBeUndefined();
    expect(node.currency).toBeUndefined();
    expect(node.billingPeriod).toBeUndefined();
    expect(node.features).toBeUndefined();
    expect(node.recommended).toBeUndefined();
    expect(node.pricingPlan).toBeUndefined();
  });

  it("the plan name and price are both plain h3 text nodes, differing only in authored typography", () => {
    const [planName, price] = createPricingCardNode().children!;
    expect(planName.tag).toBe("h3");
    expect(price.tag).toBe("h3");
    expect(price.typography?.fontSize?.value).toBeGreaterThan(planName.typography?.fontSize?.value ?? 0);
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createPricingCardNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createPricingCardNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Every Card composition (Checkpoint 1.15.6.4, general)", () => {
  const factories = [
    ["Basic Card", createBasicCardNode],
    ["Image Card", createImageCardNode],
    ["Horizontal Card", createHorizontalCardNode],
    ["Profile Card", createProfileCardNode],
    ["Feature Card", createFeatureCardNode],
    ["Pricing Card", createPricingCardNode],
  ] as const;

  it.each(factories)("%s roots with an ordinary <div>, never Free/absolute positioning anywhere in the composition", (_label, factory) => {
    const node = factory();
    expect(node.tag).toBe("div");
    expect(node.layoutMode).not.toBe("free");
    expect(node.freeLayout).toBeUndefined();
    for (const child of node.children ?? []) {
      expect(child.layoutMode).not.toBe("free");
      expect(child.freeLayout).toBeUndefined();
    }
  });

  it.each(factories)("%s only ever uses genuine existing HTML primitives", (_label, factory) => {
    const tags = new Set(collectTags(factory()));
    for (const tag of tags) {
      expect(["div", "img", "h3", "p", "a", "button", "ul", "li"]).toContain(tag);
    }
  });

  it.each(factories)("%s has no hardcoded HTML id/class anywhere in the composition", (_label, factory) => {
    function collectNodes(node: AnyNode & Record<string, unknown>): AnyNode[] {
      return [node, ...((node.children as (AnyNode & Record<string, unknown>)[] | undefined) ?? []).flatMap(collectNodes)];
    }
    for (const node of collectNodes(factory() as unknown as AnyNode & Record<string, unknown>)) {
      expect((node as Record<string, unknown>).htmlId).toBeUndefined();
      expect((node as Record<string, unknown>).className).toBeUndefined();
    }
  });
});
