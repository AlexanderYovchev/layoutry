import { afterEach, describe, expect, it } from "vitest";
import {
  createButtonNode,
  createSelectNode,
  createTableNode,
  createUnorderedListNode,
} from "@/features/editor/factories/elementFactories";
import { createBasicNavbarNode } from "@/features/editor/factories/navigationCompositions";
import { getInteractions } from "@/features/editor/types/interactions";
import type { EditorElementNode } from "@/features/editor/types/document";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { createProjectMetadata, serializeProject } from "@/features/project/utils/serializeProject";
import { useEditorStore } from "./useEditorStore";

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();

/** Saving the current document the way Save does: throws when the document holds a dangling interaction target. */
function save(): void {
  serializeProject({ metadata: createProjectMetadata({ id: "project-1", now: new Date(0) }), document: store().document });
}

function bindingTargets(nodeId: string): string[] {
  const node = findNodeById(store().document, nodeId);
  return node ? getInteractions(node).map((binding) => binding.targetId) : [];
}

interface Scenario {
  name: string;
  /** The structure to insert; returns it plus the id of a node the edit removes and one it keeps. */
  build: () => { root: EditorElementNode; removedId: string; keptId: string };
  /** The control's own edit, which removes `removedId`. */
  edit: (rootId: string) => void;
}

/**
 * BC06-D1 (BC-06.2): every structural edit that removes nodes must also
 * remove interactions targeting them, as Delete does, or the project can no
 * longer be saved. Each scenario: a Button toggles a node the edit removes
 * AND a node it keeps; the edit runs; the dangling binding is gone, the
 * other survives, the project saves, Undo restores both bindings and Redo
 * cleans up again. Every case fails on the pre-BC-06.2 store (save throws
 * "An interaction targets element …, which does not exist").
 */
const scenarios: Scenario[] = [
  {
    name: "List > Items decrease (targeted li)",
    build: () => {
      const root = createUnorderedListNode();
      return { root, removedId: root.children![2].id, keptId: root.children![0].id };
    },
    edit: (id) => store().setListItemCount(id, 2),
  },
  {
    name: "Select > Options decrease (targeted option)",
    build: () => {
      const root = createSelectNode();
      return { root, removedId: root.children![2].id, keptId: root.children![0].id };
    },
    edit: (id) => store().setOptionCount(id, 1),
  },
  {
    name: "Table > Columns decrease (targeted cell)",
    build: () => {
      const root = createTableNode();
      const bodyRow = root.children![1].children![0];
      return { root, removedId: bodyRow.children![2].id, keptId: bodyRow.children![0].id };
    },
    edit: (id) => store().setTableColumnCount(id, 2),
  },
  {
    name: "Table > Body rows decrease (targeted row)",
    build: () => {
      const root = createTableNode();
      const body = root.children![1];
      return { root, removedId: body.children![1].id, keptId: body.children![0].id };
    },
    edit: (id) => store().setTableBodyRowCount(id, 1),
  },
  {
    name: "Table > Body rows decrease (targeted cell nested in the removed row)",
    build: () => {
      const root = createTableNode();
      const body = root.children![1];
      return { root, removedId: body.children![1].children![1].id, keptId: body.children![0].children![1].id };
    },
    edit: (id) => store().setTableBodyRowCount(id, 1),
  },
  {
    name: "Table > Header row off (targeted header cell)",
    build: () => {
      const root = createTableNode();
      const headerRow = root.children![0].children![0];
      return { root, removedId: headerRow.children![0].id, keptId: root.children![1].children![0].children![0].id };
    },
    edit: (id) => store().setTableHeaderEnabled(id, false),
  },
  {
    name: "Navigation links > Remove (targeted link)",
    build: () => {
      const root = createBasicNavbarNode();
      return { root, removedId: root.children![1].id, keptId: root.children![0].id };
    },
    edit: () => {
      // The nav's own Remove for "About".
      const nav = store().document.children!.find((child) => child.tag === "nav")!;
      store().removeNavigationLink(nav.id, nav.children![1].id);
    },
  },
];

