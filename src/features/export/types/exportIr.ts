import type { CssDeclaration, DocumentDefaultStyleId } from "@/features/canvas";
import type { InteractionAction, InteractionTrigger } from "@/features/editor/types/interactions";
import type { ExportBehaviors } from "@/features/export/types/exportBehavior";
import type { ExportDiagnostic } from "@/features/export/types/exportDiagnostic";

/*
 * Export IR (EXPORT-1.2) — the target-independent description of an
 * authored page that every printer (HTML/CSS now; Tailwind, React and Vue
 * later) reads. It holds the authored design, already sanitized: tags,
 * validated attribute values, raw (unescaped) text, the default
 * presentations a node receives and its own ordered CSS declarations.
 * It holds no editor runtime state and no printer concerns — escaping,
 * class names and file layout belong to the printers.
 */

/** `true` is a boolean attribute (`<input checked>`); a string is its value, unescaped. */
export type ExportAttributeValue = string | true;

export interface ExportAttribute {
  name: string;
  value: ExportAttributeValue;
}

export interface ExportElement {
  kind: "element";
  /** Real HTML (or SVG) tag name. */
  tag: string;
  /** The editor node this element was generated from (a media frame and its inner element share one). */
  sourceNodeId: string;
  /** Stable, document-order identity for this element's own rule, e.g. "node-3" or "node-3-media". */
  styleKey: string;
  /** Default presentations, in documentDefaultStyles table order. */
  defaultStyles: DocumentDefaultStyleId[];
  /** This element's own authored declarations, in cascade order (a later declaration wins). */
  declarations: CssDeclaration[];
  attributes: ExportAttribute[];
  /** Authored class tokens, validated, appended after generated classes. */
  authoredClassNames: string[];
  children: ExportNode[];
}

export interface ExportText {
  kind: "text";
  /** Raw text — printers escape it for their own syntax. */
  text: string;
}

export type ExportNode = ExportElement | ExportText;

/** An authored click binding, kept for the EXPORT-1.3 interaction runtime. */
export interface ExportInteraction {
  triggerNodeId: string;
  targetNodeId: string;
  trigger: InteractionTrigger;
  action: InteractionAction;
}

/**
 * "packaged" (BC-07.3): an embedded raster image written as its own file
 * in the export's assets folder; `url` is then that file's relative path.
 */
export type ExportAssetKind = "remote" | "relative" | "data" | "packaged";

/** A URL the exported page loads at view time. */
export interface ExportAsset {
  nodeId: string;
  /** Attribute or CSS property that references it. */
  property: string;
  url: string;
  kind: ExportAssetKind;
}

export interface ExportDocument {
  root: ExportElement;
  /** Every default presentation used anywhere, in table order — the base rules a printer must emit. */
  defaultStyles: DocumentDefaultStyleId[];
  /** The authored click bindings, raw. */
  interactions: ExportInteraction[];
  /** What those bindings do at runtime — the input of every interaction runtime (EXPORT-1.3). */
  behaviors: ExportBehaviors;
  assets: ExportAsset[];
  /** Image files a "separate" export ships in its assets folder (BC-07.3); empty otherwise. */
  assetFiles: ExportAssetFile[];
  diagnostics: ExportDiagnostic[];
}

/** One packaged image file (BC-07.3): the exact embedded bytes, under an engine-chosen name. */
export interface ExportAssetFile {
  /** Relative path inside the export, e.g. "assets/image-001.png". */
  path: string;
  bytes: Uint8Array;
  mediaType: string;
  /** How many source references (img src, poster, background image) point at it. */
  references: number;
}
