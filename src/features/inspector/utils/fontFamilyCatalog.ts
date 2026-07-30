/**
 * The Font Family field's built-in catalog (Checkpoint 4.2) — every entry
 * is a real, immediately-usable CSS font-family value (with a sensible
 * fallback stack for the web-safe entries), not just a bare name, so
 * selecting one renders correctly with no further resolution step. Google
 * Fonts / remote font loading is explicitly out of scope for this
 * checkpoint (see the checkpoint report) — this list is deliberately
 * flat data (not fetched, not paginated) so a future integration can
 * append real remote-loaded entries to it without changing
 * InspectorFontFamilyField's rendering or filtering logic at all.
 */
export type FontFamilyCategory = "system" | "generic" | "web-safe";

export interface FontFamilyOption {
  /** The display name shown in the dropdown and as the field's current value label. */
  label: string;
  /** The literal CSS font-family value committed to the document model — already includes a fallback stack for web-safe entries. */
  value: string;
  category: FontFamilyCategory;
}

export const FONT_FAMILY_OPTIONS: FontFamilyOption[] = [
  { label: "System UI", value: "system-ui, -apple-system, sans-serif", category: "system" },
  { label: "Serif", value: "serif", category: "generic" },
  { label: "Sans-serif", value: "sans-serif", category: "generic" },
  { label: "Monospace", value: "monospace", category: "generic" },
  { label: "Inter", value: "Inter, system-ui, -apple-system, sans-serif", category: "web-safe" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif", category: "web-safe" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif", category: "web-safe" },
  { label: "Roboto", value: "Roboto, system-ui, sans-serif", category: "web-safe" },
  { label: "Open Sans", value: '"Open Sans", system-ui, sans-serif', category: "web-safe" },
  { label: "Georgia", value: 'Georgia, "Times New Roman", serif', category: "web-safe" },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif', category: "web-safe" },
  { label: "Courier New", value: '"Courier New", Courier, monospace', category: "web-safe" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif", category: "web-safe" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif", category: "web-safe" },
  { label: "Trebuchet MS", value: '"Trebuchet MS", sans-serif', category: "web-safe" },
];

/** The catalog entry (if any) whose committed CSS value exactly matches — used to show the friendly label for a value the catalog already knows, falling back to the raw CSS value itself for a custom/future-Google-Fonts entry the catalog doesn't recognize. */
export function findFontFamilyOption(value: string): FontFamilyOption | undefined {
  return FONT_FAMILY_OPTIONS.find((option) => option.value === value);
}
