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
    <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 px-3 py-2.5 dark:border-zinc-800">
      <Box
        aria-hidden="true"
        className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {name}
        </p>
        <p className="truncate font-mono text-xs text-zinc-400 dark:text-zinc-500">
          {tag}
        </p>
      </div>
    </div>
  );
}
