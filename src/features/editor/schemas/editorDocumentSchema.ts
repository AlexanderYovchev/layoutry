import { z } from "zod";
import { isKnownElementTag } from "@/features/editor/rules/knownElementTags";
import {
  ARIA_CURRENT_VALUES,
  COMPONENT_MARKERS,
  isValidAriaLabel,
  MAX_ARIA_LABEL_LENGTH,
} from "@/features/editor/types/accessibility";
import type { AspectRatioValue } from "@/features/editor/types/aspectRatio";
import {
  isValidBackgroundImageUrl,
  type BackgroundSettings,
} from "@/features/editor/types/background";
import type { BorderSettings } from "@/features/editor/types/border";
import {
  borderSideSchema,
  cssLengthSchema,
  finite,
  offsetSchema,
} from "@/features/editor/schemas/cssValueSchemas";
import {
  ASSET_ID_PATTERN,
  assetNameSchema,
  counterDefinitionSchema,
  counterOperationsSchema,
  cssDirectionSchema,
  htmlDirSchema,
  logicalBorderSidesSchema,
  logicalEdgeValuesSchema,
  logicalOffsetsSchema,
  logicalRadiiSchema,
  logicalSizeSchema,
  outlineSchema,
  progressLabelSchema,
  progressSegmentsSchema,
  progressVariantSchema,
  pseudoContentSchema,
  styleConditionSchema,
  styleTargetIdSchema,
  textOrientationSchema,
  unicodeBidiSchema,
  writingModeSchema,
} from "@/features/editor/schemas/stylingFoundationSchemas";
import { MAX_COUNTER_DEFINITIONS } from "@/features/editor/types/counters";
import {
  MAX_KEYFRAME_STOPS,
  MAX_KEYFRAMES_DEFINITIONS,
  MAX_PRESETS_PER_LIBRARY,
  PRESET_KINDS,
  type StyleAssets,
} from "@/features/editor/types/styleAssets";
import {
  CONTENT_TARGETS,
  isDefaultCondition,
  MAX_STYLE_RULES_PER_NODE,
  type StyleRule,
  type StyleRuleGroups,
} from "@/features/editor/types/styleRules";
import type { BorderRadiusSettings } from "@/features/editor/types/borderRadius";
import type { BoxShadowSettings } from "@/features/editor/types/boxShadow";
import {
  CURSOR_VALUES,
  DISPLAY_VALUES,
  OVERFLOW_VALUES,
  POINTER_EVENTS_VALUES,
  USER_SELECT_VALUES,
  VISIBILITY_VALUES,
  type DisplaySettings,
} from "@/features/editor/types/display";
import type {
  EditorElementNode,
  ElementDimensions,
} from "@/features/editor/types/document";
import type { FilterSettings } from "@/features/editor/types/filters";
import type {
  FlexChildSettings,
  FlowLayoutSettings,
  GridChildSettings,
} from "@/features/editor/types/flowLayout";
import type { GradientSettings } from "@/features/editor/types/gradient";
import { INPUT_TYPES } from "@/features/editor/types/input";
import type { InteractionBinding } from "@/features/editor/types/interactions";
import type { FreeLayoutGeometry } from "@/features/editor/types/layout";
import { isValidLinkHref } from "@/features/editor/types/link";
import type { MediaFitSettings } from "@/features/editor/types/mediaFit";
import {
  POSITION_VALUES,
  type PositionSettings,
} from "@/features/editor/types/position";
import { SHAPE_PRESET_IDS } from "@/features/editor/types/shape";
import type { SizeConstraints } from "@/features/editor/types/sizeConstraints";
import type { ElementSpacing } from "@/features/editor/types/spacing";
import {
  SVG_PRIMITIVE_KINDS,
  type SvgViewBox,
} from "@/features/editor/types/svg";
import type { SvgScene } from "@/features/editor/types/svgScene";
import {
  TRANSITION_PROPERTIES,
  TRANSITION_TIMING_FUNCTIONS,
  type TransitionSettings,
} from "@/features/editor/types/transition";
import type { TransformSettings } from "@/features/editor/types/transform";
import type { TypographySettings } from "@/features/editor/types/typography";

