import { describe, expect, it } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import {
  normalizeSelectionRoots,
  removeNodesByIds,
  setElementsAspectRatio,
  setElementsBackgroundField,
  setElementsBorderAllSidesField,
  setElementsBorderRadiusAllCorners,
  setElementsDimensions,
  setElementsDisplayField,
  setElementsFilterField,
  setElementsMediaFitField,
  setElementsPositionField,
  setElementsShape,
  setElementsSizeConstraintField,
  setElementsSpacingAllSides,
  setElementsSvgFill,
  setElementsSvgKind,
  setElementsSvgStroke,
  setElementsSvgStrokeWidth,
  setElementsTransition,
  setElementsTransitionField,
  setElementsTypographyField,
  updateNodesByIds,
} from "./bulkCommands";
import { DEFAULT_TRANSITION_SETTINGS } from "@/features/editor/types/transition";

function tree(): EditorElementNode {
  return {
    id: "root",
    tag: "page",
    children: [
      {
        id: "section-1",
        tag: "section",
        children: [
          { id: "p-1", tag: "p", text: "One", typography: { fontWeight: 400 } },
          { id: "p-2", tag: "p", text: "Two", typography: { fontWeight: 400 } },
          { id: "p-3", tag: "p", text: "Three" },
        ],
      },
      { id: "button-1", tag: "button", text: "Click" },
    ],
  };
}

describe("updateNodesByIds", () => {
  it("applies the updater to every targeted node, wherever nested", () => {
    const result = updateNodesByIds(tree(), new Set(["p-1", "button-1"]), (node) => ({ ...node, text: "changed" }));
    const section = result.children?.find((c) => c.id === "section-1");
    expect(section?.children?.find((c) => c.id === "p-1")?.text).toBe("changed");
    expect(section?.children?.find((c) => c.id === "p-2")?.text).toBe("Two");
    expect(result.children?.find((c) => c.id === "button-1")?.text).toBe("changed");
  });

  it("is a no-op (same root reference) when the updater changes nothing", () => {
    const root = tree();
    const result = updateNodesByIds(root, new Set(["p-1"]), (node) => node);
    expect(result).toBe(root);
  });

  it("is a no-op when no id in the set exists in the tree", () => {
    const root = tree();
    const result = updateNodesByIds(root, new Set(["does-not-exist"]), (node) => ({ ...node, text: "changed" }));
    expect(result).toBe(root);
  });

  it("preserves structural sharing — an untouched branch keeps its exact reference", () => {
    const root = tree();
    const result = updateNodesByIds(root, new Set(["p-1"]), (node) => ({ ...node, text: "changed" }));
    const untouchedButton = root.children?.find((c) => c.id === "button-1");
    expect(result.children?.find((c) => c.id === "button-1")).toBe(untouchedButton);
  });
});

describe("removeNodesByIds", () => {
  it("removes every targeted id in one pass", () => {
    const result = removeNodesByIds(tree(), new Set(["p-1", "button-1"]));
    const section = result.children?.find((c) => c.id === "section-1");
    expect(section?.children?.map((c) => c.id)).toEqual(["p-2", "p-3"]);
    expect(result.children?.find((c) => c.id === "button-1")).toBeUndefined();
  });

  it("is a no-op (same reference) when nothing matches", () => {
    const root = tree();
    expect(removeNodesByIds(root, new Set(["does-not-exist"]))).toBe(root);
  });
});

describe("normalizeSelectionRoots", () => {
  it("drops a selected id whose ancestor is also selected", () => {
    const document = tree();
    const roots = normalizeSelectionRoots(document, ["section-1", "p-1"]);
    expect(roots).toEqual(["section-1"]);
  });

  it("keeps unrelated selected ids independent", () => {
    const document = tree();
    const roots = normalizeSelectionRoots(document, ["p-1", "button-1"]);
    expect(roots.sort()).toEqual(["button-1", "p-1"]);
  });

  it("returns a single id unchanged (ordinary single-selection delete)", () => {
    const document = tree();
    expect(normalizeSelectionRoots(document, ["p-1"])).toEqual(["p-1"]);
  });
});

