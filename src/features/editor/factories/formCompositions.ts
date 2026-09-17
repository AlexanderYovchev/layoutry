/**
 * Components -> Forms & Inputs (Checkpoint 1.15.6.5) — the fourth
 * Components family, following the exact composition architecture
 * Buttons/Navigation/Cards already established. Every factory here
 * returns an ordinary tree of existing primitives (form/label/input/
 * textarea/select/option/h2/p/button) with concrete starter style FIELDS
 * authored directly — no `loginForm`/`contactForm`/`fieldGroup` tag, no
 * `formVariant`/`fieldVariant`/`validationState` field of any kind.
 *
 * THE CENTRAL AUDIT FINDING (Checkpoint 1.15.6.5's own governing
 * question — see this checkpoint's report, section B): createLabelNode's
 * own doc comment (elementFactories.ts) already anticipated this —
 * "wrapping an Input is the only supported association model for now."
 * Label is a genuine, unconstrained container (insertionRules.ts's
 * CONTAINER_TAGS, not in ALLOWED_CHILD_TAGS) that accepts ANY non-
 * constrained children — including TWO sibling children at once: a
 * visible-text Paragraph AND the actual form control (Input/Textarea/
 * Select/Checkbox). This is NOT the "mixed text + children on one node"
 * architecture Label deliberately never got (Label still has no `text`
 * field, still not text-editable) — it's two ordinary child ELEMENTS,
 * exactly the "container of children" shape Label already has. Wrapping
 * both a real `<label>` (`<label><p>Email</p><input></label>`) gets
 * genuine, working native browser label association for free: every
 * major browser treats any descendant labelable control as associated
 * with its nearest ancestor `<label>`, regardless of what else sits
 * between them (verified live — see the checkpoint's own report, section
 * J, for the click-focuses-input verification). No `for`/`id` mechanism
 * was added or is needed; none exists generically in this app (confirmed
 * absent — see InspectorFormControlSection.tsx, which has no such field).
 * `labeledField`/`labeledOption` below are the two small, shared
 * applications of this one real finding — not a new mechanism, not a
 * hack, not a Label architecture change.
 *
 * Reuses createPrimaryButtonNode (buttonCompositions.ts) for every
 * action button and applyShadowPreset (types/boxShadow.ts) for every
 * substantial Form root's starter shadow, matching Cards' own precedent.
 * Deliberately does NOT import createFormNode/createTextareaNode/
 * createSelectNode/createCheckboxNode from elementFactories.ts (which
 * would create a circular import: elementFactories.ts already imports
 * FROM this file to register these compositions) — every primitive node
 * below is built directly inline instead, the same discipline
 * buttonCompositions.ts/navigationCompositions.ts/cardCompositions.ts
 * already established for the identical structural reason.
 */

import { createPrimaryButtonNode } from "@/features/editor/factories/buttonCompositions";
import { generateNodeId } from "@/features/editor/utils/generateNodeId";
import { applyShadowPreset } from "@/features/editor/types/boxShadow";
import type { BackgroundSettings } from "@/features/editor/types/background";
import type { BorderRadiusSettings } from "@/features/editor/types/borderRadius";
import type { BorderSettings } from "@/features/editor/types/border";
import type { EditorElementNode } from "@/features/editor/types/document";
import type { FlexContainerSettings } from "@/features/editor/types/flowLayout";
import type { ElementSpacing } from "@/features/editor/types/spacing";
import { ZERO_EDGES } from "@/features/editor/types/spacing";
import type { TypographySettings } from "@/features/editor/types/typography";

const FIELD_LABEL_TYPOGRAPHY: TypographySettings = { fontSize: { value: 13, unit: "px" }, fontWeight: 600, color: "#3f3f46" };
const OPTION_TEXT_TYPOGRAPHY: TypographySettings = { color: "#3f3f46" };

function fieldLabelText(text: string): EditorElementNode {
  return { id: generateNodeId("p"), tag: "p", text, typography: FIELD_LABEL_TYPOGRAPHY };
}

function optionText(text: string): EditorElementNode {
  return { id: generateNodeId("p"), tag: "p", text, typography: OPTION_TEXT_TYPOGRAPHY };
}

