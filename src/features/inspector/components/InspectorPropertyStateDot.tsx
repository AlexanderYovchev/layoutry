import { cn } from "@/lib/utils";
import { PROPERTY_STATE_DESCRIPTIONS, type PropertyState } from "@/features/inspector/types/propertyState";

function stateDotClassName(state: PropertyState): string {
  switch (state) {
    case "set":
      return "bg-blue-500";
    case "invalid":
      return "bg-red-500";
    case "mixed":
      return "bg-amber-500";
    case "inherited":
      return "bg-zinc-400 dark:bg-zinc-500";
    case "not-applicable":
    case "overridden":
      return "bg-zinc-300 dark:bg-zinc-700";
    case "unset":
    default:
      return "hidden";
  }
}

/**
 * The small property-state indicator dot (Checkpoint 4.2 — extracted from
 * InspectorPropertyRow once InspectorSegmentedRow needed the identical
 * affordance for properties like Font Weight/Style/Alignment that don't
 * go through InspectorPropertyRow). aria-hidden; a paired sr-only
 * description does the actual accessible-name work. Renders nothing for
 * "unset", the common case, rather than an invisible placeholder.
 */
export function InspectorPropertyStateDot({ state }: { state: PropertyState }) {
  if (state === "unset") return null;
  return (
    <>
      <span
        aria-hidden="true"
        title={PROPERTY_STATE_DESCRIPTIONS[state]}
        className={cn("size-1.5 shrink-0 rounded-full", stateDotClassName(state))}
      />
      <span className="sr-only">{PROPERTY_STATE_DESCRIPTIONS[state]}</span>
    </>
  );
}