describe("setElementsTypographyField", () => {
  it("merges one field into each node's OWN existing typography, preserving the rest", () => {
    const result = setElementsTypographyField(tree(), new Set(["p-1", "p-2"]), "fontSize", { value: 18, unit: "px" });
    const section = result.children?.find((c) => c.id === "section-1");
    const p1 = section?.children?.find((c) => c.id === "p-1");
    expect(p1?.typography?.fontSize).toEqual({ value: 18, unit: "px" });
    expect(p1?.typography?.fontWeight).toBe(400); // preserved, not blown away
  });

  it("is a no-op for a node whose field already equals the target value", () => {
    const document = tree();
    const result = setElementsTypographyField(document, new Set(["p-1"]), "fontWeight", 400);
    expect(result).toBe(document);
  });

  it("is a whole-root no-op when every targeted node already matches", () => {
    const document = tree();
    const result = setElementsTypographyField(document, new Set(["p-1", "p-2"]), "fontWeight", 400);
    expect(result).toBe(document);
  });

  it("mixed selection: only the differing node actually changes (structural sharing)", () => {
    const document = tree();
    const result = setElementsTypographyField(document, new Set(["p-1", "p-3"]), "fontWeight", 400);
    const section = result.children?.find((c) => c.id === "section-1");
    expect(section?.children?.find((c) => c.id === "p-1")).toBe(document.children?.[0].children?.[0]); // p-1 unchanged
    expect(section?.children?.find((c) => c.id === "p-3")?.typography?.fontWeight).toBe(400); // p-3 changed
  });
});

describe("looseFieldEqual regression — object-valued fields (Checkpoint 1.15.2, found live)", () => {
  it("committing the exact same CssLengthValue-shaped fontSize twice is a whole-root no-op, not two changes", () => {
    const withSize = setElementsTypographyField(tree(), new Set(["p-1"]), "fontSize", { value: 18, unit: "px" });
    const result = setElementsTypographyField(withSize, new Set(["p-1"]), "fontSize", { value: 18, unit: "px" });
    expect(result).toBe(withSize);
  });

  it("committing the exact same CssLengthValue-shaped blur twice is a whole-root no-op", () => {
    const withBlur = setElementsFilterField(tree(), new Set(["p-1"]), "blur", { value: 4, unit: "px" });
    const result = setElementsFilterField(withBlur, new Set(["p-1"]), "blur", { value: 4, unit: "px" });
    expect(result).toBe(withBlur);
  });

  it("a genuinely different CssLengthValue (same value, different unit) is correctly treated as a change", () => {
    const withSize = setElementsTypographyField(tree(), new Set(["p-1"]), "fontSize", { value: 18, unit: "px" });
    const result = setElementsTypographyField(withSize, new Set(["p-1"]), "fontSize", { value: 18, unit: "rem" });
    expect(result).not.toBe(withSize);
    const p1 = result.children?.[0].children?.find((c) => c.id === "p-1");
    expect(p1?.typography?.fontSize).toEqual({ value: 18, unit: "rem" });
  });
});

describe("setElementsBackgroundField", () => {
  it("sets background.color on every targeted node", () => {
    const result = setElementsBackgroundField(tree(), new Set(["p-1", "button-1"]), "color", "#ff0000");
    expect(result.children?.[0].children?.[0].background?.color).toBe("#ff0000");
    expect(result.children?.[1].background?.color).toBe("#ff0000");
  });
});

describe("setElementsBorderAllSidesField", () => {
  it("writes the field to all four sides", () => {
    const result = setElementsBorderAllSidesField(tree(), new Set(["p-1"]), "width", { value: 2, unit: "px" });
    const p1 = result.children?.[0].children?.find((c) => c.id === "p-1");
    expect(p1?.border?.top?.width).toEqual({ value: 2, unit: "px" });
    expect(p1?.border?.right?.width).toEqual({ value: 2, unit: "px" });
    expect(p1?.border?.bottom?.width).toEqual({ value: 2, unit: "px" });
    expect(p1?.border?.left?.width).toEqual({ value: 2, unit: "px" });
  });

  it("is a no-op when every side already has that value", () => {
    const withBorder = setElementsBorderAllSidesField(tree(), new Set(["p-1"]), "width", { value: 2, unit: "px" });
    const result = setElementsBorderAllSidesField(withBorder, new Set(["p-1"]), "width", { value: 2, unit: "px" });
    expect(result).toBe(withBorder);
  });
});

