import { createElementNode } from "@/features/editor/factories/elementFactories";
import type { EditorElementNode } from "@/features/editor/types/document";

/*
 * One page holding every interactive catalog component, built by the real
 * factories (EXPORT-1.3), including the multiple-instance and nesting
 * cases: two of each toggle-style component, a dropdown inside a modal and
 * a popover inside a container. `ids` names the nodes the parity spec
 * clicks and inspects.
 */

const children = (node: EditorElementNode) => node.children ?? [];

export interface InteractionFixture {
  document: EditorElementNode;
  ids: {
    dropdowns: Array<{ trigger: string; menu: string; firstItem: string }>;
    collapsibles: Array<{ trigger: string; content: string }>;
    tabs: Array<{ buttons: string[]; panels: string[] }>;
    modals: Array<{ open: string; dialog: string; close: string }>;
    nestedDropdown: { trigger: string; menu: string };
    drawer: { open: string; dialog: string; close: string };
    popover: { trigger: string; panel: string };
    toasts: Array<{ show: string; toast: string; close: string }>;
    alerts: Array<{ root: string; dismiss: string }>;
    dialog: string;
    outside: string;
  };
}

export function interactionFixture(): InteractionFixture {
  const dropdowns = [createElementNode("dropdownButton"), createElementNode("dropdownButton")];
  const collapsibles = [createElementNode("collapsible"), createElementNode("collapsible")];
  const tabs = [createElementNode("basicTabs"), createElementNode("basicTabs")];
  const modals = [createElementNode("modal"), createElementNode("modal")];
  const nestedDropdown = createElementNode("dropdownButton");
  children(children(children(modals[1])[1])[0]).push(nestedDropdown);
  const drawer = createElementNode("drawer");
  const popover = createElementNode("popover");
  const popoverContainer: EditorElementNode = { id: "popover-container", tag: "div", flowLayout: { display: "block" }, spacing: { margin: { top: 0, right: 0, bottom: 0, left: 0 }, padding: { top: 12, right: 12, bottom: 12, left: 12 } }, children: [popover] };
  const toasts = [createElementNode("manualToast"), createElementNode("manualToast")];
  const alerts = [createElementNode("dismissibleAlert"), createElementNode("dismissibleAlert")];
  const dialog = createElementNode("dialog");
  const outside: EditorElementNode = { id: "p-outside", tag: "p", text: "Click here to click outside every component." };

  const dialogParts = (modal: EditorElementNode) => {
    const [open, modalDialog] = children(modal);
    return { open: open.id, dialog: modalDialog.id, close: children(children(modalDialog)[0])[2].id };
  };

  return {
    document: {
      id: "page-root",
      tag: "page",
      children: [outside, ...dropdowns, ...collapsibles, ...tabs, popoverContainer, ...alerts, ...toasts, ...modals, drawer, dialog],
    },
    ids: {
      dropdowns: dropdowns.map((dropdown) => ({ trigger: children(dropdown)[0].id, menu: children(dropdown)[1].id, firstItem: children(children(dropdown)[1])[0].id })),
      collapsibles: collapsibles.map((collapsible) => ({ trigger: children(collapsible)[0].id, content: children(collapsible)[1].id })),
      tabs: tabs.map((group) => ({ buttons: children(children(group)[0]).map((button) => button.id), panels: children(children(group)[1]).map((panel) => panel.id) })),
      modals: modals.map(dialogParts),
      nestedDropdown: { trigger: children(nestedDropdown)[0].id, menu: children(nestedDropdown)[1].id },
      drawer: dialogParts(drawer),
      popover: { trigger: children(popover)[0].id, panel: children(popover)[1].id },
      toasts: toasts.map((toast) => ({ show: children(toast)[0].id, toast: children(toast)[1].id, close: children(children(toast)[1])[1].id })),
      alerts: alerts.map((alert) => ({ root: alert.id, dismiss: children(alert)[1].id })),
      dialog: dialog.id,
      outside: outside.id,
    },
  };
}