const LABELED_FIELD_FLEX: FlexContainerSettings = { direction: "column", wrap: "nowrap", justifyContent: "start", alignItems: "stretch", rowGap: 6, columnGap: 6 };
const LABELED_OPTION_FLEX: FlexContainerSettings = { direction: "row", wrap: "nowrap", justifyContent: "start", alignItems: "center", rowGap: 8, columnGap: 8 };

/**
 * label > p(labelText), control (Checkpoint 1.15.6.5's own central
 * finding — see this file's own top comment) — a genuine `<label>` as
 * the actual wrapping element, Flex Column, visible text above the
 * control. Used by every text-like field across this whole family
 * (Labeled Text Field, Search Bar's own audit rejected this shape for a
 * different reason — see createSearchBarNode — Contact Form, Login
 * Form, Labeled Select Field).
 */
function labeledField(labelText: string, control: EditorElementNode): EditorElementNode {
  return {
    id: generateNodeId("label"),
    tag: "label",
    flowLayout: { display: "flex", flex: LABELED_FIELD_FLEX },
    children: [fieldLabelText(labelText), control],
  };
}

/**
 * label > control, p(text) (Checkpoint 1.15.6.5, Part H's own audit) —
 * the same genuine-`<label>`-wrapping finding as labeledField, applied to
 * a toggle control instead: Flex Row, control first then its visible
 * text beside it. Used for Login Form's "Remember me" — this checkpoint
 * deliberately does NOT defer it the way the brief's own brief
 * anticipated (section 32), because this IS the clean representation
 * that audit was looking for, not a hack around Label's own restrictions.
 * Checkbox/radio's own preventCheckedToggle guard (InputElement.tsx)
 * still fully applies even through a real `<label>`'s native click-
 * forwarding — verified live (this checkpoint's report, section J) — so
 * wrapping in Label does not reopen the "accidental Canvas toggle" risk
 * section 58 warns about.
 */
function labeledOption(control: EditorElementNode, text: string): EditorElementNode {
  return {
    id: generateNodeId("label"),
    tag: "label",
    flowLayout: { display: "flex", flex: LABELED_OPTION_FLEX },
    children: [control, optionText(text)],
  };
}

/**
 * label > p("Full Name"), input (Checkpoint 1.15.6.5, Part C) — the
 * smallest reusable Forms composition. Uses plain `inputType: "text"`
 * (not email) to match the existing Creation Toolbar placeholder's own
 * "Text Field" concept literally (section 12's own audit instruction);
 * Contact Form/Login Form below demonstrate the email/password variants
 * instead.
 */
export function createLabeledTextFieldNode(): EditorElementNode {
  return labeledField("Full Name", {
    id: generateNodeId("input"),
    tag: "input",
    inputType: "text",
    name: "name",
    placeholder: "Enter your name",
  });
}

const INLINE_FORM_ROW_FLEX: FlexContainerSettings = { direction: "row", wrap: "nowrap", justifyContent: "start", alignItems: "stretch", rowGap: 8, columnGap: 8 };

/**
 * Bare `<form>` root, no label wrapping — Search Bar and Newsletter
 * Signup are single-control-plus-action rows, not field+visible-label
 * pairs, so labeledField's own shape doesn't apply here; audited and
 * rejected in favor of this simpler shape (section 14's own "Container ->
 * Search Input, Button" candidate, upgraded to a genuine `<form>` root —
 * see createSearchBarNode's own doc comment for why).
 */
function inlineFormRoot(children: EditorElementNode[]): EditorElementNode {
  return {
    id: generateNodeId("form"),
    tag: "form",
    flowLayout: { display: "flex", flex: INLINE_FORM_ROW_FLEX },
    spacing: { margin: ZERO_EDGES, padding: ZERO_EDGES },
    children,
  };
}

