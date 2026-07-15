interface InspectorHeaderProps {
  statusLabel: string;
}

export function InspectorHeader({ statusLabel }: InspectorHeaderProps) {
  return (
    <div className="shrink-0 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Inspector
      </h2>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
        {statusLabel}
      </p>
    </div>
  );
}
