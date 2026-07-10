export function AppHeader() {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-black">
      <div>
        <p className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Layoutry
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Build layouts visually. Own the code.
        </p>
      </div>
    </header>
  );
}
