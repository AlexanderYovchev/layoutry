interface InspectorFieldRowProps {
  label: string;
  value: string;
}

export function InspectorFieldRow({ label, value }: InspectorFieldRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-fg-secondary">{label}</span>
      <span className="rounded-control-sm border-line-subtle bg-surface-panel-secondary text-fg-secondary flex h-7 min-w-16 items-center justify-end truncate border px-2 text-right font-mono text-[11px]">
        {value}
      </span>
    </div>
  );
}
