import { compileNodeStyle } from "@/features/canvas/styling/compileNodeStyle";
import { hasInnerMediaElement } from "@/features/canvas/styling/resolveNodeStyleRecipe";
import {
  printStyleRule,
  ruleOrderKey,
} from "@/features/canvas/styling/printStyleRules";
import type {
  NodeStyleIR,
  StyleDiagnostic,
  StyleSurface,
} from "@/features/canvas/styling/styleIr";
import { counterCssIdentifiers } from "@/features/editor/types/counters";
import type { EditorElementNode } from "@/features/editor/types/document";
import {
  getFlowLayoutSettings,
  type FlowDisplayMode,
} from "@/features/editor/types/flowLayout";
import {
  getLayoutMode,
  type ContainerLayoutMode,
} from "@/features/editor/types/layout";
import { styleTargetKind } from "@/features/editor/types/styleRules";

/*
 * BC-17.3 — incremental document compilation for the Design and Preview
 * surfaces (BC-17.1.3 Report 1 §8.4): a per-node IR cache and the
 * dependency rules that decide what an edit recompiles.
 *
 * - The store is immutable, so an unchanged subtree is the same object:
 *   it is skipped whole (when its parent context is unchanged too).
 * - A node whose object changed only because a descendant changed (the
 *   immutable path to the root is recreated) is NOT recompiled: its style
 *   inputs are compared field by field, ignoring children and content.
 * - Dependants: children recompile when the parent's layout mode or flow
 *   display changes; a rule scoped to an ancestor depends on the ancestor
 *   path; a Pagination's role-group rules depend on its children; counter
 *   references depend on the document's counter definitions.
 * - Deleted and moved nodes: entries no longer in the document are
 *   removed with their whole subtree; a moved node is recompiled in its
 *   new context.
 * - Live gestures (Report 1 §8.11): for the nodes a live geometry gesture
 *   is writing, the COMMITTED node (from the gesture's starting snapshot)
 *   is compiled, so the sheet never changes during pointer movement; the
 *   live slice is painted as an inline override by the node itself.
 */

/** A node's printed rules: order key → rule texts, each one CSS rule (one CSSOM insertRule). */
export type NodeChunks = ReadonlyMap<number, readonly string[]>;

export interface LiveGestureView {
  /** Nodes whose geometry slice the gesture writes. */
  nodeIds: ReadonlySet<string>;
  /** The node as committed when the gesture began. */
  committedNode: (nodeId: string) => EditorElementNode | undefined;
}

export interface StyleSheetChange {
  /** Nodes whose printed chunks changed (null = removed). */
  changed: Map<string, NodeChunks | null>;
}

export function documentNodeClass(nodeId: string): string {
  return `ly-n-${nodeId}`;
}

export function documentInnerClass(nodeId: string): string {
  return `ly-ni-${nodeId}`;
}

/** Fields that never affect a node's own CSS (content, behaviour, children). */
const NON_STYLE_KEYS: ReadonlySet<string> = new Set([
  "children",
  "text",
  "displayName",
  "svgKind",
  "svgViewBox",
  "svgFill",
  "svgStroke",
  "svgStrokeWidth",
  "svgScene",
  "interactions",
  "initialPreviewVisibility",
  "htmlId",
  "className",
  "src",
  "href",
  "poster",
  "controls",
  "autoplay",
  "muted",
  "loop",
  "name",
  "placeholder",
  "value",
  "checked",
  "selected",
  "title",
  "progressValue",
  "progressMax",
  "progressLabel",
  "ariaLabel",
  "ariaCurrent",
  "disabled",
  "lockChildStyles",
  "dir",
]);

function styleInputsEqual(a: EditorElementNode, b: EditorElementNode): boolean {
  if (a === b) return true;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (NON_STYLE_KEYS.has(key)) continue;
    if (Reflect.get(a, key) !== Reflect.get(b, key)) return false;
  }
  return true;
}

function hasRoleGroupRules(node: EditorElementNode): boolean {
  return (node.styleRules ?? []).some(
    (rule) => styleTargetKind(rule.target) === "role-group",
  );
}

function hasAncestorRules(node: EditorElementNode): boolean {
  return (node.styleRules ?? []).some(
    (rule) => rule.condition.ancestor !== undefined,
  );
}

