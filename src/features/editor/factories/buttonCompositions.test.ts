import { describe, expect, it } from "vitest";
import {
  createButtonGroupNode,
  createDropdownButtonNode,
  createGhostButtonNode,
  createOutlineButtonNode,
  createPrimaryButtonNode,
  createSecondaryButtonNode,
} from "./buttonCompositions";

/**
 * Checkpoint 1.15.6.2 — Components -> Buttons. Every factory here must
 * produce ONLY ordinary primitives (button/div/a), never a proprietary
 * component tag, and never a `buttonVariant`-style state field — these
 * tests assert that boundary directly, plus the generic "fresh id
 * everywhere" and "one composition = no shared mutable structure between
 * two separate calls" guarantees every composition factory in this
 * codebase already provides (see elementFactories.test.ts's own
 * createFooterCompositionNode suite, which this mirrors).
 */
describe("Button presets — Primary/Secondary/Outline/Ghost (Checkpoint 1.15.6.2)", () => {
  const presetFactories = [
    ["Primary", createPrimaryButtonNode],
    ["Secondary", createSecondaryButtonNode],
    ["Outline", createOutlineButtonNode],
    ["Ghost", createGhostButtonNode],
  ] as const;

  it.each(presetFactories)("%s Button is a genuine <button> primitive — same tag as HTML -> Button, no new node type", (_label, factory) => {
    const node = factory();
    expect(node.tag).toBe("button");
    expect(typeof node.text).toBe("string");
    expect(node.children).toBeUndefined();
  });

  it.each(presetFactories)("%s Button stores no proprietary variant field on the node at all", (_label, factory) => {
    const node = factory() as unknown as Record<string, unknown>;
    expect(node.buttonVariant).toBeUndefined();
    expect(node.variant).toBeUndefined();
    expect(node.preset).toBeUndefined();
  });

  it.each(presetFactories)("%s Button authors real, inspectable style fields rather than relying on invisible fallback chrome", (_label, factory) => {
    const node = factory();
    expect(node.background?.color).toBeDefined();
    expect(node.typography?.color).toBeDefined();
    expect(node.borderRadius).toBeDefined();
    expect(node.spacing).toBeDefined();
  });

  it("Outline Button is the only preset with an explicit border", () => {
    expect(createOutlineButtonNode().border).toBeDefined();
    expect(createPrimaryButtonNode().border).toBeUndefined();
    expect(createSecondaryButtonNode().border).toBeUndefined();
    expect(createGhostButtonNode().border).toBeUndefined();
  });

  it("Outline and Ghost both use a transparent background (so the unconditional dark chrome class underneath is actually overridden)", () => {
    expect(createOutlineButtonNode().background?.color).toBe("transparent");
    expect(createGhostButtonNode().background?.color).toBe("transparent");
  });

  it.each(presetFactories)("%s Button produces a fresh id per call", (_label, factory) => {
    expect(factory().id).not.toBe(factory().id);
  });
});

function collectIds(node: ReturnType<typeof createButtonGroupNode>): string[] {
  return [node.id, ...(node.children ?? []).flatMap((child) => collectIds(child))];
}

