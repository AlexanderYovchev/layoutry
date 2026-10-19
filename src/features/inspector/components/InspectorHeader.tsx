interface InspectorHeaderProps {
  statusLabel: string;
}

export function InspectorHeader({ statusLabel }: InspectorHeaderProps) {
  return (
    <div className="border-line-subtle shrink-0 border-b px-3 py-2.5">
      <h2 className="text-fg-primary text-sm font-semibold">Inspector</h2>
      <p className="text-fg-secondary mt-0.5 text-xs">{statusLabel}</p>
    </div>
  );
}
