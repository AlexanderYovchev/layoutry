interface ResourcePlaceholderMessageProps {
  description: string;
}

export function ResourcePlaceholderMessage({
  description,
}: ResourcePlaceholderMessageProps) {
  return (
    <p className="px-1 text-sm text-zinc-400 dark:text-zinc-500">
      {description}
    </p>
  );
}