/**
 * Runtime validation of the editor's authored document (PROJECT-1.1) —
 * the exact EditorElementNode tree the store holds, so a loaded document
 * can be applied without conversion. Every object is strict: an unknown
 * field means a corrupted, hostile or newer-format document, and is
 * rejected rather than silently dropped (see docs/architecture/project-format.md).
 *
 * Zod numbers reject NaN and ±Infinity. Semantic ranges (e.g. spacing
 * 0–500) are deliberately NOT re-enforced: the Inspector clamps at input,
 * and rejecting an out-of-range but harmless value would make a whole
 * project unloadable. Values that reach CSS strings or navigable URLs are
 * checked with the editor's own Inspector validators.
 *
 * The Equal<> assertions at the bottom fail `npm run typecheck` if this
 * schema and the TypeScript model ever drift apart.
 */

/** Node ids are generated as `${tag}-${suffix}`; this accepts every editor id and keeps ids safe for HTML/CSS. */
export const NODE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const nonEmptyString = z.string().min(1);

// An empty string is a cleared field; anything else must pass the same
// javascript:-URI check the Inspector applies on entry.
const navigableUrl = z
  .string()
  .refine((value) => value === "" || isValidLinkHref(value), {
    message: "javascript: URLs are not allowed",
  });
const backgroundImageUrl = z
  .string()
  .refine((value) => value === "" || isValidBackgroundImageUrl(value), {
    message: "background image URL contains forbidden characters",
  });

const backgroundPositionSchema = z.enum([
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);

const elementDimensionsSchema = z.strictObject({
  preferredWidth: finite,
  preferredHeight: finite,
  offsetX: finite,
  offsetY: finite,
});

const freeLayoutGeometrySchema = z.strictObject({
  x: finite,
  y: finite,
  width: finite,
  height: finite,
});

const flowLayoutSchema = z.strictObject({
  display: z.enum(["block", "flex", "grid"]),
  flex: z
    .strictObject({
      direction: z.enum(["row", "column"]),
      wrap: z.enum(["nowrap", "wrap"]),
      justifyContent: z.enum([
        "start",
        "center",
        "end",
        "space-between",
        "space-around",
        "space-evenly",
      ]),
      alignItems: z.enum(["start", "center", "end", "stretch"]),
      alignContent: z
        .enum([
          "start",
          "center",
          "end",
          "space-between",
          "space-around",
          "stretch",
        ])
        .optional(),
      rowGap: finite,
      columnGap: finite,
    })
    .optional(),
  grid: z
    .strictObject({
      columns: z.literal([1, 2, 3, 4]),
      rows: z.union([z.literal("auto"), z.literal([1, 2, 3, 4])]),
      rowGap: finite,
      columnGap: finite,
    })
    .optional(),
});

const flexChildSchema = z.strictObject({
  grow: finite,
  shrink: finite,
  basis: z.union([finite, z.literal("auto")]),
  alignSelf: z.enum(["auto", "start", "center", "end", "stretch"]),
});

const gridChildSchema = z.strictObject({
  columnStart: z.union([finite, z.literal("auto")]),
  columnSpan: finite,
  rowStart: z.union([finite, z.literal("auto")]),
  rowSpan: finite,
});

// Project format 2 (BC-05.3): each side optional; an absent side is unset and
// 0 is an authored value. Format 1 files are migrated before this runs.
const edgeValuesSchema = z.strictObject({
  top: finite.optional(),
  right: finite.optional(),
  bottom: finite.optional(),
  left: finite.optional(),
});
const spacingSchema = z.strictObject({
  margin: edgeValuesSchema.optional(),
  padding: edgeValuesSchema.optional(),
  marginLogical: logicalEdgeValuesSchema.optional(),
  paddingLogical: logicalEdgeValuesSchema.optional(),
});

const objectPositionAxisSchema = z.strictObject({
  value: finite,
  unit: z.literal("%"),
});
const mediaFitSchema = z.strictObject({
  objectFit: z
    .enum(["fill", "contain", "cover", "none", "scale-down"])
    .optional(),
  objectPositionX: objectPositionAxisSchema.optional(),
  objectPositionY: objectPositionAxisSchema.optional(),
});

const typographySchema = z.strictObject({
  fontFamily: z.string().optional(),
  fontSize: cssLengthSchema.optional(),
  fontWeight: z
    .literal([100, 200, 300, 400, 500, 600, 700, 800, 900])
    .optional(),
  fontStyle: z.enum(["normal", "italic", "oblique"]).optional(),
  color: z.string().optional(),
  textAlign: z.enum(["left", "center", "right", "justify"]).optional(),
  lineHeight: cssLengthSchema.optional(),
  letterSpacing: cssLengthSchema.optional(),
  textDecorationLine: z
    .enum(["none", "underline", "overline", "line-through"])
    .optional(),
  direction: cssDirectionSchema.optional(),
  unicodeBidi: unicodeBidiSchema.optional(),
  writingMode: writingModeSchema.optional(),
  textOrientation: textOrientationSchema.optional(),
});

const gradientStopSchema = z.strictObject({
  id: nonEmptyString,
  color: z.string(),
  position: finite,
});
const gradientSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("linear"),
    angle: finite,
    stops: z.array(gradientStopSchema),
  }),
  z.strictObject({
    type: z.literal("radial"),
    shape: z.enum(["ellipse", "circle"]),
    position: backgroundPositionSchema,
    stops: z.array(gradientStopSchema),
  }),
]);