/**
 * form > input(search), button (Checkpoint 1.15.6.5, Part D). Rooted in
 * a genuine `<form>` rather than a plain Container (section 17's own
 * audit): a search control is naturally a Form semantically, and Canvas
 * submission is already generically prevented (FormElement's own
 * pre-existing preventEditorFormSubmission guard, untouched here) — there
 * is no editor risk to using the real semantic element, only an
 * accessibility/semantic upside. The Input grows via ordinary
 * `flexChild: { grow: 1 }` (the same pre-existing Flex Child mechanism
 * Cards' Horizontal Card already used for its own media column — not a
 * new sizing system); the Button keeps its own natural size via the
 * container's default alignItems/child sizing.
 */
export function createSearchBarNode(): EditorElementNode {
  const input: EditorElementNode = {
    id: generateNodeId("input"),
    tag: "input",
    inputType: "search",
    name: "search",
    placeholder: "Search…",
    flexChild: { grow: 1, shrink: 1, basis: "auto", alignSelf: "stretch" },
  };
  const button = createPrimaryButtonNode();
  button.text = "Search";
  return inlineFormRoot([input, button]);
}

/**
 * form > input(email), button (Checkpoint 1.15.6.5, Part E) — a compact
 * single-row signup, the same Flex Row shape createSearchBarNode already
 * uses and already verified (section 69's own audit: reusing an already-
 * proven layout is safer than introducing a second, unverified Flex
 * Column variant for what is functionally the same "input beside action
 * button" shape). Kept deliberately focused — no heading/description
 * Paragraph (section 18's own "keep the first version focused"
 * instruction).
 */
export function createNewsletterSignupNode(): EditorElementNode {
  const input: EditorElementNode = {
    id: generateNodeId("input"),
    tag: "input",
    inputType: "email",
    name: "email",
    placeholder: "Enter your email",
    flexChild: { grow: 1, shrink: 1, basis: "auto", alignSelf: "stretch" },
  };
  const button = createPrimaryButtonNode();
  button.text = "Subscribe";
  return inlineFormRoot([input, button]);
}

const FORM_CARD_BACKGROUND: BackgroundSettings = { color: "#ffffff" };
const FORM_CARD_BORDER: BorderSettings = {
  top: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
  right: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
  bottom: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
  left: { width: { value: 1, unit: "px" }, style: "solid", color: "#e4e4e7" },
};
const FORM_CARD_RADIUS: BorderRadiusSettings = {
  topLeft: { value: 8, unit: "px" },
  topRight: { value: 8, unit: "px" },
  bottomRight: { value: 8, unit: "px" },
  bottomLeft: { value: 8, unit: "px" },
};
const FORM_CARD_PADDING: ElementSpacing = { margin: ZERO_EDGES, padding: { top: 24, right: 24, bottom: 24, left: 24 } };
const FORM_COLUMN_FLEX: FlexContainerSettings = { direction: "column", wrap: "nowrap", justifyContent: "start", alignItems: "stretch", rowGap: 16, columnGap: 16 };

/** A fresh shadow layer list per Form instance (never a shared module constant) — same "every node's own nested ids stay fresh" reasoning cardCompositions.ts's own cardShadow already documented. */
function formCardShadow() {
  return applyShadowPreset("small");
}

/** Shared root shape for Contact Form and Login Form — a real, visible-but-neutral card-like surface (Checkpoint 1.15.6.5's own "immediately usable but remain neutral" instruction, section 42), matching Cards' own established chrome exactly (independently re-declared here rather than cross-imported from cardCompositions.ts, the same "each composition family owns its own small starter-style constants" discipline every family in this codebase already follows). */
function formCardRoot(children: EditorElementNode[]): EditorElementNode {
  return {
    id: generateNodeId("form"),
    tag: "form",
    flowLayout: { display: "flex", flex: FORM_COLUMN_FLEX },
    background: FORM_CARD_BACKGROUND,
    border: FORM_CARD_BORDER,
    borderRadius: FORM_CARD_RADIUS,
    boxShadow: formCardShadow(),
    spacing: FORM_CARD_PADDING,
    children,
  };
}

/**
 * form > label(Name), label(Email), label(Message), button (Checkpoint
 * 1.15.6.5, Part F) — the first substantial Form composition. Every
 * field reuses labeledField; no validation fields (required/pattern/
 * minLength/etc. — section 28's own explicit prohibition) are stamped
 * anywhere.
 */
