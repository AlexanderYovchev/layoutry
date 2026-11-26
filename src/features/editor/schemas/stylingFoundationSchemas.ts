import { z } from "zod";
import {
  borderSideSchema,
  cssLengthSchema,
  finite,
  offsetSchema,
} from "@/features/editor/schemas/cssValueSchemas";
import {
  COUNTER_VALUE_LIMIT,
  MAX_COUNTER_OPERATIONS,
  PREDEFINED_COUNTER_STYLES,
  type CounterDefinition,
  type CounterOperations,
  type CounterRef,
  type CounterStyleRef,
} from "@/features/editor/types/counters";
import {
  CSS_DIRECTION_VALUES,
  HTML_DIR_VALUES,
  TEXT_ORIENTATION_VALUES,
  UNICODE_BIDI_VALUES,
  WRITING_MODE_VALUES,
  type LogicalBorderSides,
  type LogicalEdgeValues,
  type LogicalOffsets,
  type LogicalRadii,
  type LogicalSizeSettings,
} from "@/features/editor/types/logicalProperties";
import {
  OUTLINE_STYLE_VALUES,
  type OutlineSettings,
} from "@/features/editor/types/outline";
import {
  findProgressTemplateError,
  isWellFormedLocaleTag,
  MAX_PROGRESS_FRACTION_DIGITS,
  MAX_PROGRESS_INDETERMINATE_TEXT_LENGTH,
  MAX_PROGRESS_SEGMENTS,
  MIN_PROGRESS_SEGMENTS,
  PROGRESS_LABEL_KINDS,
  PROGRESS_VARIANTS,
  type ProgressLabel,
  type ProgressSegments,
} from "@/features/editor/types/progress";
import {
  isValidAssetName,
  MAX_ASSET_NAME_LENGTH,
} from "@/features/editor/types/styleAssets";
import {
  GLYPH_IDS,
  MAX_CONTENT_PARTS,
  MAX_CONTENT_TEXT_LENGTH,
  STATE_ATOMS,
  STYLE_TARGET_IDS,
  STYLING_PROFILES,
  stateAtomRank,
  type ContentPart,
  type PseudoContent,
  type StyleCondition,
} from "@/features/editor/types/styleRules";

/**
 * BC-17.2 — strict schemas for the styling foundation (project format 4,
 * revision 0). Local structure only; document-wide rules (unique rule
 * ids, one rule per (target, condition), counter references resolving,
 * unique asset names, assets only on the root) are in
 * rules/stylingIntegrity.ts.
 */

/** Asset and rule ids: the same safe alphabet as node ids. */
export const ASSET_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const assetId = z.string().regex(ASSET_ID_PATTERN, { message: "invalid id" });

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const safeText = (max: number) =>
  z
    .string()
    .max(max)
    .refine((text) => !CONTROL_CHARACTERS.test(text), {
      message: "must not contain control characters",
    });

export const assetNameSchema = z.string().refine(isValidAssetName, {
  message: `a name must be 1–${MAX_ASSET_NAME_LENGTH} characters, not blank, with no control characters`,
});

// --- Targets and conditions ----------------------------------------------

export const styleTargetIdSchema = z.enum(STYLE_TARGET_IDS);
export const stateAtomSchema = z.enum(STATE_ATOMS);

const ancestorScopeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("parent") }),
  z.strictObject({ kind: z.literal("component") }),
  z.strictObject({
    kind: z.literal("profile"),
    profile: z.enum(STYLING_PROFILES),
  }),
]);

export const styleConditionSchema = z
  .strictObject({
    self: z.array(stateAtomSchema).optional(),
    ancestor: z
      .strictObject({ scope: ancestorScopeSchema, atom: stateAtomSchema })
      .optional(),
  })
  .superRefine((condition, context) => {
    const self = condition.self;
    if (self === undefined) return;
    if (self.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["self"],
        message: "an empty state list must be omitted",
      });
      return;
    }
    for (let index = 1; index < self.length; index += 1) {
      const order = stateAtomRank(self[index]) - stateAtomRank(self[index - 1]);
      if (order === 0)
        context.addIssue({
          code: "custom",
          path: ["self", index],
          message: `state "${self[index]}" is listed twice`,
        });
      else if (order < 0)
        context.addIssue({
          code: "custom",
          path: ["self", index],
          message: "states must be listed in canonical order",
        });
    }
  });