const backgroundSizeAxisSchema = z.union([cssLengthSchema, z.literal("auto")]);
const backgroundSchema = z.strictObject({
  color: z.string().optional(),
  sourceType: z.enum(["image", "gradient"]).optional(),
  image: backgroundImageUrl.optional(),
  size: z.enum(["auto", "cover", "contain", "custom"]).optional(),
  customSize: z
    .strictObject({
      width: backgroundSizeAxisSchema,
      height: backgroundSizeAxisSchema,
    })
    .optional(),
  position: backgroundPositionSchema.optional(),
  repeat: z
    .enum(["no-repeat", "repeat", "repeat-x", "repeat-y", "space", "round"])
    .optional(),
  attachment: z.enum(["scroll", "fixed", "local"]).optional(),
  gradient: gradientSchema.optional(),
});

const borderSchema = z.strictObject({
  top: borderSideSchema.optional(),
  right: borderSideSchema.optional(),
  bottom: borderSideSchema.optional(),
  left: borderSideSchema.optional(),
  borderLogical: logicalBorderSidesSchema.optional(),
});

const borderRadiusSchema = z.strictObject({
  topLeft: cssLengthSchema.optional(),
  topRight: cssLengthSchema.optional(),
  bottomRight: cssLengthSchema.optional(),
  bottomLeft: cssLengthSchema.optional(),
  radiusLogical: logicalRadiiSchema.optional(),
});

const boxShadowSchema = z.array(
  z.strictObject({
    id: nonEmptyString,
    enabled: z.boolean(),
    inset: z.boolean(),
    offsetX: cssLengthSchema.optional(),
    offsetY: cssLengthSchema.optional(),
    blur: cssLengthSchema.optional(),
    spread: cssLengthSchema.optional(),
    color: z.string().optional(),
  }),
);

const filtersSchema = z.strictObject({
  opacity: finite.optional(),
  blur: cssLengthSchema.optional(),
  brightness: finite.optional(),
  contrast: finite.optional(),
  saturate: finite.optional(),
  grayscale: finite.optional(),
  hueRotate: finite.optional(),
  invert: finite.optional(),
  sepia: finite.optional(),
});

const displaySchema = z.strictObject({
  display: z.enum(DISPLAY_VALUES).optional(),
  visibility: z.enum(VISIBILITY_VALUES).optional(),
  overflow: z.enum(OVERFLOW_VALUES).optional(),
  overflowX: z.enum(OVERFLOW_VALUES).optional(),
  overflowY: z.enum(OVERFLOW_VALUES).optional(),
  pointerEvents: z.enum(POINTER_EVENTS_VALUES).optional(),
  cursor: z.enum(CURSOR_VALUES).optional(),
  userSelect: z.enum(USER_SELECT_VALUES).optional(),
});

const positionSchema = z.strictObject({
  position: z.enum(POSITION_VALUES).optional(),
  top: offsetSchema.optional(),
  right: offsetSchema.optional(),
  bottom: offsetSchema.optional(),
  left: offsetSchema.optional(),
  zIndex: z.union([finite, z.literal("auto")]).optional(),
  insetLogical: logicalOffsetsSchema.optional(),
});

const aspectRatioSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("auto") }),
  z.strictObject({ mode: z.literal("ratio"), width: finite, height: finite }),
]);

const sizeConstraintsSchema = z.strictObject({
  minWidth: finite.optional(),
  minHeight: finite.optional(),
  maxWidth: finite.optional(),
  maxHeight: finite.optional(),
});

