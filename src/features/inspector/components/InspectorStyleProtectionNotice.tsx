import { Lock } from "lucide-react";
import { getReadableNodeName, type StyleProtectionResult } from "@/features/editor/rules/styleProtection";

interface InspectorStyleProtectionNoticeProps {
  protection: StyleProtectionResult;
}

/**
 * "🔒 Child styles locked by "Hero" / Unlock the parent to edit CSS."
 * (Checkpoint 1.15.3, sections 24-25) — rendered above the CSS Inspector
 * sections, which stay VISIBLE but disabled (see InspectorProtectedStyleGroup)
 * rather than hidden entirely, so a protected element never looks like it
 * lacks these capabilities — it's a temporary editor restriction, not a
 * capability restriction.
 */
export function InspectorStyleProtectionNotice({ protection }: InspectorStyleProtectionNoticeProps) {
  if (!protection.protected) return null;
  const name = getReadableNodeName(protection.lockingAncestor);

  return (
    <div
      role="status"
      className="mx-3 mb-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
    >
      <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <p>
        Child styles locked by &ldquo;{name}&rdquo;. Unlock the parent to edit CSS.
      </p>
    </div>
  );
}