/** A small, stable hash of the ancestor path (ids and the fields that decide profiles and component roots). */
function pathHash(parent: number, node: EditorElementNode): number {
  let hash = parent ^ 0x811c9dc5;
  const text = `${node.id}|${node.tag}|${node.component ?? ""}|${node.inputType ?? ""}|${node.progressVariant ?? ""}`;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

interface Entry {
  sourceNode: EditorElementNode;
  compiledNode: EditorElementNode;
  skipKey: string;
  ownKey: string;
  childIds: string[];
  ir: NodeStyleIR;
  chunks: NodeChunks;
}

function chunksOf(ir: NodeStyleIR, scope: string | undefined): NodeChunks {
  const chunks = new Map<number, string[]>();
  for (const rule of ir.rules) {
    const key = ruleOrderKey(rule);
    const list = chunks.get(key) ?? [];
    list.push(printStyleRule(rule, scope));
    chunks.set(key, list);
  }
  return chunks;
}

function chunksEqual(a: NodeChunks, b: NodeChunks): boolean {
  if (a.size !== b.size) return false;
  for (const [key, texts] of a) {
    const other = b.get(key);
    if (
      !other ||
      other.length !== texts.length ||
      texts.some((text, index) => other[index] !== text)
    )
      return false;
  }
  return true;
}

export interface CompilerStats {
  visited: number;
  compiled: number;
  changed: number;
  removed: number;
}

export class DocumentStyleCompiler {
  private entries = new Map<string, Entry>();
  private counterSource: unknown = null;
  private counterIdentifiers: ReadonlyMap<string, string> = new Map();
  private countersEpoch = 0;
  private rootId: string | null = null;
  /** The nodes compiled from their committed state in the previous update (a live gesture). */
  private lastLiveIds: ReadonlySet<string> = new Set();
  lastStats: CompilerStats = {
    visited: 0,
    compiled: 0,
    changed: 0,
    removed: 0,
  };

  constructor(
    readonly surface: Exclude<StyleSurface, "export">,
    /** The owning surface's data-ly-sheet token (StyleSheetHost); omitted in pure tests. */
    readonly scope?: string,
  ) {}

  /** Brings the cache up to date with `document` and reports which nodes' chunks changed. */
  update(
    document: EditorElementNode,
    live?: LiveGestureView,
  ): StyleSheetChange {
    const change: StyleSheetChange = { changed: new Map() };
    // A different document (another project): nothing cached applies.
    if (document.id !== this.rootId) {
      for (const id of this.entries.keys()) change.changed.set(id, null);
      this.entries.clear();
      this.rootId = document.id;
    }
    // Counter identifiers are document-wide: a change re-checks every node (rare: only definition edits).
    let forceAll = this.entries.size === 0;
    const counters = document.styleAssets?.counters;
    if (counters !== this.counterSource) {
      this.counterSource = counters;
      this.counterIdentifiers = counterCssIdentifiers(counters ?? []);
      this.countersEpoch += 1;
      forceAll = true;
    }
    // A node that just left the live set was cached from its COMMITTED
    // state although its source node is the live one; a gesture commit
    // keeps the very same document object, so the unchanged-subtree skip
    // would never reach it. Revisit everything once (each node still only
    // recompiles if its own inputs differ).
    const liveIds = live?.nodeIds ?? new Set<string>();
    const liveEnded = [...this.lastLiveIds].some((id) => !liveIds.has(id));
    this.lastLiveIds = new Set(liveIds);
    const visited = new Set<string>();
    const removalCandidates: string[] = [];
    const stats: CompilerStats = {
      visited: 0,
      compiled: 0,
      changed: 0,
      removed: 0,
    };

    const visit = (
      node: EditorElementNode,
      parentLayoutMode: ContainerLayoutMode,
      parentFlowDisplay: FlowDisplayMode,
      ancestors: EditorElementNode[],
      parentPath: number,
    ) => {
      visited.add(node.id);
      stats.visited += 1;
      const path = pathHash(parentPath, node);
      const skipKey = `${parentLayoutMode}|${parentFlowDisplay}|${parentPath}`;
      const entry = this.entries.get(node.id);
      const isLive = live?.nodeIds.has(node.id) === true;
      if (
        !forceAll &&
        !liveEnded &&
        !isLive &&
        entry &&
        entry.sourceNode === node &&
        entry.skipKey === skipKey
      )
        return;

      const effective = (isLive && live?.committedNode(node.id)) || node;
      const ownKey = this.ownKey(
        effective,
        parentLayoutMode,
        parentFlowDisplay,
        parentPath,
      );
      const strict = hasRoleGroupRules(effective);
      let ir = entry?.ir;
      let chunks = entry?.chunks;
      const needsCompile =
        !entry ||
        entry.ownKey !== ownKey ||
        (strict
          ? entry.compiledNode !== effective
          : !styleInputsEqual(entry.compiledNode, effective));
      if (needsCompile || !ir || !chunks) {
        stats.compiled += 1;
        ir = compileNodeStyle({
          node: effective,
          ancestors,
          parentLayoutMode,
          parentFlowDisplay,
          surface: this.surface,
          nodeClass: documentNodeClass(node.id),
          ...(hasInnerMediaElement(node)
            ? { innerClass: documentInnerClass(node.id) }
            : {}),
          classFor: documentNodeClass,
          counterIdentifiers: this.counterIdentifiers,
          includeDefaults: true,
        });
        const next = chunksOf(ir, this.scope);
        if (!chunks || !chunksEqual(chunks, next)) {
          change.changed.set(node.id, next);
          stats.changed += 1;
        }
        chunks = next;
      }
      const childIds = (node.children ?? []).map((child) => child.id);
      if (entry)
        for (const id of entry.childIds)
          if (!childIds.includes(id)) removalCandidates.push(id);
      this.entries.set(node.id, {
        sourceNode: node,
        compiledNode: effective,
        skipKey,
        ownKey,
        childIds,
        ir,
        chunks,
      });

      const childLayoutMode = getLayoutMode(node);
      // A Free container's retained flowLayout never reaches its children (see DocumentNodeRenderer).
      const childFlowDisplay: FlowDisplayMode =
        childLayoutMode === "free"
          ? "block"
          : getFlowLayoutSettings(node).display;
      const nextAncestors = [...ancestors, node];
      for (const child of node.children ?? [])
        visit(child, childLayoutMode, childFlowDisplay, nextAncestors, path);
    };

    visit(document, "flow", "block", [], 0);

    const remove = (id: string) => {
      if (visited.has(id)) return;
      const entry = this.entries.get(id);
      if (!entry) return;
      this.entries.delete(id);
      change.changed.set(id, null);
      stats.removed += 1;
      for (const child of entry.childIds) remove(child);
    };
    for (const id of removalCandidates) remove(id);
    this.lastStats = stats;
    return change;
  }

  private ownKey(
    node: EditorElementNode,
    parentLayoutMode: ContainerLayoutMode,
    parentFlowDisplay: FlowDisplayMode,
    parentPath: number,
  ): string {
    let key = `${parentLayoutMode}|${parentFlowDisplay}`;
    if (hasAncestorRules(node)) key += `|p${parentPath}`;
    const refersToCounters =
      node.counters !== undefined ||
      (node.styleRules ?? []).some(
        (rule) =>
          rule.groups.counters !== undefined || rule.content?.kind === "parts",
      );
    if (refersToCounters) key += `|c${this.countersEpoch}`;
    return key;
  }

  /** Every node's current chunks (id → order key → CSS). */
  chunks(): ReadonlyMap<string, NodeChunks> {
    return new Map([...this.entries].map(([id, entry]) => [id, entry.chunks]));
  }

  /** The current IR of a node (tests, diagnostics). */
  irOf(nodeId: string): NodeStyleIR | undefined {
    return this.entries.get(nodeId)?.ir;
  }

  diagnostics(): StyleDiagnostic[] {
    return [...this.entries.values()].flatMap((entry) => entry.ir.diagnostics);
  }

  /** The whole sheet in canonical order: by order key, then node id. Identical for identical documents, however they were reached. */
  printSheet(): string {
    return printChunks(this.chunks());
  }
}

/** Canonical sheet text from chunks: ascending order key, then node id. */
export function printChunks(chunks: ReadonlyMap<string, NodeChunks>): string {
  const keys = new Set<number>();
  for (const nodeChunks of chunks.values())
    for (const key of nodeChunks.keys()) keys.add(key);
  const ids = [...chunks.keys()].sort();
  const parts: string[] = [];
  for (const key of [...keys].sort((a, b) => a - b))
    for (const id of ids) {
      const texts = chunks.get(id)?.get(key);
      if (texts !== undefined) parts.push(...texts);
    }
  return parts.join("\n");
}

/** A full, uncached compilation (the reference the incremental path is tested against). */
export function compileDocumentSheet(
  document: EditorElementNode,
  surface: Exclude<StyleSurface, "export">,
  scope?: string,
): string {
  const compiler = new DocumentStyleCompiler(surface, scope);
  compiler.update(document);
  return compiler.printSheet();
}
