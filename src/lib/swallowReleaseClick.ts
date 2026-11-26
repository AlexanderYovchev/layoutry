/**
 * Consumes the one click that the next pointer release produces (capture
 * phase, so no other click handler sees it), then stops listening right
 * after that release. For gestures cancelled while the button is still
 * held (Escape during a drag): the release that follows would otherwise
 * click whatever happens to be under the pointer.
 */
export function swallowReleaseClick(): void {
  const swallow = (event: MouseEvent) => event.stopPropagation();
  window.addEventListener("click", swallow, { capture: true, once: true });
  window.addEventListener(
    "pointerup",
    () => window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0),
    { capture: true, once: true },
  );
}
