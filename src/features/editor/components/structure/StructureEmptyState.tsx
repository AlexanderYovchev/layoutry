import { ListTree } from "lucide-react";

export function StructureEmptyState() {
  return (
    <div className="animate-fade-in flex flex-col items-center gap-3 px-4 py-8 text-center">
      <span
        aria-hidden="true"
        className="border-line bg-surface-panel-secondary text-fg-secondary flex size-11 items-center justify-center rounded-full border"
      >
        <ListTree className="size-5" />
      </span>
      <h3 className="text-fg-primary text-sm font-medium">No elements yet</h3>
      <p className="text-fg-secondary max-w-56 text-sm">
        Add a component from the library and it will appear here.
      </p>
    </div>
  );
}
