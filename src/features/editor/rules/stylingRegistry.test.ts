import { describe, expect, it } from "vitest";
import {
  createElementNode,
  INSERTABLE_ELEMENT_TYPES,
} from "@/features/editor/factories/elementFactories";
import { getElementCapabilities } from "@/features/editor/rules/elementCapabilities";
import { KNOWN_ELEMENT_TAGS } from "@/features/editor/rules/knownElementTags";
import {
  getStylingCapabilities,
  isCuratedCompound,
  isStylingFeatureAuthorable,
  PROFILED_TAGS,
  resolveStylingProfile,
  STYLING_AUTHORING_AVAILABILITY,
} from "@/features/editor/rules/stylingRegistry";
import type { EditorElementNode } from "@/features/editor/types/document";
import {
  stateAtomRank,
  STYLE_TARGET_IDS,
  STYLING_PROFILES,
} from "@/features/editor/types/styleRules";

function subtree(root: EditorElementNode): EditorElementNode[] {
  return [root, ...(root.children ?? []).flatMap(subtree)];
}

describe("styling registry coverage (BC-17.2)", () => {
  it("gives every known element tag a profile, and profiles no unknown tag", () => {
    expect(
      [...KNOWN_ELEMENT_TAGS].filter(
        (tag) => resolveStylingProfile({ tag }) === undefined,
      ),
    ).toEqual([]);
    expect(PROFILED_TAGS.filter((tag) => !KNOWN_ELEMENT_TAGS.has(tag))).toEqual(
      [],
    );
    expect(resolveStylingProfile({ tag: "script" })).toBeUndefined();
  });

  it.each(INSERTABLE_ELEMENT_TYPES)(
    "resolves capabilities for every node the %s factory creates",
    (type) => {
      for (const node of subtree(createElementNode(type))) {
        const capabilities = getStylingCapabilities(node);
        expect(capabilities, `${type}: ${node.tag}`).toBeDefined();
        expect(capabilities?.targets.has("element")).toBe(true);
      }
    },
  );

  it("uses every declared profile, and every target id belongs to some profile", () => {
    const nodes: EditorElementNode[] = [
      ...[...KNOWN_ELEMENT_TAGS].map((tag) => ({ id: "x", tag })),
      { id: "c", tag: "input", inputType: "checkbox" },
      { id: "r", tag: "input", inputType: "radio" },
      { id: "s", tag: "input", inputType: "search" },
      { id: "n", tag: "input", inputType: "number" },
      { id: "p", tag: "progress", progressVariant: "custom" },
      { id: "nav", tag: "nav", component: "pagination" },
    ];
    const profiles = new Set(nodes.map((node) => resolveStylingProfile(node)));
    expect(
      STYLING_PROFILES.filter((profile) => !profiles.has(profile)),
    ).toEqual([]);
    const targets = new Set(
      nodes.flatMap((node) => [
        ...(getStylingCapabilities(node)?.targets.keys() ?? []),
      ]),
    );
    // Tabs, navigation and breadcrumb role groups need their component markers (BC-17.14/17.15); none exists yet.
    const unoffered = STYLE_TARGET_IDS.filter((target) => !targets.has(target));
    expect(unoffered.sort()).toEqual([
      "breadcrumb.separator",
      "nav.cta",
      "nav.current",
      "nav.link",
      "tabs.list",
      "tabs.panel",
      "tabs.tab",
    ]);
  });

  it("derives element groups from elementCapabilities (one source of truth)", () => {
    for (const tag of KNOWN_ELEMENT_TAGS) {
      const capabilities = getElementCapabilities(tag);
      const groups = getStylingCapabilities({ tag })?.targets.get(
        "element",
      )?.groups;
      expect(groups?.has("background"), tag).toBe(
        capabilities.supportsBackground,
      );
      expect(groups?.has("border"), tag).toBe(capabilities.supportsBorder);
      expect(groups?.has("boxShadow"), tag).toBe(
        capabilities.supportsBoxShadow,
      );
      expect(groups?.has("shape"), tag).toBe(capabilities.supportsShape);
      expect(groups?.has("mediaFit"), tag).toBe(capabilities.supportsMediaFit);
      expect(groups?.has("transform"), tag).toBe(
        capabilities.supportsTransform,
      );
    }
  });
});