// --- Counters ------------------------------------------------------------

export const counterRefSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("document"), id: assetId }),
  z.strictObject({ kind: z.literal("builtin"), name: z.literal("list-item") }),
]);

const counterStyleRefSchema = z.strictObject({
  kind: z.literal("predefined"),
  style: z.enum(PREDEFINED_COUNTER_STYLES),
});

const counterValue = z.int().min(-COUNTER_VALUE_LIMIT).max(COUNTER_VALUE_LIMIT);

function counterKey(ref: CounterRef): string {
  return ref.kind === "document" ? `document:${ref.id}` : `builtin:${ref.name}`;
}

const counterOperationListSchema = z
  .array(
    z.strictObject({
      counter: counterRefSchema,
      value: counterValue.optional(),
    }),
  )
  .min(1, { message: "an empty list must be omitted" })
  .max(MAX_COUNTER_OPERATIONS)
  .superRefine((operations, context) => {
    const seen = new Set<string>();
    operations.forEach((operation, index) => {
      const key = counterKey(operation.counter);
      if (seen.has(key))
        context.addIssue({
          code: "custom",
          path: [index, "counter"],
          message: "a counter may appear only once per list",
        });
      seen.add(key);
    });
  });

export const counterOperationsSchema = z.strictObject({
  reset: counterOperationListSchema.optional(),
  increment: counterOperationListSchema.optional(),
  set: counterOperationListSchema.optional(),
});

export const counterDefinitionSchema = z.strictObject({
  id: assetId,
  name: assetNameSchema,
});

// --- Generated content ----------------------------------------------------

const contentPartSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("text"),
    text: safeText(MAX_CONTENT_TEXT_LENGTH).min(1),
  }),
  z.strictObject({ kind: z.literal("glyph"), glyph: z.enum(GLYPH_IDS) }),
  z.strictObject({
    kind: z.literal("counter"),
    counter: counterRefSchema,
    style: counterStyleRefSchema,
  }),
  z.strictObject({
    kind: z.literal("counters"),
    counter: counterRefSchema,
    separator: safeText(MAX_CONTENT_TEXT_LENGTH),
    style: counterStyleRefSchema,
  }),
]);

export const pseudoContentSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("empty") }),
  z
    .strictObject({
      kind: z.literal("parts"),
      parts: z.array(contentPartSchema).min(1).max(MAX_CONTENT_PARTS),
      altText: safeText(MAX_CONTENT_TEXT_LENGTH).optional(),
    })
    .superRefine((content, context) => {
      const textLength =
        content.parts.reduce(
          (total, part) =>
            total +
            (part.kind === "text"
              ? part.text.length
              : part.kind === "counters"
                ? part.separator.length
                : 0),
          0,
        ) + (content.altText?.length ?? 0);
      if (textLength > MAX_CONTENT_TEXT_LENGTH)
        context.addIssue({
          code: "custom",
          path: ["parts"],
          message: `generated text is at most ${MAX_CONTENT_TEXT_LENGTH} characters in total`,
        });
    }),
]);

// --- Outline and logical properties ---------------------------------------

export const outlineSchema = z.strictObject({
  width: cssLengthSchema.optional(),
  style: z.enum(OUTLINE_STYLE_VALUES).optional(),
  color: z.string().optional(),
  offset: cssLengthSchema.optional(),
});

export const logicalEdgeValuesSchema = z.strictObject({
  blockStart: finite.optional(),
  blockEnd: finite.optional(),
  inlineStart: finite.optional(),
  inlineEnd: finite.optional(),
});
export const logicalOffsetsSchema = z.strictObject({
  blockStart: offsetSchema.optional(),
  blockEnd: offsetSchema.optional(),
  inlineStart: offsetSchema.optional(),
  inlineEnd: offsetSchema.optional(),
});
export const logicalBorderSidesSchema = z.strictObject({
  blockStart: borderSideSchema.optional(),
  blockEnd: borderSideSchema.optional(),
  inlineStart: borderSideSchema.optional(),
  inlineEnd: borderSideSchema.optional(),
});
export const logicalRadiiSchema = z.strictObject({
  startStart: cssLengthSchema.optional(),
  startEnd: cssLengthSchema.optional(),
  endStart: cssLengthSchema.optional(),
  endEnd: cssLengthSchema.optional(),
});
export const logicalSizeSchema = z.strictObject({
  inlineSize: cssLengthSchema.optional(),
  blockSize: cssLengthSchema.optional(),
  minInlineSize: cssLengthSchema.optional(),
  maxInlineSize: cssLengthSchema.optional(),
  minBlockSize: cssLengthSchema.optional(),
  maxBlockSize: cssLengthSchema.optional(),
});