const svgViewBoxSchema = z.strictObject({
  minX: finite,
  minY: finite,
  width: finite,
  height: finite,
});

const svgPointSchema = z.strictObject({ x: finite, y: finite });
const svgObjectBase = {
  id: nonEmptyString,
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: finite.optional(),
};
const svgSceneSchema = z.strictObject({
  objects: z.array(
    z.discriminatedUnion("type", [
      z.strictObject({
        ...svgObjectBase,
        type: z.literal("rect"),
        x: finite,
        y: finite,
        width: finite,
        height: finite,
      }),
      z.strictObject({
        ...svgObjectBase,
        type: z.literal("ellipse"),
        cx: finite,
        cy: finite,
        rx: finite,
        ry: finite,
      }),
      z.strictObject({
        ...svgObjectBase,
        type: z.literal("line"),
        x1: finite,
        y1: finite,
        x2: finite,
        y2: finite,
      }),
      z.strictObject({
        ...svgObjectBase,
        type: z.literal("polygon"),
        points: z.array(svgPointSchema),
      }),
      z.strictObject({
        ...svgObjectBase,
        type: z.literal("path"),
        commands: z.array(
          z.discriminatedUnion("kind", [
            z.strictObject({ kind: z.literal("M"), x: finite, y: finite }),
            z.strictObject({ kind: z.literal("L"), x: finite, y: finite }),
            z.strictObject({ kind: z.literal("Z") }),
          ]),
        ),
      }),
    ]),
  ),
});

const interactionSchema = z.strictObject({
  id: nonEmptyString,
  trigger: z.literal("click"),
  action: z.enum(["show", "hide", "toggle"]),
  targetId: z.string().regex(NODE_ID_PATTERN),
});

const transitionSchema = z.strictObject({
  property: z.enum(TRANSITION_PROPERTIES),
  durationMs: finite,
  timingFunction: z.enum(TRANSITION_TIMING_FUNCTIONS),
  delayMs: finite,
});

const transformSchema = z.strictObject({
  translateX: finite.optional(),
  translateY: finite.optional(),
  rotateDeg: finite.optional(),
  scale: finite.optional(),
});

// --- Project format 4, revision 0 (BC-17.2): the styling foundation -------
// Local structure here; document-wide rules in rules/stylingIntegrity.ts.

/** A rule's groups: the same schemas as the base groups above. */
const styleRuleGroupsSchema = z.strictObject({
  typography: typographySchema.optional(),
  background: backgroundSchema.optional(),
  border: borderSchema.optional(),
  borderRadius: borderRadiusSchema.optional(),
  shape: z.enum(SHAPE_PRESET_IDS).optional(),
  boxShadow: boxShadowSchema.optional(),
  filters: filtersSchema.optional(),
  display: displaySchema.optional(),
  position: positionSchema.optional(),
  spacing: spacingSchema.optional(),
  sizeConstraints: sizeConstraintsSchema.optional(),
  logicalSize: logicalSizeSchema.optional(),
  mediaFit: mediaFitSchema.optional(),
  transition: transitionSchema.optional(),
  transform: transformSchema.optional(),
  outline: outlineSchema.optional(),
  counters: counterOperationsSchema.optional(),
});

const styleRuleSchema = z
  .strictObject({
    id: z.string().regex(ASSET_ID_PATTERN, { message: "invalid rule id" }),
    target: styleTargetIdSchema,
    condition: styleConditionSchema,
    groups: styleRuleGroupsSchema,
    content: pseudoContentSchema.optional(),
  })
  .superRefine((rule, context) => {
    if (rule.target === "element" && isDefaultCondition(rule.condition))
      context.addIssue({
        code: "custom",
        path: ["condition"],
        message: "the element's default styling is its base groups, not a rule",
      });
    if (rule.content !== undefined && !CONTENT_TARGETS.has(rule.target))
      context.addIssue({
        code: "custom",
        path: ["content"],
        message: `generated content is only allowed on ::before, ::after and ::marker, not "${rule.target}"`,
      });
    if (rule.content === undefined && Object.keys(rule.groups).length === 0)
      context.addIssue({
        code: "custom",
        path: ["groups"],
        message: "a styling rule must contain styling or content",
      });
  });

