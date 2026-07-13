import { Redo2, UserRound, Undo2 } from "lucide-react";

const menuItems = ["File", "Edit", "View", "Project", "Help"] as const;

export function AppHeader() {
  return (
    <header
      aria-label="Application menu bar"
      className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-black"
    >
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Layoutry
        </span>
        <nav aria-label="Application menu" className="flex items-center gap-3">
          {menuItems.map((item) => (
            <span
              key={item}
              className="text-sm text-zinc-600 dark:text-zinc-400"
            >
              {item}
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Untitled project
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">Saved</span>
        <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
          <span className="flex items-center gap-0.5">
            <Undo2 aria-hidden="true" className="size-4" />
            <span className="sr-only">Undo</span>
          </span>
          <span className="flex items-center gap-0.5">
            <Redo2 aria-hidden="true" className="size-4" />
            <span className="sr-only">Redo</span>
          </span>
        </div>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          Preview
        </span>
        <span className="flex items-center">
          <UserRound
            aria-hidden="true"
            className="size-6 rounded-full border border-zinc-300 p-0.5 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
          />
          <span className="sr-only">Account</span>
        </span>
      </div>
    </header>
  );
}