export const cssDirectionSchema = z.enum(CSS_DIRECTION_VALUES);
export const unicodeBidiSchema = z.enum(UNICODE_BIDI_VALUES);
export const writingModeSchema = z.enum(WRITING_MODE_VALUES);
export const textOrientationSchema = z.enum(TEXT_ORIENTATION_VALUES);
export const htmlDirSchema = z.enum(HTML_DIR_VALUES);

// --- Progress -------------------------------------------------------------

export const progressVariantSchema = z.enum(PROGRESS_VARIANTS);

export const progressSegmentsSchema = z.strictObject({
  count: z.int().min(MIN_PROGRESS_SEGMENTS).max(MAX_PROGRESS_SEGMENTS),
  gap: cssLengthSchema,
});

const numberFormatSchema = z.strictObject({
  fractionDigits: z.int().min(0).max(MAX_PROGRESS_FRACTION_DIGITS),
  trailingZeros: z.enum(["keep", "trim"]),
  grouping: z.boolean(),
});

export const progressLabelSchema = z
  .strictObject({
    kind: z.enum(PROGRESS_LABEL_KINDS),
    template: z.string().optional(),
    percentFormat: numberFormatSchema,
    valueFormat: numberFormatSchema,
    locale: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("neutral") }),
      z.strictObject({
        kind: z.literal("tag"),
        tag: z
          .string()
          .refine(isWellFormedLocaleTag, {
            message: "not a well-formed language tag",
          }),
      }),
    ]),
    indeterminateText: safeText(
      MAX_PROGRESS_INDETERMINATE_TEXT_LENGTH,
    ).optional(),
  })
  .superRefine((label, context) => {
    if (label.kind !== "template") {
      if (label.template !== undefined)
        context.addIssue({
          code: "custom",
          path: ["template"],
          message: 'a template is only stored for the "template" label',
        });
      return;
    }
    if (label.template === undefined) {
      context.addIssue({
        code: "custom",
        path: ["template"],
        message: 'the "template" label needs a template',
      });
      return;
    }
    const problem = CONTROL_CHARACTERS.test(label.template)
      ? "must not contain control characters"
      : findProgressTemplateError(label.template);
    if (problem)
      context.addIssue({
        code: "custom",
        path: ["template"],
        message: problem,
      });
  });

// --- Drift guards ---------------------------------------------------------
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
function assertSameType<Condition extends true>(): Condition | undefined {
  return undefined;
}
assertSameType<Equal<z.infer<typeof styleConditionSchema>, StyleCondition>>();
assertSameType<Equal<z.infer<typeof counterRefSchema>, CounterRef>>();
assertSameType<Equal<z.infer<typeof counterStyleRefSchema>, CounterStyleRef>>();
assertSameType<
  Equal<z.infer<typeof counterOperationsSchema>, CounterOperations>
>();
assertSameType<
  Equal<z.infer<typeof counterDefinitionSchema>, CounterDefinition>
>();
assertSameType<Equal<z.infer<typeof contentPartSchema>, ContentPart>>();
assertSameType<Equal<z.infer<typeof pseudoContentSchema>, PseudoContent>>();
assertSameType<Equal<z.infer<typeof outlineSchema>, OutlineSettings>>();
assertSameType<
  Equal<z.infer<typeof logicalEdgeValuesSchema>, LogicalEdgeValues>
>();
assertSameType<Equal<z.infer<typeof logicalOffsetsSchema>, LogicalOffsets>>();
assertSameType<
  Equal<z.infer<typeof logicalBorderSidesSchema>, LogicalBorderSides>
>();
assertSameType<Equal<z.infer<typeof logicalRadiiSchema>, LogicalRadii>>();
assertSameType<Equal<z.infer<typeof logicalSizeSchema>, LogicalSizeSettings>>();
assertSameType<
  Equal<z.infer<typeof progressSegmentsSchema>, ProgressSegments>
>();
assertSameType<Equal<z.infer<typeof progressLabelSchema>, ProgressLabel>>();
