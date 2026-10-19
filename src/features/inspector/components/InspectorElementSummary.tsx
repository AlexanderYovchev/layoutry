import { Box } from "lucide-react";

interface InspectorElementSummaryProps {
  name: string;
  tag: string;
}

export function InspectorElementSummary({
  name,
  tag,
}: InspectorElementSummaryProps) {
  return (
    <div className="border-line-subtle bg-surface-panel flex shrink-0 items-center gap-2.5 border-b px-3 py-2.5">
      <Box
        aria-hidden="true"
        className="rounded-control bg-surface-selected text-accent size-8 shrink-0 p-2"
      />
      <div className="min-w-0">
        <p className="text-fg-primary truncate text-sm font-semibold">{name}</p>
        <p className="text-fg-secondary truncate font-mono text-xs">{tag}</p>
      </div>
    </div>
  );
}