describe("setElementsBorderRadiusAllCorners", () => {
  it("writes the same radius to all four corners", () => {
    const result = setElementsBorderRadiusAllCorners(tree(), new Set(["p-1"]), { value: 8, unit: "px" });
    const p1 = result.children?.[0].children?.find((c) => c.id === "p-1");
    expect(p1?.borderRadius).toEqual({
      topLeft: { value: 8, unit: "px" },
      topRight: { value: 8, unit: "px" },
      bottomRight: { value: 8, unit: "px" },
      bottomLeft: { value: 8, unit: "px" },
    });
  });

  it("is a no-op when already uniform at that value", () => {
    const withRadius = setElementsBorderRadiusAllCorners(tree(), new Set(["p-1"]), { value: 8, unit: "px" });
    const result = setElementsBorderRadiusAllCorners(withRadius, new Set(["p-1"]), { value: 8, unit: "px" });
    expect(result).toBe(withRadius);
  });
});

describe("setElementsShape", () => {
  it("applies the same preset to every targeted node in one pass", () => {
    const result = setElementsShape(tree(), new Set(["p-1", "p-2"]), "hexagon");
    const [p1, p2, p3] = result.children![0].children!;
    expect(p1.shape).toBe("hexagon");
    expect(p2.shape).toBe("hexagon");
    expect(p3.shape).toBeUndefined();
  });

  it("applies uniformly across nodes that start with different (mixed) values", () => {
    const mixed = setElementsShape(tree(), new Set(["p-1"]), "circle");
    const result = setElementsShape(mixed, new Set(["p-1", "p-2"]), "triangle");
    const [p1, p2] = result.children![0].children!;
    expect(p1.shape).toBe("triangle");
    expect(p2.shape).toBe("triangle");
  });

  it("\"none\" clears the field on every targeted node", () => {
    const withShapes = setElementsShape(tree(), new Set(["p-1", "p-2"]), "star");
    const result = setElementsShape(withShapes, new Set(["p-1", "p-2"]), "none");
    const [p1, p2] = result.children![0].children!;
    expect(p1.shape).toBeUndefined();
    expect(p2.shape).toBeUndefined();
  });

  it("is a true no-op (same reference, structural sharing) when every target already matches", () => {
    const withShapes = setElementsShape(tree(), new Set(["p-1", "p-2"]), "octagon");
    const result = setElementsShape(withShapes, new Set(["p-1", "p-2"]), "octagon");
    expect(result).toBe(withShapes);
  });

  it("preserves unrelated fields on every targeted node", () => {
    const result = setElementsShape(tree(), new Set(["p-1"]), "pentagon");
    const p1 = result.children![0].children!.find((node) => node.id === "p-1");
    expect(p1?.typography).toEqual({ fontWeight: 400 });
  });
});

function svgTree(): EditorElementNode {
  return {
    id: "root",
    tag: "page",
    children: [
      { id: "svg-1", tag: "svg", svgKind: "circle", svgFill: "#ff0000" },
      { id: "svg-2", tag: "svg", svgKind: "star", svgFill: "#0000ff" },
    ],
  };
}

