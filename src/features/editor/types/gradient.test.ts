import { describe, expect, it } from "vitest";
import {
  addGradientStop,
  computeNewStopPosition,
  createDefaultGradientSettings,
  formatGradientCss,
  formatGradientStopsCss,
  formatLinearGradientCss,
  formatRadialGradientCss,
  generateGradientStopId,
  isValidGradientSettings,
  isValidGradientStopPosition,
  MAX_GRADIENT_STOPS,
  MIN_GRADIENT_STOPS,
  nearestStopColor,
  normalizeGradientAngle,
  removeGradientStop,
  sortGradientStops,
  updateGradientStop,
  withGradientType,
  type GradientColorStop,
  type GradientSettings,
  type LinearGradientSettings,
  type RadialGradientSettings,
} from "./gradient";

function stop(id: string, color: string, position: number): GradientColorStop {
  return { id, color, position };
}

describe("createDefaultGradientSettings", () => {
  it("creates a black-to-white linear default with a 90deg angle", () => {
    const gradient = createDefaultGradientSettings("linear") as LinearGradientSettings;
    expect(gradient.type).toBe("linear");
    expect(gradient.angle).toBe(90);
    expect(gradient.stops).toHaveLength(2);
    expect(gradient.stops[0].color).toBe("#000000");
    expect(gradient.stops[0].position).toBe(0);
    expect(gradient.stops[1].color).toBe("#ffffff");
    expect(gradient.stops[1].position).toBe(100);
  });

  it("creates a black-to-white radial default centered with an ellipse shape", () => {
    const gradient = createDefaultGradientSettings("radial") as RadialGradientSettings;
    expect(gradient.type).toBe("radial");
    expect(gradient.shape).toBe("ellipse");
    expect(gradient.position).toBe("center");
    expect(gradient.stops).toHaveLength(2);
  });

  it("gives every stop a unique, non-empty id", () => {
    const gradient = createDefaultGradientSettings("linear");
    expect(gradient.stops[0].id).not.toBe("");
    expect(gradient.stops[0].id).not.toBe(gradient.stops[1].id);
  });
});

describe("generateGradientStopId", () => {
  it("generates unique ids across calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateGradientStopId()));
    expect(ids.size).toBe(50);
  });
});

describe("withGradientType", () => {
  it("is a no-op (same reference) when already the requested type", () => {
    const gradient = createDefaultGradientSettings("linear");
    expect(withGradientType(gradient, "linear")).toBe(gradient);
  });

  it("switches linear to radial, reusing the same stops and defaulting shape/position", () => {
    const linear = createDefaultGradientSettings("linear");
    const radial = withGradientType(linear, "radial") as RadialGradientSettings;
    expect(radial.type).toBe("radial");
    expect(radial.shape).toBe("ellipse");
    expect(radial.position).toBe("center");
    expect(radial.stops).toBe(linear.stops);
  });

  it("switches radial to linear, reusing the same stops and defaulting the angle", () => {
    const radial = createDefaultGradientSettings("radial");
    const linear = withGradientType(radial, "linear") as LinearGradientSettings;
    expect(linear.type).toBe("linear");
    expect(linear.angle).toBe(90);
    expect(linear.stops).toBe(radial.stops);
  });
});

