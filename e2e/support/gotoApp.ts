import type { Page } from "@playwright/test";

/**
 * Waits until React has hydrated the page. Interacting earlier hits the
 * inert server-rendered HTML — seen as a one-off failure on a cold dev
 * server compile (UI-1.5/1.6). React attaches an internal __reactProps$…
 * key to every hydrated host element; the <main> landmark exists in both
 * the editor (Workspace) and the unsupported-viewport notice.
 */
export function waitForHydration(page: Page) {
  return page.waitForFunction(() => {
    const main = document.querySelector("main");
    return (
      !!main && Object.keys(main).some((key) => key.startsWith("__reactProps"))
    );
  });
}

/** Opens the app at "/" and waits for hydration before returning. */
export async function gotoApp(page: Page) {
  await page.goto("/");
  await waitForHydration(page);
}
