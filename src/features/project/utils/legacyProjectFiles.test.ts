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

describe("project files from earlier checkpoints", () => {
  it("opens the PROJECT-1.1 file with every element type, unchanged", () => {
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
    // Canonical serialization is stable across checkpoints: saving it
    // again without changes produces the very same bytes.
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
