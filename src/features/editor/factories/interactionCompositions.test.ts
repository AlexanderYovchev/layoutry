import { describe, expect, it } from "vitest";
import { createBasicTabsNode, createCollapsibleNode, createDrawerNode, createModalNode } from "./interactionCompositions";

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

/**
 * Checkpoint 1.15.6.9 — the Modal proof composition. The first Interactive
 * composition to author a genuine `tag: "dialog"` and the first where TWO
 * different triggers (Open, Close) target the exact same node — see this
 * checkpoint's own report, section W, for why cloneNodeWithFreshIds' own
 * two-pass id-map design already handles this correctly with no new code.
 */
describe("createModalNode", () => {
  it("is div (Flex Column) > button 'Open Modal', dialog > div (Flex Column) > h2, p, button 'Close'", () => {
    const node = createModalNode();
    expect(node.tag).toBe("div");
    expect(node.flowLayout?.display).toBe("flex");

    const [openButton, dialog] = node.children!;
    expect(openButton.tag).toBe("button");
    expect(openButton.text).toBe("Open Modal");
    expect(dialog.tag).toBe("dialog");

    const [content] = dialog.children!;
    expect(content.tag).toBe("div");
    expect(content.flowLayout?.display).toBe("flex");
    const [heading, paragraph, closeButton] = content.children!;
    expect(heading.tag).toBe("h2");
    expect(paragraph.tag).toBe("p");
    expect(closeButton.tag).toBe("button");
    expect(closeButton.text).toBe("Close");
  });

  it("Open Button authors exactly one click->show interaction targeting the Dialog's real internal id", () => {
    const node = createModalNode();
    const [openButton, dialog] = node.children!;
    expect(openButton.interactions).toHaveLength(1);
    expect(openButton.interactions![0]).toMatchObject({ trigger: "click", action: "show", targetId: dialog.id });
  });

  it("Close Button authors exactly one click->hide interaction targeting the SAME Dialog id — two triggers, one target", () => {
    const node = createModalNode();
    const [openButton, dialog] = node.children!;
    const closeButton = dialog.children![0].children![2];
    expect(closeButton.interactions).toHaveLength(1);
    expect(closeButton.interactions![0]).toMatchObject({ trigger: "click", action: "hide", targetId: dialog.id });
    expect(closeButton.interactions![0].targetId).toBe(openButton.interactions![0].targetId);
  });

  it("Dialog itself carries no interaction of its own, and starts hidden", () => {
    const [, dialog] = createModalNode().children!;
    expect(dialog.interactions).toBeUndefined();
    expect(dialog.initialPreviewVisibility).toBe("hidden");
  });

  it("uses show/hide, not toggle — deliberately excluded from generic click->toggle dismissal (Checkpoint 1.15.6.8.3)", () => {
    const [openButton, dialog] = createModalNode().children!;
    const closeButton = dialog.children![0].children![2];
    expect(openButton.interactions![0].action).not.toBe("toggle");
    expect(closeButton.interactions![0].action).not.toBe("toggle");
  });

  it("stores no proprietary component tag or state field anywhere", () => {
    function collectNodes(n: Record<string, unknown> & { children?: Record<string, unknown>[] }): Record<string, unknown>[] {
      return [n, ...((n.children as Record<string, unknown>[] | undefined) ?? []).flatMap(collectNodes)];
    }
    for (const n of collectNodes(createModalNode() as unknown as Record<string, unknown> & { children?: Record<string, unknown>[] })) {
      expect(n.tag).not.toBe("modal");
      expect(n.modalOpen).toBeUndefined();
      expect(n.componentType).toBeUndefined();
      expect(n.htmlId).toBeUndefined();
      expect(n.className).toBeUndefined();
    }
  });

  it("every node and every interaction gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createModalNode() as unknown as AnyNode);
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createModalNode() as unknown as AnyNode);
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("createBasicTabsNode (Checkpoint 1.15.6.11.2)", () => {
  it("is div (Flex Column) > controls div (Flex Row) > button x3, panels div (Flex Column) > panel div x3 (h3, p each)", () => {
    const node = createBasicTabsNode();
    expect(node.tag).toBe("div");
    const [controls, panels] = node.children!;
    expect(controls.tag).toBe("div");
    expect(controls.children).toHaveLength(3);
    for (const tab of controls.children!) expect(tab.tag).toBe("button");
    expect(panels.tag).toBe("div");
    expect(panels.children).toHaveLength(3);
    for (const panel of panels.children!) {
      expect(panel.tag).toBe("div");
      const [heading, paragraph] = panel.children!;
      expect(heading.tag).toBe("h3");
      expect(paragraph.tag).toBe("p");
    }
  });

  it("Panel 1 starts visible (no initialPreviewVisibility written); Panels 2 and 3 start hidden", () => {
    const [, panels] = createBasicTabsNode().children!;
    const [panel1, panel2, panel3] = panels.children!;
    expect(panel1.initialPreviewVisibility).toBeUndefined();
    expect(panel2.initialPreviewVisibility).toBe("hidden");
    expect(panel3.initialPreviewVisibility).toBe("hidden");
  });

  it("each Tab Button owns exactly three ordinary click bindings — one show, two hide", () => {
    const [controls] = createBasicTabsNode().children!;
    for (const tab of controls.children!) {
      expect(tab.interactions).toHaveLength(3);
      for (const binding of tab.interactions!) {
        expect(binding.trigger).toBe("click");
        expect(["show", "hide"]).toContain(binding.action);
      }
      expect(tab.interactions!.filter((b) => b.action === "show")).toHaveLength(1);
      expect(tab.interactions!.filter((b) => b.action === "hide")).toHaveLength(2);
    }
  });

  it("Tab 1 shows Panel 1 and hides Panels 2/3; Tab 2 shows Panel 2 and hides 1/3; Tab 3 shows Panel 3 and hides 1/2", () => {
    const node = createBasicTabsNode();
    const [controls, panels] = node.children!;
    const [tab1, tab2, tab3] = controls.children!;
    const [panel1, panel2, panel3] = panels.children!;

    function actionFor(tab: typeof tab1, targetId: string) {
      return tab.interactions!.find((b) => b.targetId === targetId)?.action;
    }

    expect(actionFor(tab1, panel1.id)).toBe("show");
    expect(actionFor(tab1, panel2.id)).toBe("hide");
    expect(actionFor(tab1, panel3.id)).toBe("hide");

    expect(actionFor(tab2, panel1.id)).toBe("hide");
    expect(actionFor(tab2, panel2.id)).toBe("show");
    expect(actionFor(tab2, panel3.id)).toBe("hide");

    expect(actionFor(tab3, panel1.id)).toBe("hide");
    expect(actionFor(tab3, panel2.id)).toBe("hide");
    expect(actionFor(tab3, panel3.id)).toBe("show");
  });

  it("no binding ever uses toggle — Tabs is correctly, automatically excluded from generic click->toggle dismissal with zero exclusion logic written", () => {
    const [controls] = createBasicTabsNode().children!;
    for (const tab of controls.children!) {
      for (const binding of tab.interactions!) expect(binding.action).not.toBe("toggle");
    }
  });

  it("stores no proprietary tag or state field anywhere (no tag:'tabs'/'tab'/'tabpanel', no activeTab/selectedTab)", () => {
    function collectNodes(n: Record<string, unknown> & { children?: Record<string, unknown>[] }): Record<string, unknown>[] {
      return [n, ...((n.children as Record<string, unknown>[] | undefined) ?? []).flatMap(collectNodes)];
    }
    for (const n of collectNodes(createBasicTabsNode() as unknown as Record<string, unknown> & { children?: Record<string, unknown>[] })) {
      expect(["tabs", "tab", "tabpanel"]).not.toContain(n.tag);
      expect(n.activeTab).toBeUndefined();
      expect(n.selectedTab).toBeUndefined();
      expect(n.tabGroup).toBeUndefined();
    }
  });

  it("every node and every interaction gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createBasicTabsNode() as unknown as AnyNode);
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createBasicTabsNode() as unknown as AnyNode);
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("createDrawerNode (Checkpoint 1.15.6.11.3)", () => {
  it("is div (Flex Column) > button 'Open Drawer', dialog > div (Flex Column) > h2, p, button 'Close' — the exact same shape as createModalNode", () => {
    const node = createDrawerNode();
    expect(node.tag).toBe("div");
    expect(node.flowLayout?.display).toBe("flex");

    const [openButton, dialog] = node.children!;
    expect(openButton.tag).toBe("button");
    expect(openButton.text).toBe("Open Drawer");
    expect(dialog.tag).toBe("dialog");

    const [content] = dialog.children!;
    expect(content.tag).toBe("div");
    expect(content.flowLayout?.display).toBe("flex");
    const [heading, paragraph, closeButton] = content.children!;
    expect(heading.tag).toBe("h2");
    expect(heading.text).toBe("Drawer");
    expect(paragraph.tag).toBe("p");
    expect(closeButton.tag).toBe("button");
    expect(closeButton.text).toBe("Close");
  });

  it("Open Button authors exactly one click->show interaction targeting the Dialog's real internal id", () => {
    const node = createDrawerNode();
    const [openButton, dialog] = node.children!;
    expect(openButton.interactions).toHaveLength(1);
    expect(openButton.interactions![0]).toMatchObject({ trigger: "click", action: "show", targetId: dialog.id });
  });

  it("Close Button authors exactly one click->hide interaction targeting the SAME Dialog id", () => {
    const node = createDrawerNode();
    const [openButton, dialog] = node.children!;
    const closeButton = dialog.children![0].children![2];
    expect(closeButton.interactions).toHaveLength(1);
    expect(closeButton.interactions![0]).toMatchObject({ trigger: "click", action: "hide", targetId: dialog.id });
    expect(closeButton.interactions![0].targetId).toBe(openButton.interactions![0].targetId);
  });

  it("Dialog itself carries no interaction of its own, and starts hidden", () => {
    const [, dialog] = createDrawerNode().children!;
    expect(dialog.interactions).toBeUndefined();
    expect(dialog.initialPreviewVisibility).toBe("hidden");
  });

  it("uses show/hide, not toggle — deliberately excluded from generic click->toggle dismissal, exactly like Modal", () => {
    const [openButton, dialog] = createDrawerNode().children!;
    const closeButton = dialog.children![0].children![2];
    expect(openButton.interactions![0].action).not.toBe("toggle");
    expect(closeButton.interactions![0].action).not.toBe("toggle");
  });

  it("authors right-edge positioning via the pre-existing, generic PositionSettings field — position:fixed, top/right/bottom:0, and an explicit left:'auto' (load-bearing: defeats the UA dialog:modal inset:0 default that would otherwise pin the box to the left edge)", () => {
    const [, dialog] = createDrawerNode().children!;
    expect(dialog.position).toEqual({
      position: "fixed",
      top: { value: 0, unit: "px" },
      right: { value: 0, unit: "px" },
      bottom: { value: 0, unit: "px" },
      left: "auto",
    });
  });

  it("authors an explicit width via the pre-existing generic dimensions resize-stamp field — no new sizing concept, no vh/percentage unit added", () => {
    const [, dialog] = createDrawerNode().children!;
    expect(dialog.dimensions).toEqual({ preferredWidth: 360, preferredHeight: 480, offsetX: 0, offsetY: 0 });
  });

  it("stores no proprietary tag or state field anywhere — no tag:'drawer', no drawerSide, no isDrawer", () => {
    function collectNodes(n: Record<string, unknown> & { children?: Record<string, unknown>[] }): Record<string, unknown>[] {
      return [n, ...((n.children as Record<string, unknown>[] | undefined) ?? []).flatMap(collectNodes)];
    }
    for (const n of collectNodes(createDrawerNode() as unknown as Record<string, unknown> & { children?: Record<string, unknown>[] })) {
      expect(n.tag).not.toBe("drawer");
      expect(n.drawerSide).toBeUndefined();
      expect(n.isDrawer).toBeUndefined();
      expect(n.componentType).toBeUndefined();
    }
  });

  it("every node and every interaction gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createDrawerNode() as unknown as AnyNode);
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createDrawerNode() as unknown as AnyNode);
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});
