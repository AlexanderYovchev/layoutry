import { MonitorSmartphone } from "lucide-react";

export function UnsupportedViewportNotice() {
  return (
    // This replaces the entire application shell (header, panels, etc.)
    // while shown, so it's the page's own landmark and top-level heading —
    // never rendered at the same time as AppShell's normal h1 wordmark.
    <main className="flex h-dvh w-full flex-col items-center justify-center gap-3 bg-white px-6 text-center dark:bg-black">
      <MonitorSmartphone
        aria-hidden="true"
        className="size-8 text-zinc-300 dark:text-zinc-600"
      />
      {/* display:contents keeps this purely a semantic grouping — it
          doesn't participate in the flex layout above, so the icon/
          heading/paragraph gap is unaffected. */}
      <div role="status" className="contents">
        <h1 className="text-base font-medium text-zinc-700 dark:text-zinc-300">
          Layoutry currently works best on a larger screen.
        </h1>
        <p className="max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
          Expand your browser window or use a desktop-sized display to continue
          editing.
        </p>
      </div>
    </main>
  );
}