describe("setElementsSvgKind / setElementsSvgFill / setElementsSvgStroke / setElementsSvgStrokeWidth", () => {
  it("setElementsSvgKind applies the same primitive to every targeted node", () => {
    const result = setElementsSvgKind(svgTree(), new Set(["svg-1", "svg-2"]), "triangle");
    expect(result.children![0].svgKind).toBe("triangle");
    expect(result.children![1].svgKind).toBe("triangle");
  });

  it("setElementsSvgKind is a true no-op (same reference) when already uniform", () => {
    const withKind = setElementsSvgKind(svgTree(), new Set(["svg-1", "svg-2"]), "rectangle");
    const result = setElementsSvgKind(withKind, new Set(["svg-1", "svg-2"]), "rectangle");
    expect(result).toBe(withKind);
  });

  it("setElementsSvgFill applies uniformly across mixed starting values", () => {
    const result = setElementsSvgFill(svgTree(), new Set(["svg-1", "svg-2"]), "#00ff00");
    expect(result.children![0].svgFill).toBe("#00ff00");
    expect(result.children![1].svgFill).toBe("#00ff00");
  });

  it("setElementsSvgStroke sets None -> color across every targeted node without touching stroke width", () => {
    const withWidth = setElementsSvgStrokeWidth(svgTree(), new Set(["svg-1", "svg-2"]), 4);
    const result = setElementsSvgStroke(withWidth, new Set(["svg-1", "svg-2"]), "#000000");
    expect(result.children![0].svgStroke).toBe("#000000");
    expect(result.children![1].svgStroke).toBe("#000000");
    expect(result.children![0].svgStrokeWidth).toBe(4);
    expect(result.children![1].svgStrokeWidth).toBe(4);
  });

  it("setElementsSvgStrokeWidth floors at 0 and is a no-op when already matching", () => {
    const withWidth = setElementsSvgStrokeWidth(svgTree(), new Set(["svg-1", "svg-2"]), -5);
    expect(withWidth.children![0].svgStrokeWidth).toBe(0);
    const again = setElementsSvgStrokeWidth(withWidth, new Set(["svg-1", "svg-2"]), 0);
    expect(again).toBe(withWidth);
  });
});

describe("setElementsDisplayField / setElementsFilterField / setElementsPositionField / setElementsMediaFitField / setElementsSizeConstraintField", () => {
  it("each sets its own field independently", () => {
    let result = tree();
    result = setElementsDisplayField(result, new Set(["p-1"]), "display", "none");
    result = setElementsFilterField(result, new Set(["p-1"]), "opacity", 50);
    result = setElementsPositionField(result, new Set(["p-1"]), "position", "relative");
    result = setElementsMediaFitField(result, new Set(["button-1"]), "objectFit", "cover");
    result = setElementsSizeConstraintField(result, new Set(["p-1"]), "minWidth", 100);

    const p1 = result.children?.[0].children?.find((c) => c.id === "p-1");
    expect(p1?.display?.display).toBe("none");
    expect(p1?.filters?.opacity).toBe(50);
    expect(p1?.position?.position).toBe("relative");
    expect(p1?.sizeConstraints?.minWidth).toBe(100);
    expect(result.children?.[1].mediaFit?.objectFit).toBe("cover");
  });
});

describe("setElementsSpacingAllSides", () => {
  it("writes the value to all four sides of the given box", () => {
    const result = setElementsSpacingAllSides(tree(), new Set(["p-1"]), "margin", 16);
    const p1 = result.children?.[0].children?.find((c) => c.id === "p-1");
    expect(p1?.spacing?.margin).toEqual({ top: 16, right: 16, bottom: 16, left: 16 });
  });

  it("leaves padding untouched when writing margin", () => {
    const document: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "p-1", tag: "p", spacing: { margin: { top: 0, right: 0, bottom: 0, left: 0 }, padding: { top: 4, right: 4, bottom: 4, left: 4 } } }],
    };
    const result = setElementsSpacingAllSides(document, new Set(["p-1"]), "margin", 16);
    expect(result.children?.[0].spacing?.padding).toEqual({ top: 4, right: 4, bottom: 4, left: 4 });
  });

  it("is a no-op when every side already equals the target value", () => {
    const withMargin = setElementsSpacingAllSides(tree(), new Set(["p-1"]), "margin", 16);
    const result = setElementsSpacingAllSides(withMargin, new Set(["p-1"]), "margin", 16);
    expect(result).toBe(withMargin);
  });
});

