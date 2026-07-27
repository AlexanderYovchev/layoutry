import { cn } from "@/lib/utils";

interface InspectorSegmentedRowProps {
  label: string;
  options: string[];
  activeOption: string;
  /** Makes each option a real clickable control instead of a plain display span (Checkpoint 3.4.4) — omitted for the CSS Inspector's still-static demo scaffold in InspectorContent.tsx, which stays purely presentational. */
  onSelect?: (option: string) => void;
}

export function InspectorSegmentedRow({
  label,
  options,
  activeOption,
  onSelect,
}: InspectorSegmentedRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className="flex overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
        {options.map((option) => {
          const className = cn(
            "px-2 py-1",
            option === activeOption
              ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
              : "text-zinc-500 dark:text-zinc-400",
          );

          if (!onSelect) {
            return (
              <span key={option} className={className}>
                {option}
              </span>
            );
          }

          return (
            <button
              key={option}
              type="button"
              className={cn(className, "hover:bg-zinc-50 dark:hover:bg-zinc-800/50")}
              aria-pressed={option === activeOption}
              onClick={() => onSelect(option)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
