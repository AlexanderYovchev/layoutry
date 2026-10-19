/**
 * The shared look of every Inspector text input, number field and native
 * select (UI-1.5): one height, radius, border, focus ring and disabled
 * treatment, built on the editor's semantic tokens. Call sites add only
 * their own layout classes (width, padding, alignment) via cn(), so a
 * future restyle of Inspector fields happens here, once.
 */
export const inspectorFieldClassName =
  "h-7 rounded-control-sm border border-line bg-surface-panel text-xs text-fg-primary transition-colors duration-150 ease-studio placeholder:text-fg-muted hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-50";
