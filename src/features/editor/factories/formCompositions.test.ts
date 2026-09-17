import { describe, expect, it } from "vitest";
import {
  createContactFormNode,
  createLabeledSelectFieldNode,
  createLabeledTextFieldNode,
  createLoginFormNode,
  createNewsletterSignupNode,
  createSearchBarNode,
} from "./formCompositions";

/**
 * Checkpoint 1.15.6.5 — Components -> Forms & Inputs. Every factory here
 * must produce ONLY ordinary primitives (form/label/input/textarea/
 * select/option/h2/p/button), never a proprietary component tag
 * (loginForm/contactForm/fieldGroup), and never a `formVariant`/
 * `validationState`-style state field — these tests assert that boundary
 * directly, plus the generic "fresh id everywhere" guarantee every
 * composition factory in this codebase already provides.
 */

type AnyNode = { id: string; tag: string; children?: AnyNode[] };

function collectIds(node: AnyNode): string[] {
  return [node.id, ...(node.children ?? []).flatMap(collectIds)];
}

function collectTags(node: AnyNode): string[] {
  return [node.tag, ...(node.children ?? []).flatMap(collectTags)];
}

describe("Labeled Text Field (Checkpoint 1.15.6.5, Part C)", () => {
  it("is a genuine label > p, input — the label itself has no text field, only two child elements", () => {
    const node = createLabeledTextFieldNode();
    expect(node.tag).toBe("label");
    expect(node.text).toBeUndefined();
    const tags = node.children?.map((c) => c.tag) ?? [];
    expect(tags).toEqual(["p", "input"]);
  });

  it("uses plain text inputType, matching the existing 'Text Field' toolbar taxonomy", () => {
    const [, input] = createLabeledTextFieldNode().children!;
    expect(input.inputType).toBe("text");
    expect(input.name).toBe("name");
    expect(input.placeholder).toBe("Enter your name");
  });

  it("stores no proprietary variant/state field on the node at all", () => {
    const node = createLabeledTextFieldNode() as unknown as Record<string, unknown>;
    expect(node.formVariant).toBeUndefined();
    expect(node.fieldVariant).toBeUndefined();
    expect(node.componentType).toBeUndefined();
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createLabeledTextFieldNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createLabeledTextFieldNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Search Bar (Checkpoint 1.15.6.5, Part D)", () => {
  it("is a genuine form > input(search), button — no proprietary SearchBar node", () => {
    const node = createSearchBarNode();
    expect(node.tag).toBe("form");
    const tags = node.children?.map((c) => c.tag) ?? [];
    expect(tags).toEqual(["input", "button"]);
    const [input] = node.children!;
    expect(input.inputType).toBe("search");
  });

  it("uses managed Flex Row layout, not Free", () => {
    const node = createSearchBarNode();
    expect(node.layoutMode).not.toBe("free");
    expect(node.flowLayout?.display).toBe("flex");
    expect(node.flowLayout?.flex?.direction).toBe("row");
  });

  it("the Input grows via ordinary FlexChildSettings; the Button keeps its own natural size", () => {
    const [input, button] = createSearchBarNode().children!;
    expect(input.flexChild?.grow).toBe(1);
    expect(button.flexChild).toBeUndefined();
  });

  it("the Button reuses the Primary Button preset's own authored style fields", () => {
    const [, button] = createSearchBarNode().children!;
    expect(button.text).toBe("Search");
    expect(button.background?.color).toBeDefined();
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createSearchBarNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createSearchBarNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Newsletter Signup (Checkpoint 1.15.6.5, Part E)", () => {
  it("is a genuine form > input(email), button", () => {
    const node = createNewsletterSignupNode();
    expect(node.tag).toBe("form");
    const tags = node.children?.map((c) => c.tag) ?? [];
    expect(tags).toEqual(["input", "button"]);
    const [input, button] = node.children!;
    expect(input.inputType).toBe("email");
    expect(button.text).toBe("Subscribe");
  });

  it("stores no subscription/runtime state field anywhere on the node", () => {
    const node = createNewsletterSignupNode() as unknown as Record<string, unknown>;
    expect(node.subscribed).toBeUndefined();
    expect(node.loading).toBeUndefined();
    expect(node.error).toBeUndefined();
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createNewsletterSignupNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createNewsletterSignupNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Contact Form (Checkpoint 1.15.6.5, Part F)", () => {
  it("is form > label(Name), label(Email), label(Message), button", () => {
    const node = createContactFormNode();
    expect(node.tag).toBe("form");
    const tags = node.children?.map((c) => c.tag) ?? [];
    expect(tags).toEqual(["label", "label", "label", "button"]);
    const [nameField, emailField, messageField] = node.children!;
    expect(nameField.children?.[1].inputType).toBe("text");
    expect(emailField.children?.[1].inputType).toBe("email");
    expect(messageField.children?.[1].tag).toBe("textarea");
  });

  it("stores no validation field anywhere on any node", () => {
    const node = createContactFormNode();
    function collectNodes(n: AnyNode & Record<string, unknown>): (AnyNode & Record<string, unknown>)[] {
      return [n, ...((n.children as (AnyNode & Record<string, unknown>)[] | undefined) ?? []).flatMap(collectNodes)];
    }
    for (const n of collectNodes(node as unknown as AnyNode & Record<string, unknown>)) {
      expect(n.required).toBeUndefined();
      expect(n.pattern).toBeUndefined();
      expect(n.minLength).toBeUndefined();
      expect(n.maxLength).toBeUndefined();
      expect(n.validationMessage).toBeUndefined();
      expect(n.valid).toBeUndefined();
      expect(n.invalid).toBeUndefined();
    }
  });

  it("the submit Button reuses the Primary Button preset", () => {
    const [, , , submit] = createContactFormNode().children!;
    expect(submit.text).toBe("Send Message");
    expect(submit.background?.color).toBeDefined();
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createContactFormNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createContactFormNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Login Form (Checkpoint 1.15.6.5, Part G)", () => {
  it("is form > h2, label(Email), label(Password), label(Checkbox, 'Remember me'), button", () => {
    const node = createLoginFormNode();
    const tags = node.children?.map((c) => c.tag) ?? [];
    expect(tags).toEqual(["h2", "label", "label", "label", "button"]);
    const [heading, emailField, passwordField, rememberMe, submit] = node.children!;
    expect(heading.text).toBe("Welcome Back");
    expect(emailField.children?.[1].inputType).toBe("email");
    expect(passwordField.children?.[1].inputType).toBe("password");
    expect(submit.text).toBe("Sign In");

    // "Remember me" is included, using the same labeledOption pattern as
    // labeledField — a genuine <label> wrapping the Checkbox AND its own
    // visible text as two sibling children, not deferred.
    expect(rememberMe.tag).toBe("label");
    const [checkbox, text] = rememberMe.children!;
    expect(checkbox.tag).toBe("input");
    expect(checkbox.inputType).toBe("checkbox");
    expect(text.tag).toBe("p");
    expect(text.text).toBe("Remember me");
  });

  it("the heading explicitly authors a smaller font size than HeadingElement's own unconditional default", () => {
    const [heading] = createLoginFormNode().children!;
    expect(heading.typography?.fontSize?.value).toBeLessThan(30);
  });

  it("stores no authentication/session/token state anywhere on the node", () => {
    const node = createLoginFormNode() as unknown as Record<string, unknown>;
    expect(node.authenticated).toBeUndefined();
    expect(node.session).toBeUndefined();
    expect(node.token).toBeUndefined();
    expect(node.loginState).toBeUndefined();
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createLoginFormNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createLoginFormNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Labeled Select Field (Checkpoint 1.15.6.5, Part I)", () => {
  it("is label > p, select > option x3 — mirrors the existing Select factory's own starter shape", () => {
    const node = createLabeledSelectFieldNode();
    expect(node.tag).toBe("label");
    const [, select] = node.children!;
    expect(select.tag).toBe("select");
    expect(select.children).toHaveLength(3);
    expect(select.children?.map((o) => o.text)).toEqual(["Option 1", "Option 2", "Option 3"]);
    expect(select.children?.map((o) => o.value)).toEqual(["option-1", "option-2", "option-3"]);
  });

  it("every node gets its own fresh id, and two separate compositions never share one", () => {
    const idsA = collectIds(createLabeledSelectFieldNode());
    expect(new Set(idsA).size).toBe(idsA.length);
    const idsB = collectIds(createLabeledSelectFieldNode());
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });
});

describe("Every Form composition (Checkpoint 1.15.6.5, general)", () => {
  const factories = [
    ["Labeled Text Field", createLabeledTextFieldNode],
    ["Search Bar", createSearchBarNode],
    ["Newsletter Signup", createNewsletterSignupNode],
    ["Contact Form", createContactFormNode],
    ["Login Form", createLoginFormNode],
    ["Labeled Select Field", createLabeledSelectFieldNode],
  ] as const;

  it.each(factories)("%s never uses Free/absolute positioning anywhere in the composition", (_label, factory) => {
    function collectNodes(n: AnyNode): AnyNode[] {
      return [n, ...(n.children ?? []).flatMap(collectNodes)];
    }
    for (const n of collectNodes(factory() as unknown as AnyNode)) {
      expect((n as unknown as { layoutMode?: string }).layoutMode).not.toBe("free");
      expect((n as unknown as { freeLayout?: unknown }).freeLayout).toBeUndefined();
    }
  });

  it.each(factories)("%s only ever uses genuine existing HTML primitives", (_label, factory) => {
    const tags = new Set(collectTags(factory()));
    for (const tag of tags) {
      expect(["form", "label", "input", "textarea", "select", "option", "h2", "p", "button"]).toContain(tag);
    }
  });

  it.each(factories)("%s has no hardcoded HTML id/class anywhere in the composition", (_label, factory) => {
    function collectNodes(n: AnyNode & Record<string, unknown>): AnyNode[] {
      return [n, ...((n.children as (AnyNode & Record<string, unknown>)[] | undefined) ?? []).flatMap(collectNodes)];
    }
    for (const n of collectNodes(factory() as unknown as AnyNode & Record<string, unknown>)) {
      expect((n as Record<string, unknown>).htmlId).toBeUndefined();
      expect((n as Record<string, unknown>).className).toBeUndefined();
    }
  });
});
