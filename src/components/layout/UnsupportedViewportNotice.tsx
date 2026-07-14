import { MonitorSmartphone } from "lucide-react";

export function UnsupportedViewportNotice() {
  return (
    <div
      role="status"
      className="flex h-dvh w-full flex-col items-center justify-center gap-3 bg-white px-6 text-center dark:bg-black"
    >
      <MonitorSmartphone
        aria-hidden="true"
        className="size-8 text-zinc-300 dark:text-zinc-600"
      />
      <p className="text-base font-medium text-zinc-700 dark:text-zinc-300">
        Layoutry currently works best on a larger screen.
      </p>
      <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        Expand your browser window or use a desktop-sized display to continue
        editing.
      </p>
    </div>
  );
}
