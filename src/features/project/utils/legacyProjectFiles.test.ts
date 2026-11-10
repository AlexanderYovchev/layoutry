import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadProjectFromFile } from "@/features/project/utils/loadProjectFromFile";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";
import { serializeProject } from "@/features/project/utils/serializeProject";

/**
 * PROJECT-1.5 legacy compatibility: `.layoutry` files frozen from earlier
 * checkpoints (test/fixtures/persistence/README.md says how each was
 * made) must keep opening, and keep serializing to the same bytes, in
 * every later build.
 */

function fixture(name: string): Buffer {
  return readFileSync(
    path.join(process.cwd(), "test", "fixtures", "persistence", name),
  );
}

/** The format 1 → 2 rule, written independently of the migration: drop spacing sides that are 0, then empty boxes. */
function stripSpacingZeros(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSpacingZeros);
  if (typeof value !== "object" || value === null) return value;
  const entries = Object.entries(value).map(
    ([key, child]): [string, unknown] => {
      if (key !== "spacing" || typeof child !== "object" || child === null)
        return [key, stripSpacingZeros(child)];
      const boxes = Object.entries(child).flatMap(([box, edges]) => {
        const kept = Object.entries(edges as Record<string, unknown>).filter(
          ([, side]) => side !== 0,
        );
        return kept.length > 0 ? [[box, Object.fromEntries(kept)]] : [];
      });
      return [key, Object.fromEntries(boxes)];
    },
  );
  return Object.fromEntries(entries);
}

describe("project files from earlier checkpoints", () => {
  it("opens the PROJECT-1.1 file with every element type", () => {
    const text = fixture("project-1.1-every-element.layoutry").toString("utf8");
    const result = parseProjectFile(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.metadata).toEqual({
      id: "0b6f1c2e-6a8d-4c3e-9f7a-2d5b8e1c4a90",
      name: "Untitled Project",
      createdAt: "2026-10-26T12:00:00.000Z",
      updatedAt: "2026-10-26T12:00:00.000Z",
    });
    expect(result.project.document.children?.length).toBeGreaterThan(10);
  });

  it("migrates the PROJECT-1.1 file to format 2, changing nothing but its spacing zeros (BC-05.3)", () => {
    const text = fixture("project-1.1-every-element.layoutry").toString("utf8");
    const result = parseProjectFile(text);
    if (!result.ok) throw new Error(result.error.message);
    const saved: unknown = JSON.parse(serializeProject(result.project));
    const original: unknown = JSON.parse(text);

    // Saving writes format 2. Removing every spacing side that was 0 (and
    // any box left empty) from the original gives exactly the saved file:
    // nothing else was touched, and every non-zero side survived.
    expect(saved).toEqual(
      Object.assign({}, stripSpacingZeros(original), { formatVersion: 2 }),
    );
    expect(JSON.stringify(original)).toMatch(/"padding":\{"bottom":0/);
    expect(JSON.stringify(saved)).not.toMatch(
      /"(top|right|bottom|left)":0[,}]/,
    );
  });

  it("re-saves a format 2 file to the very same bytes (BC-05.3 fixture, authored zeros included)", () => {
    const text = fixture("project-2-spacing-zero.layoutry").toString("utf8");
    const result = parseProjectFile(text);
    if (!result.ok) throw new Error(result.error.message);
    const button = result.project.document.children?.find(
      (node) => node.id === "zero-button",
    );
    expect(button?.spacing).toEqual({
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    expect(serializeProject(result.project)).toBe(text);
  });

  it("opens a PROJECT-1.3 native file, through the browser import as well", async () => {
    const bytes = fixture("native-site-original-1.3.layoutry");
    const parsed = parseProjectFile(bytes.toString("utf8"));
    const imported = await loadProjectFromFile(
      new Blob([new Uint8Array(bytes)]),
    );
    expect(parsed.ok).toBe(true);
    expect(imported).toEqual(parsed);
  });

  it("still opens the PROJECT-1.1 file after a text editor added a byte order mark", async () => {
    const bytes = fixture("project-1.1-every-element.layoutry");
    const withBom = new Blob([
      new Uint8Array([0xef, 0xbb, 0xbf]),
      new Uint8Array(bytes),
    ]);
    const result = await loadProjectFromFile(withBom);
    expect(result).toEqual(parseProjectFile(bytes.toString("utf8")));
  });
});
