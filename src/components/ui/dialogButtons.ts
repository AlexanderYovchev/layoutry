// Dialog button styles, built only from the existing Bright Studio tokens
// used across the header. Introduced for the project dialogs (PROJECT-1.2);
// shared with the code export dialog since EXPORT-1.4.
const base =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-control px-3 text-sm font-medium transition-[background-color,border-color,filter] duration-150 ease-studio focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60";

export const primaryButtonClass = `${base} bg-accent text-white hover:brightness-110 active:brightness-95`;

export const secondaryButtonClass = `${base} border border-line bg-surface-panel text-fg-primary hover:bg-surface-hover active:bg-surface-selected`;

export const dangerButtonClass = `${base} bg-red-600 text-white hover:bg-red-700 active:bg-red-800`;

export const dialogFooterClass = "mt-4 flex flex-wrap justify-end gap-2";