describe("targets, states and compounds", () => {
  it("separates the native and custom Progress parts, sharing track and fill", () => {
    const native = [
      ...(getStylingCapabilities({ tag: "progress" })?.targets.keys() ?? []),
    ];
    const custom = [
      ...(getStylingCapabilities({
        tag: "progress",
        progressVariant: "custom",
      })?.targets.keys() ?? []),
    ];
    expect(native).toEqual(["element", "progress.track", "progress.fill"]);
    expect(custom).toEqual([
      "element",
      "progress.track",
      "progress.fill",
      "progress.segment",
      "progress.label",
    ]);
  });

  it("offers Pagination role groups only on a marked Pagination", () => {
    expect(
      getStylingCapabilities({ tag: "nav" })?.targets.has("pagination.page"),
    ).toBe(false);
    const page = getStylingCapabilities({
      tag: "nav",
      component: "pagination",
    })?.targets.get("pagination.page");
    expect(page?.atoms).toContain("current");
    expect(page && isCuratedCompound(page, ["current", "hover"])).toBe(true);
  });

  it("offers input parts by input type", () => {
    expect(
      getStylingCapabilities({
        tag: "input",
        inputType: "search",
      })?.targets.has("search.cancel"),
    ).toBe(true);
    expect(
      getStylingCapabilities({
        tag: "input",
        inputType: "number",
      })?.targets.has("number.spin"),
    ).toBe(true);
    expect(
      getStylingCapabilities({ tag: "input", inputType: "text" })?.targets.has(
        "number.spin",
      ),
    ).toBe(false);
    expect(
      getStylingCapabilities({
        tag: "input",
        inputType: "checkbox",
      })?.targets.has("placeholder"),
    ).toBe(false);
    expect(
      getStylingCapabilities({
        tag: "input",
        inputType: "checkbox",
      })?.targets.has("toggle.box"),
    ).toBe(true);
  });

  it("curates compounds per profile (N6): canonical, made of the target's own atoms, no free builder", () => {
    for (const tag of [...KNOWN_ELEMENT_TAGS, "input"]) {
      for (const inputType of [undefined, "checkbox", "radio"] as const) {
        for (const target of getStylingCapabilities({
          tag,
          inputType,
          component: tag === "nav" ? "pagination" : undefined,
        })?.targets.values() ?? []) {
          for (const compound of target.compounds) {
            expect(compound.length).toBeGreaterThanOrEqual(2);
            expect(
              [...compound].sort((a, b) => stateAtomRank(a) - stateAtomRank(b)),
            ).toEqual(compound);
            for (const atom of compound) expect(target.atoms).toContain(atom);
          }
        }
      }
    }
    const checkbox = getStylingCapabilities({
      tag: "input",
      inputType: "checkbox",
    })?.targets.get("element");
    expect(checkbox && isCuratedCompound(checkbox, ["checked", "hover"])).toBe(
      true,
    );
    expect(
      checkbox && isCuratedCompound(checkbox, ["checked", "disabled"]),
    ).toBe(false);
  });

  it("limits pseudo-elements to their CSS allow-lists", () => {
    const placeholder = getStylingCapabilities({
      tag: "input",
      inputType: "email",
    })?.targets.get("placeholder");
    expect(placeholder?.groups.has("border")).toBe(false);
    expect(placeholder?.fields?.typography).toContain("color");
    expect(placeholder?.fields?.typography).not.toContain("textAlign");
    expect(
      getStylingCapabilities({ tag: "li" })
        ?.targets.get("marker")
        ?.groups.has("counters"),
    ).toBe(true);
  });
});

describe("authoring availability", () => {
  it("exposes nothing new in BC-17.2: every foundation feature is represented but not authorable", () => {
    for (const feature of Object.keys(
      STYLING_AUTHORING_AVAILABILITY,
    ) as (keyof typeof STYLING_AUTHORING_AVAILABILITY)[])
      expect(isStylingFeatureAuthorable(feature), feature).toBe(false);
  });
});
