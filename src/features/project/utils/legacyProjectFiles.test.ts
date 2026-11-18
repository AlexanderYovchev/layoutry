import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadProjectFromFile } from "@/features/project/utils/loadProjectFromFile";
import { parseProjectFile } from "@/features/project/utils/parseProjectFile";
import { serializeProject } from "@/features/project/utils/serializeProject";
import type { EditorElementNode } from "@/features/editor/types/document";
import { isVideoEmbedNode } from "@/features/editor/types/videoEmbed";
import { exportHtmlCss } from "@/features/export/utils/exportHtmlCss";
import { isNavigationLinkContainer } from "@/features/editor/commands/navigationLinkCommands";
import { isPaginationNode } from "@/features/editor/types/pagination";

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

  it("migrates the PROJECT-1.1 file to the current format, changing nothing but its spacing zeros (BC-05.3; 2 → 3 changes nothing, BC-09.2)", () => {
    const text = fixture("project-1.1-every-element.layoutry").toString("utf8");
    const result = parseProjectFile(text);
    if (!result.ok) throw new Error(result.error.message);
    const saved: unknown = JSON.parse(serializeProject(result.project));
    const original: unknown = JSON.parse(text);

    // Saving writes format 3. Removing every spacing side that was 0 (and
    // any box left empty) from the original gives exactly the saved file:
    // nothing else was touched, and every non-zero side survived.
    expect(saved).toEqual(
      Object.assign({}, stripSpacingZeros(original), { formatVersion: 3 }),
    );
    expect(JSON.stringify(original)).toMatch(/"padding":\{"bottom":0/);
    expect(JSON.stringify(saved)).not.toMatch(
      /"(top|right|bottom|left)":0[,}]/,
    );
  });

  it("re-saves a format 2 file to the very same bytes apart from its format version (BC-05.3 fixture, authored zeros included)", () => {
    const text = fixture("project-2-spacing-zero.layoutry").toString("utf8");
    const result = parseProjectFile(text);
    if (!result.ok) throw new Error(result.error.message);
    const button = result.project.document.children?.find(
      (node) => node.id === "zero-button",
    );
    expect(button?.spacing).toEqual({
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    expect(serializeProject(result.project)).toBe(
      text.replace('"formatVersion": 2,', '"formatVersion": 3,'),
    );
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

/**
 * BC-08.5: Video Embed (BC-08.2) added no field and no format version. An
 * Embed in an older file stays a generic Embed — even one already showing a
 * YouTube player link — and is never turned into a Video Embed by opening,
 * migrating, saving or exporting it.
 */
describe("Embeds in format 1 files stay generic Embeds (BC-08.5)", () => {
  const iframes = (node: EditorElementNode): EditorElementNode[] => [
    ...(node.tag === "iframe" ? [node] : []),
    ...(node.children ?? []).flatMap(iframes),
  ];

  it("the PROJECT-1.1 file's Embed opens unchanged and is not a Video Embed", () => {
    const result = parseProjectFile(
      fixture("project-1.1-every-element.layoutry").toString("utf8"),
    );
    if (!result.ok) throw new Error(result.error.message);
    expect(iframes(result.project.document)).toEqual([
      { id: "iframe-a6d7e769", tag: "iframe", title: "Embedded content" },
    ]);
    expect(iframes(result.project.document).some(isVideoEmbedNode)).toBe(false);
  });

  it("a format 1 Embed with a provider player link keeps its exact src, gains no player settings, and exports as a generic Embed", () => {
    const raw: unknown = JSON.parse(
      fixture("project-1.1-every-element.layoutry").toString("utf8"),
    );
    if (typeof raw !== "object" || raw === null)
      throw new Error("fixture is not an object");
    const document: unknown = Reflect.get(raw, "document");
    if (typeof document !== "object" || document === null)
      throw new Error("fixture has no document");
    const legacy = {
      id: "legacy-youtube",
      tag: "iframe",
      src: "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1",
      title: "Old embed",
    };
    const children: unknown = Reflect.get(document, "children");
    if (!Array.isArray(children))
      throw new Error("fixture page has no children");
    Reflect.set(document, "children", [...children, legacy]);
    const result = parseProjectFile(JSON.stringify(raw));
    if (!result.ok) throw new Error(result.error.message);
    const opened = iframes(result.project.document).find(
      (node) => node.id === "legacy-youtube",
    );
    expect(opened).toEqual(legacy);
    expect(opened && isVideoEmbedNode(opened)).toBe(false);
    const saved = parseProjectFile(serializeProject(result.project));
    if (!saved.ok) throw new Error(saved.error.message);
    expect(
      iframes(saved.project.document).find(
        (node) => node.id === "legacy-youtube",
      ),
    ).toEqual(legacy);
    const html = exportHtmlCss(result.project.document, { mode: "standalone" })
      .files[0].content;
    const frame = html.match(/<iframe[^>]*Old embed[^>]*>/)?.[0] ?? "";
    expect(frame).toContain(
      `src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1"`,
    );
    expect(frame).not.toContain("data-ly-video-src");
    expect(frame).not.toContain("allow=");
  });
});

/**
 * BC-09.2: `project-2-legacy-pagination.layoutry` was written by the
 * BC-08.5 code (c6a0448), before format 3: a Navbar, Breadcrumbs, the old
 * Pagination preset (Previous/Next Buttons, no marker, no ARIA) with an
 * interaction on Next, and the interaction's target. Its export files were
 * written by the same code. Opening it in format 3 must change nothing.
 */
describe("a format 2 project with the old Pagination (BC-09.2)", () => {
  const text = () =>
    fixture("project-2-legacy-pagination.layoutry").toString("utf8");
  const open = () => {
    const result = parseProjectFile(text());
    if (!result.ok) throw new Error(result.error.message);
    return result.project;
  };
  const navs = (document: EditorElementNode) =>
    (document.children ?? []).filter((node) => node.tag === "nav");

  it("opens with every node, id, style and interaction exactly as written", () => {
    const raw: unknown = JSON.parse(text());
    expect(open().document).toEqual(Reflect.get(Object(raw), "document"));
  });

  it("re-saves to the same bytes apart from its format version", () => {
    expect(serializeProject(open())).toBe(
      text().replace('"formatVersion": 2,', '"formatVersion": 3,'),
    );
  });

  it("keeps the old Pagination as an ordinary nav: Buttons, no marker, no accessibility fields", () => {
    const [navbar, breadcrumbs, pagination] = navs(open().document);
    expect(pagination.children?.map((child) => child.tag)).toEqual([
      "button",
      "a",
      "a",
      "a",
      "button",
    ]);
    for (const nav of [navbar, breadcrumbs, pagination]) {
      expect(isPaginationNode(nav)).toBe(false);
      // The generic Navigation links section still manages all three.
      expect(isNavigationLinkContainer(nav)).toBe(true);
    }
    expect(JSON.stringify(open().document)).not.toMatch(
      /"(ariaLabel|ariaCurrent|disabled|component)"/,
    );
  });

  it("exports byte-for-byte what the BC-08.5 code exported", () => {
    const files = exportHtmlCss(open().document, { mode: "separate" }).files;
    expect(files.map((file) => file.path).sort()).toEqual([
      "index.html",
      "script.js",
      "styles.css",
    ]);
    for (const file of files)
      expect(file.content).toBe(
        fixture(`project-2-legacy-pagination.export.${file.path}`).toString(
          "utf8",
        ),
      );
  });
});

describe("the first format 3 file (BC-09.2 fixture)", () => {
  it("re-saves to the very same bytes, with the marker and every accessibility field kept", () => {
    const text = fixture("project-3-pagination.layoutry").toString("utf8");
    const result = parseProjectFile(text);
    if (!result.ok) throw new Error(result.error.message);
    expect(serializeProject(result.project)).toBe(text);
    const [header, pagination, step] = result.project.document.children ?? [];
    expect(header.ariaLabel).toBe("Site header");
    expect(header.children?.[0].disabled).toBe(true);
    expect(isPaginationNode(pagination)).toBe(true);
    expect(pagination.ariaLabel).toBe("Pagination");
    expect(
      pagination.children?.map(
        (child) => child.ariaCurrent ?? child.disabled ?? null,
      ),
    ).toEqual([true, "page", null, null, null]);
    expect(step.ariaCurrent).toBe("step");
  });
});
