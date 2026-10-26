import { describe, expect, it } from "vitest";
import {
  containsControlCharacters,
  MAX_PROJECT_NAME_LENGTH,
  normalizeProjectName,
} from "@/features/project/rules/projectName";
import { projectMetadataSchema } from "@/features/project/schemas/projectFileSchema";
import { createProjectMetadata } from "@/features/project/utils/serializeProject";

describe("normalizeProjectName", () => {
  it("trims the ends and collapses runs of spaces", () => {
    expect(normalizeProjectName("  Landing   page  ")).toEqual({
      ok: true,
      name: "Landing page",
    });
  });

  it("keeps ordinary punctuation and non-Latin text", () => {
    expect(normalizeProjectName("Café: v2 / “final” — 日本")).toEqual({
      ok: true,
      name: "Café: v2 / “final” — 日本",
    });
  });

  it.each(["", "   "])("rejects an empty name %j", (input) => {
    expect(normalizeProjectName(input)).toEqual({
      ok: false,
      message: "Enter a project name.",
    });
  });

  it("rejects names over the length limit, measured after trimming", () => {
    expect(
      normalizeProjectName(`  ${"a".repeat(MAX_PROJECT_NAME_LENGTH)}  `).ok,
    ).toBe(true);
    expect(
      normalizeProjectName("a".repeat(MAX_PROJECT_NAME_LENGTH + 1)).ok,
    ).toBe(false);
  });

  it.each(["line\nbreak", "tab\there", "nul\u0000", "del\u007f", "c1\u0085"])(
    "rejects control characters (%j)",
    (input) => {
      expect(normalizeProjectName(input).ok).toBe(false);
      expect(containsControlCharacters(input)).toBe(true);
    },
  );
});

describe("project file schema uses the same name rules", () => {
  it("rejects a control-character name from an untrusted file", () => {
    const metadata = { ...createProjectMetadata(), name: "evil\u001b[31m" };
    expect(projectMetadataSchema.safeParse(metadata).success).toBe(false);
  });

  it("accepts every name the Rename dialog accepts", () => {
    const result = normalizeProjectName("  My   project ");
    if (!result.ok) throw new Error("expected a valid name");
    expect(
      projectMetadataSchema.safeParse({
        ...createProjectMetadata(),
        name: result.name,
      }).success,
    ).toBe(true);
  });
});
