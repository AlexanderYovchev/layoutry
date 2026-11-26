import { z } from "zod";
import { BORDER_STYLE_VALUES } from "@/features/editor/types/border";

/**
 * Value schemas shared by the document schema (editorDocumentSchema.ts)
 * and the BC-17.2 styling foundation schemas (stylingFoundationSchemas.ts).
 * Moved here unchanged from editorDocumentSchema.ts so both can use them
 * without a circular import.
 */

export const finite = z.number();

export const cssUnitSchema = z.enum([
  "px",
  "%",
  "rem",
  "em",
  "vw",
  "vh",
  "unitless",
  "deg",
]);
export const cssLengthSchema = z.strictObject({
  value: finite,
  unit: cssUnitSchema,
});

export const borderSideSchema = z.strictObject({
  width: cssLengthSchema.optional(),
  style: z.enum(BORDER_STYLE_VALUES).optional(),
  color: z.string().optional(),
});

export const offsetSchema = z.union([cssLengthSchema, z.literal("auto")]);