describe("Button Group (Checkpoint 1.15.6.2, section 17)", () => {
  it("is an ordinary div > button x3 — no proprietary ButtonGroup node", () => {
    const node = createButtonGroupNode();
    expect(node.tag).toBe("div");
    expect(node.children).toHaveLength(3);
    expect(node.children?.every((child) => child.tag === "button")).toBe(true);
  });

  it("the parent uses ordinary Flex Row layout with a sensible gap", () => {
    const node = createButtonGroupNode();
    expect(node.flowLayout?.display).toBe("flex");
    expect(node.flowLayout?.flex?.direction).toBe("row");
    expect(node.flowLayout?.flex?.columnGap).toBeGreaterThan(0);
  });

  it("every node gets its own fresh, unique id, and two separate compositions never share one", () => {
    const idsA = collectIds(createButtonGroupNode());
    expect(new Set(idsA).size).toBe(idsA.length);

    const idsB = collectIds(createButtonGroupNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });

  it("each button has distinct, independently editable starter text", () => {
    const [a, b, c] = createButtonGroupNode().children ?? [];
    expect(new Set([a.text, b.text, c.text]).size).toBe(3);
  });
});

describe("Dropdown Button (Checkpoint 1.15.6.2, sections 19-27; upgraded in Checkpoint 1.15.6.8.1)", () => {
  it("is an ordinary div > (button, div > a x3) composition — no proprietary DropdownButton node", () => {
    const node = createDropdownButtonNode();
    expect(node.tag).toBe("div");
    expect(node.children).toHaveLength(2);

    const [trigger, menu] = node.children ?? [];
    expect(trigger.tag).toBe("button");
    expect(menu.tag).toBe("div");
    expect(menu.children).toHaveLength(3);
    expect(menu.children?.every((child) => child.tag === "a" && typeof child.href === "string")).toBe(true);
  });

  it("the Button authors exactly one click->toggle interaction targeting the menu's own real internal id (Checkpoint 1.15.6.8.1)", () => {
    const [trigger, menu] = createDropdownButtonNode().children!;
    expect(trigger.interactions).toHaveLength(1);
    expect(trigger.interactions![0]).toMatchObject({ trigger: "click", action: "toggle", targetId: menu.id });
  });

  it("the menu authors an initial Preview visibility of hidden — generic field, not a Dropdown-specific one (Checkpoint 1.15.6.8.1)", () => {
    const [, menu] = createDropdownButtonNode().children!;
    expect(menu.initialPreviewVisibility).toBe("hidden");
  });

  it("stores no Dropdown-specific behavior field anywhere in the composition", () => {
    const node = createDropdownButtonNode() as unknown as Record<string, unknown>;
    const [trigger, menu] = (node.children as Record<string, unknown>[])!;
    for (const n of [node, trigger, menu]) {
      expect(n.dropdownOpen).toBeUndefined();
      expect(n.dropdownTargetId).toBeUndefined();
      expect(n.dropdownState).toBeUndefined();
      expect(n.isDropdown).toBeUndefined();
      expect(n.componentType).toBeUndefined();
    }
  });

  it("the root uses an ordinary managed Flex Column layout — no Free/absolute positioning anywhere in the composition", () => {
    const node = createDropdownButtonNode();
    expect(node.layoutMode).not.toBe("free");
    expect(node.flowLayout?.display).toBe("flex");
    expect(node.flowLayout?.flex?.direction).toBe("column");
    expect(node.freeLayout).toBeUndefined();

    const [, menu] = node.children ?? [];
    expect(menu.layoutMode).not.toBe("free");
    expect(menu.freeLayout).toBeUndefined();
  });

  it("the menu's authored CSS never encodes hidden/closed state — Display/Visibility remain untouched; only the generic Preview-only field marks it initially closed", () => {
    const node = createDropdownButtonNode() as unknown as Record<string, unknown>;
    const menu = (node.children as Array<Record<string, unknown>>)[1];
    expect(menu.display).toBeUndefined();
    expect((menu.display as { visibility?: string } | undefined)?.visibility).toBeUndefined();
  });

  it("every node and every interaction gets its own fresh, unique id, and two separate compositions never share one", () => {
    const idsA = collectIds(createDropdownButtonNode());
    expect(new Set(idsA).size).toBe(idsA.length);

    const idsB = collectIds(createDropdownButtonNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);

    const [triggerA] = createDropdownButtonNode().children!;
    const [triggerB] = createDropdownButtonNode().children!;
    expect(triggerA.interactions![0].id).not.toBe(triggerB.interactions![0].id);
  });

  it("menu items use the existing Link href default, editable like any ordinary Link", () => {
    const [, menu] = createDropdownButtonNode().children ?? [];
    for (const item of menu.children ?? []) {
      expect(item.href).toBe("#");
      expect(typeof item.text).toBe("string");
    }
  });
});
