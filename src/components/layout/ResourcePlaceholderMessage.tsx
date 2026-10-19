import type { LucideIcon } from "lucide-react";

interface ResourcePlaceholderMessageProps {
  icon: LucideIcon;
  description: string;
}

/** Honest empty state for a Resource panel section that isn't built yet — no fake entries. */
export function ResourcePlaceholderMessage({
  icon: Icon,
  description,
}: ResourcePlaceholderMessageProps) {
  return (
    <div className="animate-fade-in flex flex-col items-center gap-3 px-3 py-10 text-center">
      <span
        aria-hidden="true"
        className="border-line bg-surface-panel-secondary text-fg-secondary flex size-11 items-center justify-center rounded-full border"
      >
        <Icon className="size-5" />
      </span>
      <span className="border-line text-fg-secondary rounded-full border px-2 py-0.5 text-[11px] font-medium">
        Not available yet
      </span>
      <p className="text-fg-secondary max-w-56 text-sm">{description}</p>
    </div>
  );
}
