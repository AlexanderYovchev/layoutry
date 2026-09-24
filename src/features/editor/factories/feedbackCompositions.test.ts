import { describe, expect, it } from "vitest";
import {
  createDismissibleAlertNode,
  createErrorAlertNode,
  createInfoAlertNode,
  createManualToastNode,
  createPopoverNode,
  createSuccessAlertNode,
  createWarningAlertNode,
} from "./feedbackCompositions";

type AnyNode = { id: string; tag: string; children?: AnyNode[]; interactions?: { id: string }[] };

function collectIds(node: AnyNode): string[] {
  return [node.id, ...(node.interactions ?? []).map((i) => i.id), ...(node.children ?? []).flatMap(collectIds)];
}

function collectNodes(n: Record<string, unknown> & { children?: Record<string, unknown>[] }): Record<string, unknown>[] {
  return [n, ...((n.children as Record<string, unknown>[] | undefined) ?? []).flatMap(collectNodes)];
}

describe("Static Alert variants (Checkpoint 1.15.6.11.1)", () => {
  const variants = [
    { name: "Info", factory: createInfoAlertNode, title: "Information" },
    { name: "Success", factory: createSuccessAlertNode, title: "Success" },
    { name: "Warning", factory: createWarningAlertNode, title: "Warning" },
    { name: "Error", factory: createErrorAlertNode, title: "Something went wrong" },
  ];

  for (const { name, factory, title } of variants) {
    describe(name, () => {
      it("is div (Flex Column) > h3, p", () => {
        const node = factory();
        expect(node.tag).toBe("div");
        expect(node.flowLayout?.display).toBe("flex");
        const [heading, paragraph] = node.children!;
        expect(heading.tag).toBe("h3");
        expect(heading.text).toBe(title);
        expect(paragraph.tag).toBe("p");
      });

      it("authors its own background/border/title color, not a shared/default value", () => {
        const node = factory();
        expect(node.background?.color).toBeTruthy();
        expect(node.border?.top?.color).toBeTruthy();
        const [heading] = node.children!;
        expect(heading.typography?.color).toBeTruthy();
      });

      it("carries no interactions and no proprietary field", () => {
        const node = factory();
        expect(node.interactions).toBeUndefined();
        for (const n of collectNodes(node as unknown as Record<string, unknown> & { children?: Record<string, unknown>[] })) {
          expect(n.tag).not.toBe("alert");
          expect(n.alertVariant).toBeUndefined();
          expect(n.componentType).toBeUndefined();
        }
      });
    });
  }

  it("each variant has its own distinct background color", () => {
    const colors = variants.map(({ factory }) => factory().background?.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("every node gets its own fresh id across two calls", () => {
    const idsA = collectIds(createInfoAlertNode() as unknown as AnyNode);
    const idsB = collectIds(createInfoAlertNode() as unknown as AnyNode);
    expect(new Set(idsA).size).toBe(idsA.length);
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("createDismissibleAlertNode (Checkpoint 1.15.6.11.1)", () => {
  it("is div (Flex Row) > content div (h3, p), Button 'Dismiss'", () => {
    const node = createDismissibleAlertNode();
    expect(node.tag).toBe("div");
    expect(node.flowLayout?.display).toBe("flex");
    const [content, dismissButton] = node.children!;
    expect(content.tag).toBe("div");
    const [heading, paragraph] = content.children!;
    expect(heading.tag).toBe("h3");
    expect(paragraph.tag).toBe("p");
    expect(dismissButton.tag).toBe("button");
    expect(dismissButton.text).toBe("Dismiss");
  });

  it("Dismiss Button authors exactly one click->hide interaction targeting the Alert root's own real id", () => {
    const node = createDismissibleAlertNode();
    const [, dismissButton] = node.children!;
    expect(dismissButton.interactions).toHaveLength(1);
    expect(dismissButton.interactions![0]).toMatchObject({ trigger: "click", action: "hide", targetId: node.id });
  });

  it("starts visible — never marked initialPreviewVisibility: hidden (a one-way reveal-then-dismiss shape, not hidden-until-shown)", () => {
    const node = createDismissibleAlertNode();
    expect(node.initialPreviewVisibility).not.toBe("hidden");
  });

  it("uses hide, not toggle — deliberately excluded from generic click->toggle dismissal (Checkpoint 1.15.6.8.3)", () => {
    const [, dismissButton] = createDismissibleAlertNode().children!;
    expect(dismissButton.interactions![0].action).not.toBe("toggle");
  });

  it("stores no proprietary component tag or state field anywhere", () => {
    for (const n of collectNodes(createDismissibleAlertNode() as unknown as Record<string, unknown> & { children?: Record<string, unknown>[] })) {
      expect(n.tag).not.toBe("alert");
      expect(n.alertVariant).toBeUndefined();
      expect(n.dismissed).toBeUndefined();
    }
  });

  it("every node and interaction gets its own fresh id, and two compositions never share one", () => {
    const idsA = collectIds(createDismissibleAlertNode() as unknown as AnyNode);
    const idsB = collectIds(createDismissibleAlertNode() as unknown as AnyNode);
    expect(new Set(idsA).size).toBe(idsA.length);
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("createManualToastNode (Checkpoint 1.15.6.11.1)", () => {
  it("is div (wrapper) > Button 'Show Toast', Toast div > (content div > h3, p), Button 'Close'", () => {
    const node = createManualToastNode();
    expect(node.tag).toBe("div");
    const [showButton, toast] = node.children!;
    expect(showButton.tag).toBe("button");
    expect(showButton.text).toBe("Show Toast");
    expect(toast.tag).toBe("div");
    const [content, closeButton] = toast.children!;
    expect(content.tag).toBe("div");
    const [heading, paragraph] = content.children!;
    expect(heading.tag).toBe("h3");
    expect(paragraph.tag).toBe("p");
    expect(closeButton.tag).toBe("button");
    expect(closeButton.text).toBe("Close");
  });

  it("Show Button authors exactly one click->show interaction targeting the Toast's real internal id", () => {
    const node = createManualToastNode();
    const [showButton, toast] = node.children!;
    expect(showButton.interactions).toHaveLength(1);
    expect(showButton.interactions![0]).toMatchObject({ trigger: "click", action: "show", targetId: toast.id });
  });

  it("Close Button authors exactly one click->hide interaction targeting the SAME Toast id", () => {
    const node = createManualToastNode();
    const [showButton, toast] = node.children!;
    const [, closeButton] = toast.children!;
    expect(closeButton.interactions).toHaveLength(1);
    expect(closeButton.interactions![0]).toMatchObject({ trigger: "click", action: "hide", targetId: toast.id });
    expect(closeButton.interactions![0].targetId).toBe(showButton.interactions![0].targetId);
  });

  it("Toast target starts hidden", () => {
    const [, toast] = createManualToastNode().children!;
    expect(toast.initialPreviewVisibility).toBe("hidden");
  });

  it("uses show/hide, not toggle — deliberately excluded from generic click->toggle dismissal", () => {
    const node = createManualToastNode();
    const [showButton, toast] = node.children!;
    const [, closeButton] = toast.children!;
    expect(showButton.interactions![0].action).not.toBe("toggle");
    expect(closeButton.interactions![0].action).not.toBe("toggle");
  });

  it("Toast target authors a real fixed position pinned to the viewport's bottom-right, with a stacking z-index", () => {
    const [, toast] = createManualToastNode().children!;
    expect(toast.position?.position).toBe("fixed");
    expect(toast.position?.right).toEqual({ value: 24, unit: "px" });
    expect(toast.position?.bottom).toEqual({ value: 24, unit: "px" });
    expect(typeof toast.position?.zIndex).toBe("number");
  });

  it("carries no timer/auto-dismiss field anywhere", () => {
    for (const n of collectNodes(createManualToastNode() as unknown as Record<string, unknown> & { children?: Record<string, unknown>[] })) {
      expect(n.tag).not.toBe("toast");
      expect(n.toastTimeout).toBeUndefined();
      expect(n.autoClose).toBeUndefined();
      expect(n.autoDismiss).toBeUndefined();
      expect(n.toastState).toBeUndefined();
    }
  });

  it("every node and interaction gets its own fresh id, and two compositions never share one", () => {
    const idsA = collectIds(createManualToastNode() as unknown as AnyNode);
    const idsB = collectIds(createManualToastNode() as unknown as AnyNode);
    expect(new Set(idsA).size).toBe(idsA.length);
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("createPopoverNode (Checkpoint 1.15.6.11.2)", () => {
  it("is div (Flex Column) > Button 'Open Popover', Panel div > h3, p", () => {
    const node = createPopoverNode();
    expect(node.tag).toBe("div");
    const [trigger, panel] = node.children!;
    expect(trigger.tag).toBe("button");
    expect(trigger.text).toBe("Open Popover");
    expect(panel.tag).toBe("div");
    const [heading, paragraph] = panel.children!;
    expect(heading.tag).toBe("h3");
    expect(paragraph.tag).toBe("p");
  });

  it("trigger authors exactly one click->toggle interaction targeting the Panel's own real id", () => {
    const node = createPopoverNode();
    const [trigger, panel] = node.children!;
    expect(trigger.interactions).toHaveLength(1);
    expect(trigger.interactions![0]).toMatchObject({ trigger: "click", action: "toggle", targetId: panel.id });
  });

  it("Panel starts hidden in Preview", () => {
    const [, panel] = createPopoverNode().children!;
    expect(panel.initialPreviewVisibility).toBe("hidden");
  });

  it("uses toggle — deliberately qualifies for the SAME generic click->toggle dismissal Dropdown already uses (Checkpoint 1.15.6.8.3), no new exclusion or inclusion logic needed", () => {
    const [trigger] = createPopoverNode().children!;
    expect(trigger.interactions![0].action).toBe("toggle");
  });

  it("stores no proprietary component tag or state field anywhere", () => {
    for (const n of collectNodes(createPopoverNode() as unknown as Record<string, unknown> & { children?: Record<string, unknown>[] })) {
      expect(n.tag).not.toBe("popover");
      expect(n.popoverOpen).toBeUndefined();
      expect(n.popoverState).toBeUndefined();
      expect(n.popoverTarget).toBeUndefined();
      expect(n.popoverPosition).toBeUndefined();
    }
  });

  it("every node and interaction gets its own fresh id, and two compositions never share one", () => {
    const idsA = collectIds(createPopoverNode() as unknown as AnyNode);
    const idsB = collectIds(createPopoverNode() as unknown as AnyNode);
    expect(new Set(idsA).size).toBe(idsA.length);
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});
