import { describe, expect, it } from "vitest";
import {
  createArticleNode,
  createAsideNode,
  createButtonNode,
  createContainerNode,
  createElementNode,
  createEmailInputNode,
  createFooterNode,
  createFormNode,
  createHeaderNode,
  createHeadingNode,
  createImageNode,
  createInputNode,
  createLabelNode,
  createLinkNode,
  createListItemNode,
  createMainNode,
  createNavNode,
  createNumberInputNode,
  createOrderedListNode,
  createParagraphNode,
  createPasswordInputNode,
  createSearchInputNode,
  createSectionNode,
  createTelInputNode,
  createUnorderedListNode,
  createUrlInputNode,
  isInsertableElementType,
} from "./elementFactories";

describe("element factories", () => {
  it("createContainerNode produces an empty, childable div", () => {
    const node = createContainerNode();
    expect(node.tag).toBe("div");
    expect(node.children).toEqual([]);
    expect(node.id).toMatch(/^div-/);
  });

  it("createContainerNode defaults to Block display with 16px padding and zero margin (Checkpoint 3.5)", () => {
    const node = createContainerNode();
    expect(node.flowLayout).toEqual({ display: "block" });
    expect(node.spacing).toEqual({
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      padding: { top: 16, right: 16, bottom: 16, left: 16 },
    });
  });

  it("createSectionNode produces an empty, childable section (Checkpoint 1.2)", () => {
    const node = createSectionNode();
    expect(node.tag).toBe("section");
    expect(node.children).toEqual([]);
    expect(node.id).toMatch(/^section-/);
  });

  it("createSectionNode shares Container's exact structural defaults", () => {
    const section = createSectionNode();
    const container = createContainerNode();
    expect(section.flowLayout).toEqual(container.flowLayout);
    expect(section.spacing).toEqual(container.spacing);
  });

  it("leaf factories leave flowLayout/spacing unset (defaults come from the resolver, not stamped data)", () => {
    expect(createHeadingNode().flowLayout).toBeUndefined();
    expect(createHeadingNode().spacing).toBeUndefined();
  });

  it("createHeadingNode produces default heading text", () => {
    const node = createHeadingNode();
    expect(node.tag).toBe("h1");
    expect(node.text).toBe("New Heading");
  });

  it("createParagraphNode produces default paragraph text", () => {
    const node = createParagraphNode();
    expect(node.tag).toBe("p");
    expect(node.text).toBe("New paragraph text.");
  });

  it("createButtonNode produces default button text", () => {
    const node = createButtonNode();
    expect(node.tag).toBe("button");
    expect(node.text).toBe("Button");
  });

  it("createImageNode produces a plain image node", () => {
    const node = createImageNode();
    expect(node.tag).toBe("img");
  });

  it("createImageNode defaults to a placeholder src with a real 4:3 intrinsic aspect ratio (Checkpoint 3.5.1)", () => {
    const node = createImageNode();
    expect(node.src).toMatch(/^data:image\/svg\+xml/);
    expect(node.src).toContain("width%3D%22400%22");
    expect(node.src).toContain("height%3D%22300%22");
    expect(node.mediaFit).toBeUndefined();
  });

  it("createLinkNode produces a real anchor with default text and a safe destination (Checkpoint 1.4)", () => {
    const node = createLinkNode();
    expect(node.tag).toBe("a");
    expect(node.text).toBe("Link text");
    expect(node.href).toBe("#");
    expect(node.id).toMatch(/^a-/);
  });

  it("createLinkNode leaves flowLayout/spacing unset, matching every other leaf primitive", () => {
    expect(createLinkNode().flowLayout).toBeUndefined();
    expect(createLinkNode().spacing).toBeUndefined();
  });

  it("every factory produces a unique id per call", () => {
    const first = createButtonNode();
    const second = createButtonNode();
    expect(first.id).not.toBe(second.id);
  });

  it("createListItemNode produces a real, text-bearing leaf <li> (Checkpoint 1.6)", () => {
    const node = createListItemNode();
    expect(node.tag).toBe("li");
    expect(node.text).toBe("List item");
    expect(node.id).toMatch(/^li-/);
    expect(node.children).toBeUndefined();
  });

  it("createUnorderedListNode produces a <ul> with three starter <li> children as one logical node (Checkpoint 1.6)", () => {
    const node = createUnorderedListNode();
    expect(node.tag).toBe("ul");
    expect(node.children).toHaveLength(3);
    expect(node.children?.every((child) => child.tag === "li")).toBe(true);
  });

  it("createOrderedListNode produces an <ol> with three starter <li> children (Checkpoint 1.6)", () => {
    const node = createOrderedListNode();
    expect(node.tag).toBe("ol");
    expect(node.children).toHaveLength(3);
    expect(node.children?.every((child) => child.tag === "li")).toBe(true);
  });

  it("createUnorderedListNode/createOrderedListNode share Container's exact structural defaults", () => {
    const ul = createUnorderedListNode();
    const container = createContainerNode();
    expect(ul.flowLayout).toEqual(container.flowLayout);
    expect(ul.spacing).toEqual(container.spacing);
  });

  it("every starter list item gets its own fresh, unique id", () => {
    const node = createUnorderedListNode();
    const ids = node.children?.map((child) => child.id) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("two separately created lists never share starter item ids", () => {
    const first = createUnorderedListNode();
    const second = createUnorderedListNode();
    const firstIds = first.children?.map((child) => child.id) ?? [];
    const secondIds = second.children?.map((child) => child.id) ?? [];
    expect(firstIds.some((id) => secondIds.includes(id))).toBe(false);
  });

  describe("the semantic sectioning family (Checkpoint 1.8)", () => {
    const factories = {
      header: createHeaderNode,
      nav: createNavNode,
      main: createMainNode,
      article: createArticleNode,
      aside: createAsideNode,
      footer: createFooterNode,
    } as const;

    for (const [tag, factory] of Object.entries(factories)) {
      it(`create${tag[0].toUpperCase()}${tag.slice(1)}Node produces an empty, childable <${tag}> sharing Container's exact structural defaults`, () => {
        const node = factory();
        const container = createContainerNode();

        expect(node.tag).toBe(tag);
        expect(node.children).toEqual([]);
        expect(node.id).toMatch(new RegExp(`^${tag}-`));
        expect(node.flowLayout).toEqual(container.flowLayout);
        expect(node.spacing).toEqual(container.spacing);
      });
    }

    it("every factory produces a unique id per call", () => {
      expect(createHeaderNode().id).not.toBe(createHeaderNode().id);
      expect(createFooterNode().id).not.toBe(createFooterNode().id);
    });
  });

  describe("Form + Text Input foundation (Checkpoint 1.10)", () => {
    it("createFormNode produces an empty, childable <form> sharing Container's exact structural defaults", () => {
      const node = createFormNode();
      const container = createContainerNode();

      expect(node.tag).toBe("form");
      expect(node.children).toEqual([]);
      expect(node.id).toMatch(/^form-/);
      expect(node.flowLayout).toEqual(container.flowLayout);
      expect(node.spacing).toEqual(container.spacing);
    });

    it("createFormNode produces a unique id per call", () => {
      expect(createFormNode().id).not.toBe(createFormNode().id);
    });

    it("createInputNode produces a real, leaf <input> with a text type and a placeholder, but no children and no authored value", () => {
      const node = createInputNode();

      expect(node.tag).toBe("input");
      expect(node.inputType).toBe("text");
      expect(node.placeholder).toBe("Enter text");
      expect(node.value).toBeUndefined();
      expect(node.children).toBeUndefined();
      expect(node.id).toMatch(/^input-/);
    });

    it("createInputNode leaves flowLayout/spacing unset, matching every other leaf primitive", () => {
      expect(createInputNode().flowLayout).toBeUndefined();
      expect(createInputNode().spacing).toBeUndefined();
    });

    it("createInputNode produces a unique id per call", () => {
      expect(createInputNode().id).not.toBe(createInputNode().id);
    });
  });

  describe("Label + expanded text-like Input types (Checkpoint 1.11)", () => {
    const textLikeFactories = {
      email: createEmailInputNode,
      password: createPasswordInputNode,
      number: createNumberInputNode,
      search: createSearchInputNode,
      url: createUrlInputNode,
      tel: createTelInputNode,
    } as const;

    for (const [inputType, factory] of Object.entries(textLikeFactories)) {
      it(`create${inputType[0].toUpperCase()}${inputType.slice(1)}InputNode produces a real, leaf <input> with inputType "${inputType}", a sensible placeholder, but no children and no authored value`, () => {
        const node = factory();

        expect(node.tag).toBe("input");
        expect(node.inputType, inputType).toBe(inputType);
        expect(typeof node.placeholder, inputType).toBe("string");
        expect((node.placeholder ?? "").length, inputType).toBeGreaterThan(0);
        expect(node.value, inputType).toBeUndefined();
        expect(node.children, inputType).toBeUndefined();
        expect(node.id, inputType).toMatch(/^input-/);
      });
    }

    it("every text-like Input factory produces a unique id per call", () => {
      expect(createEmailInputNode().id).not.toBe(createEmailInputNode().id);
    });

    it("all seven Input variants share the exact same tag and node shape — differing only in inputType/placeholder", () => {
      const variants = [createInputNode(), ...Object.values(textLikeFactories).map((f) => f())];
      for (const node of variants) {
        expect(node.tag).toBe("input");
        expect(node.children).toBeUndefined();
        expect(node.flowLayout).toBeUndefined();
        expect(node.spacing).toBeUndefined();
      }
    });

    it("createLabelNode produces an empty, childable <label> sharing Container's exact structural defaults", () => {
      const node = createLabelNode();
      const container = createContainerNode();

      expect(node.tag).toBe("label");
      expect(node.children).toEqual([]);
      expect(node.id).toMatch(/^label-/);
      expect(node.flowLayout).toEqual(container.flowLayout);
      expect(node.spacing).toEqual(container.spacing);
    });

    it("createLabelNode produces a unique id per call", () => {
      expect(createLabelNode().id).not.toBe(createLabelNode().id);
    });
  });

  describe("createElementNode", () => {
    it("dispatches to the matching factory for every insertable type", () => {
      expect(createElementNode("container").tag).toBe("div");
      expect(createElementNode("section").tag).toBe("section");
      expect(createElementNode("heading").tag).toBe("h1");
      expect(createElementNode("paragraph").tag).toBe("p");
      expect(createElementNode("button").tag).toBe("button");
      expect(createElementNode("image").tag).toBe("img");
      expect(createElementNode("link").tag).toBe("a");
      expect(createElementNode("unorderedList").tag).toBe("ul");
      expect(createElementNode("orderedList").tag).toBe("ol");
      expect(createElementNode("listItem").tag).toBe("li");
      expect(createElementNode("header").tag).toBe("header");
      expect(createElementNode("nav").tag).toBe("nav");
      expect(createElementNode("main").tag).toBe("main");
      expect(createElementNode("article").tag).toBe("article");
      expect(createElementNode("aside").tag).toBe("aside");
      expect(createElementNode("footer").tag).toBe("footer");
      expect(createElementNode("form").tag).toBe("form");
      expect(createElementNode("input").tag).toBe("input");
      expect(createElementNode("emailInput").inputType).toBe("email");
      expect(createElementNode("passwordInput").inputType).toBe("password");
      expect(createElementNode("numberInput").inputType).toBe("number");
      expect(createElementNode("searchInput").inputType).toBe("search");
      expect(createElementNode("urlInput").inputType).toBe("url");
      expect(createElementNode("telInput").inputType).toBe("tel");
      expect(createElementNode("label").tag).toBe("label");
    });
  });

  describe("isInsertableElementType", () => {
    it("recognizes every real insertable type", () => {
      for (const type of [
        "container",
        "section",
        "heading",
        "paragraph",
        "button",
        "image",
        "link",
        "unorderedList",
        "orderedList",
        "listItem",
        "header",
        "nav",
        "main",
        "article",
        "aside",
        "footer",
        "form",
        "input",
        "emailInput",
        "passwordInput",
        "numberInput",
        "searchInput",
        "urlInput",
        "telInput",
        "label",
      ]) {
        expect(isInsertableElementType(type)).toBe(true);
      }
    });

    it("rejects unknown strings", () => {
      expect(isInsertableElementType("video")).toBe(false);
      expect(isInsertableElementType("")).toBe(false);
    });
  });
});
