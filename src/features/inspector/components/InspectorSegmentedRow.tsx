import { cn } from "@/lib/utils";

interface InspectorSegmentedRowProps {
  label: string;
  options: string[];
  activeOption: string;
}

export function InspectorSegmentedRow({
  label,
  options,
  activeOption,
}: InspectorSegmentedRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className="flex overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
        {options.map((option) => (
          <span
            key={option}
            className={cn(
              "px-2 py-1",
              option === activeOption
                ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                : "text-zinc-400 dark:text-zinc-600",
            )}
          >
            {option}
          </span>
        ))}
      </div>
    </div>
  );
}
