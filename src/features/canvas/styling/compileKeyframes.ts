import type { CssDeclaration } from "@/features/canvas/types/documentDefaultStyle";
import {
  plain,
  validatedDeclarations,
  validatedFoundation,
} from "@/features/canvas/styling/compileNodeStyle";
import {
  foundationDeclarations,
  physicalGroupStyle,
  type GroupDeclarationContext,
} from "@/features/canvas/styling/groupDeclarations";
import { keyframesCssIdentifiers } from "@/features/canvas/styling/keyframes";
import type { StyleDiagnostic } from "@/features/canvas/styling/styleIr";
import type { KeyframesDefinition } from "@/features/editor/types/styleAssets";

/*
 * BC-17.3.1 QA-4 — compiles the REFERENCED keyframes definitions, once each,
 * for every surface (see keyframes.ts for the foundation boundary). A stop's
 * groups go through the same group → declaration path and value
 * validation as rule groups; a refused value is dropped with a diagnostic.
 */

export interface CompiledKeyframes {
  definitionId: string;
  /** The CSS identifier (k-…), as animation-name will reference it. */
  name: string;
  /** Stops in ascending offset order. */
  stops: { offset: number; declarations: CssDeclaration[] }[];
}

const KEYFRAME_NODE = { id: "__keyframes", tag: "div" } as const;

export function compileKeyframes(
  definitions: readonly KeyframesDefinition[],
  referencedIds: readonly string[],
  context: GroupDeclarationContext,
  report: (diagnostic: StyleDiagnostic) => void = () => {},
): CompiledKeyframes[] {
  const referenced = new Set(referencedIds);
  if (referenced.size === 0) return [];
  const identifiers = keyframesCssIdentifiers(definitions);
  const compiled: CompiledKeyframes[] = [];
  // Definition order (not reference order), so the output is stable however references move.
  for (const definition of definitions) {
    if (!referenced.has(definition.id)) continue;
    const name = identifiers.get(definition.id);
    if (!name) continue;
    const stops = [...definition.stops]
      .sort((a, b) => a.offset - b.offset)
      .map((stop) => ({
        offset: stop.offset,
        declarations: [
          ...plain(
            validatedDeclarations(
              definition.id,
              physicalGroupStyle(KEYFRAME_NODE, stop.groups, context),
              report,
            ),
          ),
          ...plain(
            validatedFoundation(
              definition.id,
              foundationDeclarations(stop.groups, context, {
                logicalInsets: true,
                logicalSize: true,
              }),
              report,
            ),
          ),
        ],
      }));
    compiled.push({ definitionId: definition.id, name, stops });
  }
  return compiled;
}