describe("structural removal keeps the project saveable (BC06-D1, BC-06.2)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  for (const scenario of scenarios) {
    it(scenario.name, () => {
      const { root, removedId, keptId } = scenario.build();
      const trigger = createButtonNode();
      store().insertElement("page-root", root);
      store().insertElement("page-root", trigger);
      store().addInteraction(trigger.id, { trigger: "click", action: "toggle", targetId: removedId });
      store().addInteraction(trigger.id, { trigger: "click", action: "show", targetId: keptId });
      store().selectElement(root.id);
      expect(() => save()).not.toThrow();
      const historyBefore = store().past.length;

      scenario.edit(root.id);

      expect(findNodeById(store().document, removedId)).toBeUndefined();
      expect(bindingTargets(trigger.id)).toEqual([keptId]);
      expect(store().past.length).toBe(historyBefore + 1);
      expect(() => save()).not.toThrow();

      store().undo();
      expect(findNodeById(store().document, removedId)).toBeDefined();
      expect(bindingTargets(trigger.id)).toEqual([removedId, keptId]);
      expect(() => save()).not.toThrow();

      store().redo();
      expect(findNodeById(store().document, removedId)).toBeUndefined();
      expect(bindingTargets(trigger.id)).toEqual([keptId]);
      expect(() => save()).not.toThrow();
    });
  }

  it("Table > Footer row off and Caption off clean up bindings to the removed nodes", () => {
    const table = createTableNode();
    const trigger = createButtonNode();
    store().insertElement("page-root", table);
    store().insertElement("page-root", trigger);
    store().setTableFooterEnabled(table.id, true);
    store().setTableCaptionEnabled(table.id, true);
    const tableNow = findNodeById(store().document, table.id)!;
    const caption = tableNow.children!.find((child) => child.tag === "caption")!;
    const footerCell = tableNow.children!.find((child) => child.tag === "tfoot")!.children![0].children![0];
    store().addInteraction(trigger.id, { trigger: "click", action: "toggle", targetId: caption.id });
    store().addInteraction(trigger.id, { trigger: "click", action: "toggle", targetId: footerCell.id });

    store().setTableFooterEnabled(table.id, false);
    expect(bindingTargets(trigger.id)).toEqual([caption.id]);
    store().setTableCaptionEnabled(table.id, false);
    expect(bindingTargets(trigger.id)).toEqual([]);
    expect(() => save()).not.toThrow();

    store().undo();
    store().undo();
    expect(bindingTargets(trigger.id)).toEqual([caption.id, footerCell.id]);
    expect(() => save()).not.toThrow();
  });

  it("a binding ON a removed node leaves with it; bindings elsewhere are untouched", () => {
    const list = createUnorderedListNode();
    const other = createButtonNode();
    store().insertElement("page-root", list);
    store().insertElement("page-root", other);
    const lastItem = list.children![2];
    store().addInteraction(lastItem.id, { trigger: "click", action: "toggle", targetId: other.id });
    store().addInteraction(other.id, { trigger: "click", action: "toggle", targetId: list.children![0].id });

    store().setListItemCount(list.id, 2);

    expect(findNodeById(store().document, lastItem.id)).toBeUndefined();
    expect(bindingTargets(other.id)).toEqual([list.children![0].id]);
    expect(() => save()).not.toThrow();
  });

  it("a count increase still changes nothing but the count (no cleanup, one entry)", () => {
    const list = createUnorderedListNode();
    const trigger = createButtonNode();
    store().insertElement("page-root", list);
    store().insertElement("page-root", trigger);
    store().addInteraction(trigger.id, { trigger: "click", action: "toggle", targetId: list.children![0].id });
    const historyBefore = store().past.length;

    store().setListItemCount(list.id, 5);

    expect(findNodeById(store().document, list.id)!.children).toHaveLength(5);
    expect(bindingTargets(trigger.id)).toEqual([list.children![0].id]);
    expect(store().past.length).toBe(historyBefore + 1);
  });

  it("an unchanged count pushes no history entry", () => {
    const list = createUnorderedListNode();
    store().insertElement("page-root", list);
    const before = store().document;
    const historyBefore = store().past.length;
    store().setListItemCount(list.id, 3);
    expect(store().document).toBe(before);
    expect(store().past.length).toBe(historyBefore);
  });

  it("a selected node that the edit removes is replaced by the container in the selection", () => {
    const list = createUnorderedListNode();
    store().insertElement("page-root", list);
    store().selectElement(list.children![2].id);
    store().setListItemCount(list.id, 1);
    expect(store().selection).toEqual({ ids: [list.id], primaryId: list.id });
  });
});