export function createContactFormNode(): EditorElementNode {
  const nameField = labeledField("Name", {
    id: generateNodeId("input"),
    tag: "input",
    inputType: "text",
    name: "name",
    placeholder: "Enter your name",
  });
  const emailField = labeledField("Email", {
    id: generateNodeId("input"),
    tag: "input",
    inputType: "email",
    name: "email",
    placeholder: "Enter your email",
  });
  const messageField = labeledField("Message", {
    id: generateNodeId("textarea"),
    tag: "textarea",
    name: "message",
    placeholder: "Enter your message",
  });
  const submit = createPrimaryButtonNode();
  submit.text = "Send Message";
  return formCardRoot([nameField, emailField, messageField, submit]);
}

const FORM_HEADING_TYPOGRAPHY: TypographySettings = { fontSize: { value: 22, unit: "px" }, fontWeight: 600, color: "#18181b" };

/**
 * form > h2("Welcome Back"), label(Email), label(Password),
 * label(Checkbox, "Remember me"), button (Checkpoint 1.15.6.5, Part G).
 * The heading explicitly authors a smaller font size than
 * HeadingElement's own unconditional "text-3xl" default (the same
 * finding Cards' own report already documented for its own Card titles —
 * see cardCompositions.ts's top comment). "Remember me" is INCLUDED, not
 * deferred (see labeledOption's own doc comment for why the audit this
 * checkpoint's own brief called for actually found a clean
 * representation). No authentication/session/token/routing anywhere —
 * this is a visual composition only, exactly like every other Form
 * primitive in this app already is.
 */
export function createLoginFormNode(): EditorElementNode {
  const heading: EditorElementNode = { id: generateNodeId("h2"), tag: "h2", text: "Welcome Back", typography: FORM_HEADING_TYPOGRAPHY };
  const emailField = labeledField("Email", {
    id: generateNodeId("input"),
    tag: "input",
    inputType: "email",
    name: "email",
    placeholder: "Enter your email",
  });
  const passwordField = labeledField("Password", {
    id: generateNodeId("input"),
    tag: "input",
    inputType: "password",
    name: "password",
    placeholder: "Enter your password",
  });
  const rememberMe = labeledOption({ id: generateNodeId("input"), tag: "input", inputType: "checkbox", name: "rememberMe" }, "Remember me");
  const submit = createPrimaryButtonNode();
  submit.text = "Sign In";
  return formCardRoot([heading, emailField, passwordField, rememberMe, submit]);
}

/**
 * Mirrors createSelectNode's own starter-option shape exactly (3 Options,
 * "Option 1"/"Option 2"/"Option 3" with values "option-1"/"option-2"/
 * "option-3" — see elementFactories.ts's own createStarterOptions) rather
 * than importing that factory, which would create the circular import
 * this file's own top comment explains. Not a divergent reinvention —
 * the exact same starter content, built inline for the same structural
 * reason every other primitive in this file is.
 */
function starterSelectOptions(): EditorElementNode[] {
  return [
    { id: generateNodeId("option"), tag: "option", text: "Option 1", value: "option-1" },
    { id: generateNodeId("option"), tag: "option", text: "Option 2", value: "option-2" },
    { id: generateNodeId("option"), tag: "option", text: "Option 3", value: "option-3" },
  ];
}

/**
 * label > p("Choose an option"), select > option x3 (Checkpoint
 * 1.15.6.5, Part I) — chosen as this family's sixth component over
 * Checkbox/Radio Group (section 39's own audit): the existing Creation
 * Toolbar placeholder already named "Select" specifically, a stronger
 * taxonomy match than introducing a brand-new grouped-options concept
 * this checkpoint's brief itself warns against inflating the family to
 * reach. Checkbox/Radio Group remain fully architecturally viable
 * (proven directly by Login Form's own "Remember me" using the identical
 * labeledOption pattern) — a natural candidate for a future checkpoint,
 * not implemented as a separate catalog entry here to avoid adding a
 * seventh component with no differentiated toolbar placeholder backing
 * it.
 */
export function createLabeledSelectFieldNode(): EditorElementNode {
  return labeledField("Choose an option", { id: generateNodeId("select"), tag: "select", children: starterSelectOptions() });
}