const keyframesDefinitionSchema = z.strictObject({
  id: z.string().regex(ASSET_ID_PATTERN, { message: "invalid id" }),
  name: assetNameSchema,
  stops: z
    .array(
      z.strictObject({
        offset: finite.min(0).max(100),
        groups: styleRuleGroupsSchema,
      }),
    )
    .min(1)
    .max(MAX_KEYFRAME_STOPS)
    .superRefine((stops, context) => {
      const offsets = new Set<number>();
      stops.forEach((stop, index) => {
        if (offsets.has(stop.offset))
          context.addIssue({
            code: "custom",
            path: [index, "offset"],
            message: "keyframe offsets must be unique",
          });
        offsets.add(stop.offset);
      });
    }),
});

const presetDefinitionSchema = z.strictObject({
  id: z.string().regex(ASSET_ID_PATTERN, { message: "invalid id" }),
  library: z.literal("project"),
  name: assetNameSchema,
  kind: z.enum(PRESET_KINDS),
  payload: z.strictObject({
    groups: styleRuleGroupsSchema.optional(),
    rules: z.array(styleRuleSchema).max(MAX_STYLE_RULES_PER_NODE).optional(),
    keyframes: z
      .array(keyframesDefinitionSchema)
      .max(MAX_KEYFRAMES_DEFINITIONS)
      .optional(),
    counters: z
      .array(counterDefinitionSchema)
      .max(MAX_COUNTER_DEFINITIONS)
      .optional(),
  }),
  createdAt: z.iso.datetime({ message: "timestamps must be ISO 8601 UTC" }),
  updatedAt: z.iso.datetime({ message: "timestamps must be ISO 8601 UTC" }),
});

const styleAssetsSchema = z.strictObject({
  keyframes: z
    .array(keyframesDefinitionSchema)
    .max(MAX_KEYFRAMES_DEFINITIONS)
    .optional(),
  counters: z
    .array(counterDefinitionSchema)
    .max(MAX_COUNTER_DEFINITIONS)
    .optional(),
  presets: z
    .array(presetDefinitionSchema)
    .max(MAX_PRESETS_PER_LIBRARY)
    .optional(),
});

export const editorElementNodeSchema = z.strictObject({
  id: z.string().regex(NODE_ID_PATTERN, { message: "invalid element id" }),
  tag: z
    .string()
    .refine(isKnownElementTag, { message: "unknown element type" }),
  displayName: z.string().optional(),
  text: z.string().optional(),
  get children() {
    return z.array(editorElementNodeSchema).optional();
  },
  dimensions: elementDimensionsSchema.optional(),
  layoutMode: z.enum(["flow", "free"]).optional(),
  childResizePolicy: z.enum(["clamp", "scale"]).optional(),
  freeLayout: freeLayoutGeometrySchema.optional(),
  aspectRatioLocked: z.boolean().optional(),
  flowLayout: flowLayoutSchema.optional(),
  spacing: spacingSchema.optional(),
  flexChild: flexChildSchema.optional(),
  gridChild: gridChildSchema.optional(),
  src: navigableUrl.optional(),
  href: navigableUrl.optional(),
  mediaFit: mediaFitSchema.optional(),
  typography: typographySchema.optional(),
  background: backgroundSchema.optional(),
  border: borderSchema.optional(),
  borderRadius: borderRadiusSchema.optional(),
  shape: z.enum(SHAPE_PRESET_IDS).optional(),
  boxShadow: boxShadowSchema.optional(),
  filters: filtersSchema.optional(),
  display: displaySchema.optional(),
  position: positionSchema.optional(),
  aspectRatio: aspectRatioSchema.optional(),
  sizeConstraints: sizeConstraintsSchema.optional(),
  inputType: z.enum(INPUT_TYPES).optional(),
  name: z.string().optional(),
  placeholder: z.string().optional(),
  value: z.string().optional(),
  checked: z.boolean().optional(),
  selected: z.boolean().optional(),
  poster: navigableUrl.optional(),
  controls: z.boolean().optional(),
  autoplay: z.boolean().optional(),
  muted: z.boolean().optional(),
  loop: z.boolean().optional(),
  progressValue: finite.optional(),
  progressMax: finite.optional(),
  title: z.string().optional(),
  svgKind: z.enum(SVG_PRIMITIVE_KINDS).optional(),
  svgViewBox: svgViewBoxSchema.optional(),
  svgFill: z.string().optional(),
  svgStroke: z.string().optional(),
  svgStrokeWidth: finite.optional(),
  svgScene: svgSceneSchema.optional(),
  htmlId: z.string().optional(),
  className: z.string().optional(),
  lockChildStyles: z.boolean().optional(),
  interactions: z.array(interactionSchema).optional(),
  initialPreviewVisibility: z.enum(["visible", "hidden"]).optional(),
  transition: transitionSchema.optional(),
  transform: transformSchema.optional(),
  // Project format 3 (BC-09.2): generic accessibility fields and the
  // component marker. Where each may appear is an integrity rule
  // (rules/accessibilityAttributes.ts).
  ariaLabel: z
    .string()
    .refine(isValidAriaLabel, {
      message: `an accessible label must be 1–${MAX_ARIA_LABEL_LENGTH} characters, not blank, with no control characters`,
    })
    .optional(),
  ariaCurrent: z.enum(ARIA_CURRENT_VALUES).optional(),
  disabled: z.literal(true).optional(),
  component: z.enum(COMPONENT_MARKERS).optional(),
  // Project format 4, revision 0 (BC-17.2).
  styleRules: z.array(styleRuleSchema).max(MAX_STYLE_RULES_PER_NODE).optional(),
  styleAssets: styleAssetsSchema.optional(),
  outline: outlineSchema.optional(),
  counters: counterOperationsSchema.optional(),
  logicalSize: logicalSizeSchema.optional(),
  dir: htmlDirSchema.optional(),
  progressVariant: progressVariantSchema.optional(),
  progressSegments: progressSegmentsSchema.optional(),
  progressLabel: progressLabelSchema.optional(),
});

