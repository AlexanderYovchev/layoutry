interface InspectorFieldRowProps {
  label: string;
  value: string;
}

export function InspectorFieldRow({ label, value }: InspectorFieldRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="min-w-16 truncate rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-right text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500">
        {value}
      </span>
    </div>
  );
}
