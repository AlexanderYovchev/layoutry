export interface StructureTreeNodeData {
  id: string;
  label: string;
  children?: StructureTreeNodeData[];
}

/**
 * "Home Page" is the project/document identity, not a DOM node — the real
 * hierarchy (mirroring what canvas/export will eventually read from the
 * document model) starts at Body.
 */
export const structureTreeRootLabel = "Home Page";

export const structureTreeRoot: StructureTreeNodeData = {
  id: "body",
  label: "Body",
  children: [
    { id: "header", label: "Header" },
    { id: "hero", label: "Hero" },
    { id: "features", label: "Features" },
    { id: "footer", label: "Footer" },
  ],
};