// --- Drift guards: each schema must produce exactly the editor's type. ---
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
function assertSameType<Condition extends true>(): Condition | undefined {
  return undefined;
}
assertSameType<
  Equal<z.infer<typeof elementDimensionsSchema>, ElementDimensions>
>();
assertSameType<
  Equal<z.infer<typeof freeLayoutGeometrySchema>, FreeLayoutGeometry>
>();
assertSameType<Equal<z.infer<typeof flowLayoutSchema>, FlowLayoutSettings>>();
assertSameType<Equal<z.infer<typeof flexChildSchema>, FlexChildSettings>>();
assertSameType<Equal<z.infer<typeof gridChildSchema>, GridChildSettings>>();
assertSameType<Equal<z.infer<typeof spacingSchema>, ElementSpacing>>();
assertSameType<Equal<z.infer<typeof mediaFitSchema>, MediaFitSettings>>();
assertSameType<Equal<z.infer<typeof typographySchema>, TypographySettings>>();
assertSameType<Equal<z.infer<typeof gradientSchema>, GradientSettings>>();
assertSameType<Equal<z.infer<typeof backgroundSchema>, BackgroundSettings>>();
assertSameType<Equal<z.infer<typeof borderSchema>, BorderSettings>>();
assertSameType<
  Equal<z.infer<typeof borderRadiusSchema>, BorderRadiusSettings>
>();
assertSameType<Equal<z.infer<typeof boxShadowSchema>, BoxShadowSettings>>();
assertSameType<Equal<z.infer<typeof filtersSchema>, FilterSettings>>();
assertSameType<Equal<z.infer<typeof displaySchema>, DisplaySettings>>();
assertSameType<Equal<z.infer<typeof positionSchema>, PositionSettings>>();
assertSameType<Equal<z.infer<typeof aspectRatioSchema>, AspectRatioValue>>();
assertSameType<Equal<z.infer<typeof sizeConstraintsSchema>, SizeConstraints>>();
assertSameType<Equal<z.infer<typeof svgViewBoxSchema>, SvgViewBox>>();
assertSameType<Equal<z.infer<typeof svgSceneSchema>, SvgScene>>();
assertSameType<Equal<z.infer<typeof interactionSchema>, InteractionBinding>>();
assertSameType<Equal<z.infer<typeof transitionSchema>, TransitionSettings>>();
assertSameType<Equal<z.infer<typeof transformSchema>, TransformSettings>>();
assertSameType<Equal<z.infer<typeof styleRuleGroupsSchema>, StyleRuleGroups>>();
assertSameType<Equal<z.infer<typeof styleRuleSchema>, StyleRule>>();
assertSameType<Equal<z.infer<typeof styleAssetsSchema>, StyleAssets>>();
assertSameType<
  Equal<z.infer<typeof editorElementNodeSchema>, EditorElementNode>
>();
