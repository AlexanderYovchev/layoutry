import type { Page } from "@playwright/test";

/*
 * BC-17.3 — authored CSS is no longer inline on document elements: the
 * generated document stylesheet (<style data-ly-document-styles>) holds
 * it, and an element is inline-styled only while a live geometry gesture
 * paints its override. Specs that asserted the STORED geometry by reading
 * `el.style` now read `__lyDeclaredStyle(el)`: what Layoutry declares for
 * the element — the matching generated rules in sheet order (they are
 * specificity-equalized, so the last one wins), then the inline override.
 * UA defaults and computed values are deliberately excluded, exactly like
 * `el.style` was. @media rules are skipped (only default presentations
 * use them, never geometry).
 *
 * `{ authored: true }` leaves out the default presentations (the
 * zero-specificity `:where(.ly-n-…)` rules), which is exactly what the old
 * inline style held: only what the user authored (or the recipe derived).
 */

declare global {
  interface Window {
    __lyDeclaredStyle: (
      element: Element,
      options?: { authored?: boolean },
    ) => CSSStyleDeclaration;
  }
  var __lyDeclaredStyle: (
    element: Element,
    options?: { authored?: boolean },
  ) => CSSStyleDeclaration;
}

export async function installDeclaredStyle(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__lyDeclaredStyle = (
      element: Element,
      options?: { authored?: boolean },
    ) => {
      const declared = document.createElement("div").style;
      for (const sheetElement of Array.from(
        document.querySelectorAll<HTMLStyleElement>(
          "style[data-ly-document-styles]",
        ),
      )) {
        for (const rule of Array.from(sheetElement.sheet?.cssRules ?? [])) {
          if (
            !(rule instanceof CSSStyleRule) ||
            !element.matches(rule.selectorText)
          )
            continue;
          if (options?.authored && rule.selectorText.startsWith(":where("))
            continue;
          for (const name of Array.from(rule.style))
            declared.setProperty(
              name,
              rule.style.getPropertyValue(name),
              rule.style.getPropertyPriority(name),
            );
        }
      }
      if (element instanceof HTMLElement || element instanceof SVGElement)
        for (const name of Array.from(element.style))
          declared.setProperty(
            name,
            element.style.getPropertyValue(name),
            element.style.getPropertyPriority(name),
          );
      return declared;
    };
  });
}
