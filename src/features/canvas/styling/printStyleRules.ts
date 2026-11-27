import type {
  StyleIrRule,
  StyleSelector,
} from "@/features/canvas/styling/styleIr";
import type { CssDeclaration } from "@/features/canvas/types/documentDefaultStyle";

/*
 * BC-17.3 — the deterministic CSS printer for compiled rules (BC-17.1.3
 * Report 1 §6.2, §8.2). It never accepts selector text: a selector is a
 * validated class token plus fragments from the compiler's constant
 * tables, and every value was validated or built from escaped strings by
 * the compiler. Specificity is equalized with :where(): (0,1,0) for every
 * authored rule (+ (0,0,1) with a pseudo-element), (0,0,0) for defaults,
 * so the global bucket order alone decides precedence.
 */

const CLASS_TOKEN = /^ly-[A-Za-z0-9_-]+$/;
const PROPERTY_NAME = /^-?[a-z][a-z0-9-]*$/;
/** Anything that could end a rule, block or <style> element. Constant fragments never contain these. */
const SELECTOR_BREAKOUT = /[{};<>\\@]|\/\*/;

export class StylePrintError extends Error {}

function assertClass(name: string): string {
  if (!CLASS_TOKEN.test(name))
    throw new StylePrintError(`Refusing to print the class "${name}".`);
  return name;
}

function assertFragment(fragment: string): string {
  // ">" is the only combinator the compiler itself writes, between chain steps.
  if (SELECTOR_BREAKOUT.test(fragment))
    throw new StylePrintError(
      `Refusing to print the selector fragment "${fragment}".`,
    );
  return fragment;
}

const SCOPE_TOKEN = /^[a-z0-9-]+$/;

/**
 * A selector as CSS text. With a scope, the rule only matches inside the
 * element carrying data-ly-sheet="<scope>" (the surface that owns the
 * sheet), at zero specificity — so a document sheet can never reach
 * editor chrome or another mounted surface.
 */
export function printSelector(selector: StyleSelector, scope?: string): string {
  const subject = `.${assertClass(selector.subject)}`;
  let text = selector.where ? `:where(${subject})` : subject;
  if (scope !== undefined) {
    if (!SCOPE_TOKEN.test(scope))
      throw new StylePrintError(`Refusing to print the scope "${scope}".`);
    text += `:where([data-ly-sheet="${scope}"] *)`;
  }
  for (const step of selector.chain ?? [])
    text += ` > :where(${assertFragment(step)})`;
  for (const condition of selector.conditions ?? [])
    text += `:where(${assertFragment(condition)})`;
  if (selector.ancestor)
    text += `:where(.${assertClass(selector.ancestor.className)}${assertFragment(selector.ancestor.condition)} *)`;
  if (selector.pseudoElement) {
    if (!/^::-?[a-z][a-z-]*$/.test(selector.pseudoElement))
      throw new StylePrintError(
        `Refusing to print the pseudo-element "${selector.pseudoElement}".`,
      );
    text += selector.pseudoElement;
  }
  return text;
}

function printDeclarations(
  declarations: readonly CssDeclaration[],
  indent: string,
): string {
  return declarations
    .map(([property, value]) => {
      if (!PROPERTY_NAME.test(property))
        throw new StylePrintError(
          `Refusing to print the property "${property}".`,
        );
      return `${indent}  ${property}: ${value};`;
    })
    .join("\n");
}

/** One rule as CSS text (wrapped in its @media when it has one). */
export function printStyleRule(rule: StyleIrRule, scope?: string): string {
  // Media queries come from the default-presentation table only; ">=" is legitimate there.
  if (rule.media !== undefined && /[{};<\\@]|\/\*/.test(rule.media))
    throw new StylePrintError(
      `Refusing to print the media query "${rule.media}".`,
    );
  const indent = rule.media === undefined ? "" : "  ";
  const body = `${indent}${printSelector(rule.selector, scope)} {\n${printDeclarations(rule.declarations, indent)}\n${indent}}`;
  return rule.media === undefined ? body : `@media ${rule.media} {\n${body}\n}`;
}

/** The order key of a rule in the global sheet: bucket, then tier (role groups before an element's own rules). */
export function ruleOrderKey(
  rule: Pick<StyleIrRule, "bucket" | "tier">,
): number {
  return rule.bucket * 2 + rule.tier;
}

/**
 * A complete, deterministic sheet: rules sorted by (bucket, tier), then by
 * a stable owner key, then in the order each owner produced them.
 */
export function printOrderedSheet(
  owners: readonly { key: string; rules: readonly StyleIrRule[] }[],
): string {
  const entries: { order: number; key: string; index: number; text: string }[] =
    [];
  for (const owner of owners)
    owner.rules.forEach((rule, index) =>
      entries.push({
        order: ruleOrderKey(rule),
        key: owner.key,
        index,
        text: printStyleRule(rule),
      }),
    );
  entries.sort(
    (a, b) =>
      a.order - b.order ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0) ||
      a.index - b.index,
  );
  return entries.map((entry) => entry.text).join("\n");
}

/**
 * BC-17.3.1 QA-4: one @keyframes block per compiled (referenced) definition.
 * The name must be a generated k- identifier and every offset a percentage
 * in 0–100; anything else is refused, like every other printed fragment.
 */
export function printKeyframes(keyframes: {
  name: string;
  stops: readonly { offset: number; declarations: readonly CssDeclaration[] }[];
}): string {
  if (!/^k-[a-z0-9-]+$/.test(keyframes.name))
    throw new StylePrintError(
      `Refusing to print the keyframes name "${keyframes.name}".`,
    );
  const stops = keyframes.stops.map((stop) => {
    if (!Number.isFinite(stop.offset) || stop.offset < 0 || stop.offset > 100)
      throw new StylePrintError(
        `Refusing to print the keyframe offset "${stop.offset}".`,
      );
    return `  ${stop.offset}% {\n${printDeclarations(stop.declarations, "  ")}\n  }`;
  });
  return `@keyframes ${keyframes.name} {\n${stops.join("\n")}\n}`;
}