describe("setElementsAspectRatio / setElementsDimensions", () => {
  it("setElementsAspectRatio overwrites the whole value per node", () => {
    const result = setElementsAspectRatio(tree(), new Set(["p-1"]), { mode: "ratio", width: 16, height: 9 });
    const p1 = result.children?.[0].children?.find((c) => c.id === "p-1");
    expect(p1?.aspectRatio).toEqual({ mode: "ratio", width: 16, height: 9 });
  });

  it("setElementsDimensions only affects resizable tags — an <option> (non-resizable) is skipped", () => {
    const document: EditorElementNode = {
      id: "root",
      tag: "page",
      children: [{ id: "select-1", tag: "select", children: [{ id: "option-1", tag: "option" }] }],
    };
    const result = setElementsDimensions(document, new Set(["option-1"]), { preferredWidth: 100, preferredHeight: 20, offsetX: 0, offsetY: 0 });
    expect(result).toBe(document);
  });

  it("setElementsDimensions clamps below the resize floor", () => {
    const result = setElementsDimensions(tree(), new Set(["p-1"]), { preferredWidth: 1, preferredHeight: 1, offsetX: 0, offsetY: 0 });
    const p1 = result.children?.[0].children?.find((c) => c.id === "p-1");
    expect(p1?.dimensions?.preferredWidth).toBeGreaterThanOrEqual(4);
    expect(p1?.dimensions?.preferredHeight).toBeGreaterThanOrEqual(4);
  });
});

describe("setElementsTransitionField / setElementsTransition", () => {
  it("setElementsTransitionField defaults a node with no transition yet before merging the field", () => {
    const result = setElementsTransitionField(tree(), new Set(["p-1"]), "durationMs", 1000);
    const p1 = result.children?.[0].children?.find((c) => c.id === "p-1");
    expect(p1?.transition).toEqual({ ...DEFAULT_TRANSITION_SETTINGS, durationMs: 1000 });
  });

  it("setElementsTransitionField merges a field into an existing transition without touching the others", () => {
    const document: EditorElementNode = { id: "p-1", tag: "p", transition: { property: "box-shadow", durationMs: 500, timingFunction: "linear", delayMs: 50 } };
    const result = setElementsTransitionField(document, new Set(["p-1"]), "timingFunction", "ease-out");
    expect(result.transition).toEqual({ property: "box-shadow", durationMs: 500, timingFunction: "ease-out", delayMs: 50 });
  });

  it("setElementsTransitionField is a no-op (same reference) when every targeted node already has that field's value", () => {
    const document: EditorElementNode = { id: "p-1", tag: "p", transition: DEFAULT_TRANSITION_SETTINGS };
    const result = setElementsTransitionField(document, new Set(["p-1"]), "durationMs", DEFAULT_TRANSITION_SETTINGS.durationMs);
    expect(result).toBe(document);
  });

  it("setElementsTransition overwrites/clears the whole value per node", () => {
    const result = setElementsTransition(tree(), new Set(["p-1", "p-2"]), DEFAULT_TRANSITION_SETTINGS);
    const section = result.children?.[0];
    expect(section?.children?.find((c) => c.id === "p-1")?.transition).toEqual(DEFAULT_TRANSITION_SETTINGS);
    expect(section?.children?.find((c) => c.id === "p-2")?.transition).toEqual(DEFAULT_TRANSITION_SETTINGS);
    expect(section?.children?.find((c) => c.id === "p-3")?.transition).toBeUndefined();
  });

  it("setElementsTransition clears every targeted node's transition when given undefined", () => {
    const document: EditorElementNode = { id: "p-1", tag: "p", transition: DEFAULT_TRANSITION_SETTINGS };
    const result = setElementsTransition(document, new Set(["p-1"]), undefined);
    expect(result.transition).toBeUndefined();
  });

  it("setElementsTransition is a no-op (same reference) when clearing an already-absent transition", () => {
    const document: EditorElementNode = { id: "p-1", tag: "p" };
    const result = setElementsTransition(document, new Set(["p-1"]), undefined);
    expect(result).toBe(document);
  });
});
