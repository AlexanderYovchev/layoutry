import { SlidersHorizontal } from "lucide-react";

export function InspectorPlaceholder() {
  return (
    <div className="animate-fade-in flex flex-col items-center gap-2 text-center">
      <SlidersHorizontal
        aria-hidden="true"
        className="border-line bg-surface-panel-secondary text-fg-secondary size-11 rounded-full border p-3"
      />
      <h3 className="text-fg-primary text-sm font-medium">
        No element selected
      </h3>
      <p className="text-fg-secondary max-w-56 text-sm">
        Select an element on the canvas to view and edit its properties here.
      </p>
    </div>
  );
}
