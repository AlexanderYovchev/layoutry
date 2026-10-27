// @vitest-environment node
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { compile } from "tailwindcss";
import { beforeAll, describe, expect, it } from "vitest";
import {
  DOCUMENT_DEFAULT_STYLE_IDS,
  DOCUMENT_DEFAULT_STYLES,
  documentDefaultClasses,
  type DocumentDefaultStyleId,
} from "@/features/canvas/utils/documentDefaultStyles";
import type { CssDeclaration } from "@/features/canvas/types/documentDefaultStyle";

/**
 * Proves every default's hand-written `declarations` are exactly what its
 * Canvas `classes` compile to with this repo's own Tailwind — so HTML/CSS
 * export reproduces the Canvas defaults instead of approximating them.
 */

const require = createRequire(import.meta.url);
const tailwindDir = path.dirname(require.resolve("tailwindcss/package.json"));

interface CssBlock {
  prelude: string;
  declarations: CssDeclaration[];
  blocks: CssBlock[];
}

// Every default's classes compiled together once. Tailwind's compiler is
// incremental (build() keeps every candidate it has seen), and its global
// output order is exactly the cascade order the Canvas gets, so each check
// selects its own classes' rules out of this one build.
let compiledBlocks: CssBlock[] = [];

beforeAll(async () => {
  const compiler = await compile(
    '@import "tailwindcss/theme.css" theme(reference); @import "tailwindcss/utilities.css";',
    {
      base: tailwindDir,
      loadStylesheet: async (id) => {
        const file = path.join(tailwindDir, id.replace(/^tailwindcss\//, ""));
        return { path: file, base: path.dirname(file), content: fs.readFileSync(file, "utf8") };
      },
    },
  );
  const candidates = DOCUMENT_DEFAULT_STYLE_IDS.flatMap((id) => DOCUMENT_DEFAULT_STYLES[id].classes.split(" "));
  compiledBlocks = parseBlocks(compiler.build(candidates));
});

/** The `.h-13\.5`-style selector Tailwind emits for one candidate. */
function classSelector(candidate: string): string {
  return `.${candidate.replace(/([.:/])/g, "\\$1")}`;
}

/** Minimal parser for Tailwind's own (well-formed, comment-free after stripping) output. */
function parseBlocks(css: string): CssBlock[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let index = 0;
  function parseBody(): { declarations: CssDeclaration[]; blocks: CssBlock[] } {
    const declarations: CssDeclaration[] = [];
    const blocks: CssBlock[] = [];
    let buffer = "";
    while (index < source.length) {
      const char = source[index++];
      if (char === "{") {
        const body = parseBody();
        blocks.push({ prelude: buffer.trim(), ...body });
        buffer = "";
      } else if (char === "}") {
        break;
      } else if (char === ";") {
        const colon = buffer.indexOf(":");
        if (colon > 0) declarations.push([buffer.slice(0, colon).trim(), buffer.slice(colon + 1).trim()]);
        buffer = "";
      } else {
        buffer += char;
      }
    }
    return { declarations, blocks };
  }
  return parseBody().blocks;
}

function splitTopLevel(value: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === separator && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts;
}

function resolveVars(value: string, customProperties: Map<string, string>): string {
  const start = value.indexOf("var(");
  if (start === -1) return value;
  let depth = 0;
  let end = start + 3;
  for (; end < value.length; end++) {
    if (value[end] === "(") depth++;
    if (value[end] === ")") {
      depth--;
      if (depth === 0) break;
    }
  }
  const [name, ...fallbackParts] = splitTopLevel(value.slice(start + 4, end), ",");
  const resolved = customProperties.get(name) ?? fallbackParts.join(", ");
  return resolveVars(value.slice(0, start) + resolveVars(resolved, customProperties) + value.slice(end + 1), customProperties);
}

function normalizeValue(property: string, value: string): string {
  let normalized = value
    .replace(/calc\(([\d.]+)rem \* ([\d.]+)\)/g, (_, base: string, factor: string) => `${Number((Number(base) * Number(factor)).toFixed(6))}rem`)
    .replace(/\s+/g, " ")
    .trim();
  if (property === "box-shadow") {
    normalized = splitTopLevel(normalized, ",")
      .filter((layer) => layer !== "0 0 #0000")
      .join(", ");
  }
  return normalized;
}

interface CompiledDefaults {
  declarations: Map<string, string>;
  media: Map<string, Map<string, string>>;
  backdrop: Map<string, string>;
}

/** The effective declarations an element carrying `classes` receives, after Tailwind's own cascade order. */
function compileEffective(classes: string): CompiledDefaults {
  const selectors = new Set(
    classes
      .split(/\s+/)
      .filter((candidate) => candidate && !candidate.startsWith("dark:"))
      .map(classSelector),
  );
  const blocks = compiledBlocks.filter((block) => block.prelude.startsWith("@property") || selectors.has(block.prelude));

  const initialValues = new Map<string, string>();
  for (const block of blocks) {
    if (!block.prelude.startsWith("@property")) continue;
    const initial = block.declarations.find(([property]) => property === "initial-value");
    if (initial) initialValues.set(block.prelude.replace("@property", "").trim(), initial[1]);
  }

  const raw: CssDeclaration[] = [];
  const media = new Map<string, CssDeclaration[]>();
  const backdrop: CssDeclaration[] = [];
  for (const block of blocks) {
    if (!block.prelude.startsWith(".")) continue;
    raw.push(...block.declarations);
    for (const nested of block.blocks) {
      if (nested.prelude.startsWith("@media")) {
        const query = nested.prelude.replace("@media", "").trim();
        media.set(query, [...(media.get(query) ?? []), ...nested.declarations]);
      } else if (nested.prelude === "&::backdrop") {
        backdrop.push(...nested.declarations, ...nested.blocks.flatMap((inner) => inner.declarations));
      }
    }
  }

  const customProperties = new Map(initialValues);
  for (const [property, value] of raw) if (property.startsWith("--")) customProperties.set(property, value);

  function effective(declarations: readonly CssDeclaration[]): Map<string, string> {
    const result = new Map<string, string>();
    for (const [property, value] of declarations) {
      if (property.startsWith("--")) continue;
      result.set(property, normalizeValue(property, resolveVars(value, customProperties)));
    }
    return result;
  }

  return {
    declarations: effective(raw),
    media: new Map([...media].map(([query, declarations]) => [query, effective(declarations)])),
    backdrop: effective(backdrop),
  };
}

function lastWins(declarations: readonly CssDeclaration[]): Map<string, string> {
  return new Map(declarations.map(([property, value]) => [property, normalizeValue(property, value)]));
}

describe("DOCUMENT_DEFAULT_STYLES", () => {
  it.each(DOCUMENT_DEFAULT_STYLE_IDS)("%s declarations equal its compiled Tailwind classes", (id) => {
    const entry = DOCUMENT_DEFAULT_STYLES[id];
    const compiled = compileEffective(entry.classes);

    expect(lastWins(entry.declarations)).toEqual(compiled.declarations);
    if ("media" in entry) {
      expect(compiled.media).toEqual(new Map([[entry.media.query, lastWins(entry.media.declarations)]]));
    } else {
      expect(compiled.media.size).toBe(0);
    }
    if ("backdrop" in entry) {
      expect(lastWins(entry.backdrop)).toEqual(compiled.backdrop);
    } else {
      expect(compiled.backdrop.size).toBe(0);
    }
  });

  // Ids an element combines whose declarations overlap: the later id in
  // table order must win exactly like the later Tailwind utility does.
  const overlappingCombinations: DocumentDefaultStyleId[][] = [["table-cell", "table-header-cell"]];

  it.each(overlappingCombinations)("combination %s + %s cascades like the Canvas", (...ids) => {
    const merged = ids.flatMap((id) => DOCUMENT_DEFAULT_STYLES[id].declarations);
    expect(lastWins(merged)).toEqual(compileEffective(documentDefaultClasses(ids)).declarations);
    expect(ids).toEqual([...ids].sort((a, b) => DOCUMENT_DEFAULT_STYLE_IDS.indexOf(a) - DOCUMENT_DEFAULT_STYLE_IDS.indexOf(b)));
  });

  it("joins class strings in the order given", () => {
    expect(documentDefaultClasses(["container-radius", "container-padding"])).toBe("rounded-lg p-8");
  });
});