describe("sortGradientStops", () => {
  it("sorts ascending by position", () => {
    const sorted = sortGradientStops([stop("c", "#000", 80), stop("a", "#111", 10), stop("b", "#222", 50)]);
    expect(sorted.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("preserves relative order for equal positions (stable sort)", () => {
    const sorted = sortGradientStops([stop("a", "#000", 50), stop("b", "#111", 50), stop("c", "#222", 0)]);
    expect(sorted.map((s) => s.id)).toEqual(["c", "a", "b"]);
  });
});

describe("addGradientStop", () => {
  it("adds and re-sorts by position", () => {
    const gradient = createDefaultGradientSettings("linear");
    const next = addGradientStop(gradient, stop("mid", "#888888", 50));
    expect(next.stops.map((s) => s.id)).toEqual([gradient.stops[0].id, "mid", gradient.stops[1].id]);
  });

  it("is a no-op (same reference) at MAX_GRADIENT_STOPS", () => {
    let gradient: GradientSettings = createDefaultGradientSettings("linear");
    for (let i = 0; i < MAX_GRADIENT_STOPS - 2; i++) {
      gradient = addGradientStop(gradient, stop(`s${i}`, "#123456", i + 1));
    }
    expect(gradient.stops).toHaveLength(MAX_GRADIENT_STOPS);
    const result = addGradientStop(gradient, stop("overflow", "#654321", 99));
    expect(result).toBe(gradient);
  });
});

describe("removeGradientStop", () => {
  it("removes the stop with the matching id", () => {
    const gradient = addGradientStop(createDefaultGradientSettings("linear"), stop("mid", "#888888", 50));
    const next = removeGradientStop(gradient, "mid");
    expect(next.stops.map((s) => s.id)).not.toContain("mid");
    expect(next.stops).toHaveLength(2);
  });

  it("is a no-op (same reference) when only MIN_GRADIENT_STOPS remain", () => {
    const gradient = createDefaultGradientSettings("linear");
    expect(gradient.stops).toHaveLength(MIN_GRADIENT_STOPS);
    const result = removeGradientStop(gradient, gradient.stops[0].id);
    expect(result).toBe(gradient);
  });

  it("is a no-op (same reference) when the id doesn't exist", () => {
    const gradient = createDefaultGradientSettings("linear");
    expect(removeGradientStop(gradient, "does-not-exist")).toBe(gradient);
  });
});

describe("updateGradientStop", () => {
  it("updates a stop's color by id", () => {
    const gradient = createDefaultGradientSettings("linear");
    const targetId = gradient.stops[0].id;
    const next = updateGradientStop(gradient, targetId, { color: "#3366ff" });
    expect(next.stops.find((s) => s.id === targetId)?.color).toBe("#3366ff");
  });

  it("updates a stop's position and re-sorts, preserving identity", () => {
    const gradient = createDefaultGradientSettings("linear");
    const firstId = gradient.stops[0].id;
    const secondId = gradient.stops[1].id;
    // Moves the first stop (originally 0%) past the second (100%) so a real
    // reorder happens — the moved stop must still be found by its own id
    // afterward, now at the far end of the sorted array, never by index.
    const next = updateGradientStop(gradient, firstId, { position: 150 });
    expect(next.stops.map((s) => s.id)).toEqual([secondId, firstId]);
    expect(next.stops.find((s) => s.id === firstId)?.position).toBe(150);
  });

  it("is a no-op (same reference) when the id doesn't exist", () => {
    const gradient = createDefaultGradientSettings("linear");
    expect(updateGradientStop(gradient, "does-not-exist", { color: "#000" })).toBe(gradient);
  });
});

describe("computeNewStopPosition", () => {
  it("picks the midpoint of the largest gap, including the implicit 0/100 edges", () => {
    expect(computeNewStopPosition([stop("a", "#000", 0), stop("b", "#fff", 100)])).toBe(50);
  });

  it("finds the largest gap among several stops, not just the edges", () => {
    expect(computeNewStopPosition([stop("a", "#000", 0), stop("b", "#111", 30), stop("c", "#fff", 100)])).toBe(65);
  });
});

describe("nearestStopColor", () => {
  it("returns the color of whichever stop is closest to the given position", () => {
    const stops = [stop("a", "#000000", 0), stop("b", "#ffffff", 100)];
    expect(nearestStopColor(stops, 10)).toBe("#000000");
    expect(nearestStopColor(stops, 90)).toBe("#ffffff");
  });
});

describe("normalizeGradientAngle", () => {
  it("passes through an in-range angle unchanged", () => {
    expect(normalizeGradientAngle(90)).toBe(90);
    expect(normalizeGradientAngle(0)).toBe(0);
  });

  it("wraps an angle of 360 or more back into [0, 360)", () => {
    expect(normalizeGradientAngle(370)).toBe(10);
    expect(normalizeGradientAngle(720)).toBe(0);
  });

  it("wraps a negative angle into [0, 360)", () => {
    expect(normalizeGradientAngle(-90)).toBe(270);
  });

  it("leaves a non-finite angle unchanged rather than producing NaN silently accepted elsewhere", () => {
    expect(normalizeGradientAngle(Number.NaN)).toBeNaN();
  });
});

describe("isValidGradientStopPosition", () => {
  it("accepts 0, 100, and values in between", () => {
    expect(isValidGradientStopPosition(0)).toBe(true);
    expect(isValidGradientStopPosition(100)).toBe(true);
    expect(isValidGradientStopPosition(42.5)).toBe(true);
  });

  it("rejects out-of-range and non-finite values", () => {
    expect(isValidGradientStopPosition(-1)).toBe(false);
    expect(isValidGradientStopPosition(101)).toBe(false);
    expect(isValidGradientStopPosition(Number.NaN)).toBe(false);
    expect(isValidGradientStopPosition(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("isValidGradientSettings", () => {
  it("accepts a well-formed linear gradient", () => {
    expect(isValidGradientSettings(createDefaultGradientSettings("linear"))).toBe(true);
  });

  it("accepts a well-formed radial gradient", () => {
    expect(isValidGradientSettings(createDefaultGradientSettings("radial"))).toBe(true);
  });

  it("rejects a gradient with fewer than MIN_GRADIENT_STOPS stops", () => {
    expect(isValidGradientSettings({ type: "linear", angle: 90, stops: [stop("a", "#000", 0)] })).toBe(false);
  });

  it("rejects duplicate or empty stop ids", () => {
    expect(isValidGradientSettings({ type: "linear", angle: 90, stops: [stop("a", "#000", 0), stop("a", "#fff", 100)] })).toBe(false);
    expect(isValidGradientSettings({ type: "linear", angle: 90, stops: [stop("", "#000", 0), stop("b", "#fff", 100)] })).toBe(false);
  });

  it("rejects an invalid stop color", () => {
    expect(isValidGradientSettings({ type: "linear", angle: 90, stops: [stop("a", "not-a-color", 0), stop("b", "#fff", 100)] })).toBe(false);
  });

  it("rejects an out-of-range stop position", () => {
    expect(isValidGradientSettings({ type: "linear", angle: 90, stops: [stop("a", "#000", -5), stop("b", "#fff", 100)] })).toBe(false);
  });

  it("rejects a non-finite linear angle", () => {
    expect(isValidGradientSettings({ type: "linear", angle: Number.NaN, stops: [stop("a", "#000", 0), stop("b", "#fff", 100)] })).toBe(false);
  });

  it("rejects an unsupported radial shape or position", () => {
    expect(isValidGradientSettings({ type: "radial", shape: "square", position: "center", stops: [stop("a", "#000", 0), stop("b", "#fff", 100)] })).toBe(false);
    expect(isValidGradientSettings({ type: "radial", shape: "ellipse", position: "north", stops: [stop("a", "#000", 0), stop("b", "#fff", 100)] })).toBe(false);
  });

  it("rejects a malformed value entirely (not even an object)", () => {
    expect(isValidGradientSettings("linear-gradient(90deg, red, blue)")).toBe(false);
    expect(isValidGradientSettings(null)).toBe(false);
    expect(isValidGradientSettings(undefined)).toBe(false);
  });
});

describe("formatLinearGradientCss / formatRadialGradientCss / formatGradientCss", () => {
  it("formats a linear gradient", () => {
    const gradient: LinearGradientSettings = { type: "linear", angle: 90, stops: [stop("a", "#ff0000", 0), stop("b", "#0000ff", 100)] };
    expect(formatLinearGradientCss(gradient)).toBe("linear-gradient(90deg, #ff0000 0%, #0000ff 100%)");
  });

  it("formats a radial gradient with the correct nine-point position mapping", () => {
    const gradient: RadialGradientSettings = {
      type: "radial",
      shape: "ellipse",
      position: "top-left",
      stops: [stop("a", "#ff0000", 0), stop("b", "#0000ff", 100)],
    };
    expect(formatRadialGradientCss(gradient)).toBe("radial-gradient(ellipse at left top, #ff0000 0%, #0000ff 100%)");
  });

  it("formats a circle shape verbatim", () => {
    const gradient: RadialGradientSettings = { type: "radial", shape: "circle", position: "center", stops: [stop("a", "#ff0000", 0), stop("b", "#0000ff", 100)] };
    expect(formatRadialGradientCss(gradient)).toBe("radial-gradient(circle at center, #ff0000 0%, #0000ff 100%)");
  });

  it("preserves multiple stops in position order regardless of storage order", () => {
    const gradient: LinearGradientSettings = {
      type: "linear",
      angle: 45,
      stops: [stop("c", "#333333", 80), stop("a", "#111111", 10), stop("b", "#222222", 50)],
    };
    expect(formatLinearGradientCss(gradient)).toBe(
      "linear-gradient(45deg, #111111 10%, #222222 50%, #333333 80%)",
    );
  });

  it("preserves rgba()/hsl() stop colors verbatim, without normalizing to hex", () => {
    const gradient: LinearGradientSettings = {
      type: "linear",
      angle: 90,
      stops: [stop("a", "rgba(255, 0, 0, 0.5)", 0), stop("b", "hsl(200, 50%, 50%)", 100)],
    };
    expect(formatLinearGradientCss(gradient)).toBe("linear-gradient(90deg, rgba(255, 0, 0, 0.5) 0%, hsl(200, 50%, 50%) 100%)");
  });

  it("formatGradientCss dispatches to the correct formatter by type", () => {
    expect(formatGradientCss(createDefaultGradientSettings("linear"))).toMatch(/^linear-gradient\(/);
    expect(formatGradientCss(createDefaultGradientSettings("radial"))).toMatch(/^radial-gradient\(/);
  });

  it("formatGradientCss returns null (never throws) for a structurally invalid gradient", () => {
    const invalid = { type: "linear", angle: 90, stops: [stop("a", "#000", 0)] } as unknown as GradientSettings;
    expect(formatGradientCss(invalid)).toBeNull();
  });
});

describe("formatGradientStopsCss", () => {
  it("always renders a left-to-right linear strip regardless of the real gradient's type", () => {
    const stops = [stop("a", "#ff0000", 0), stop("b", "#0000ff", 100)];
    expect(formatGradientStopsCss(stops)).toBe("linear-gradient(to right, #ff0000 0%, #0000ff 100%)");
  });
});
