import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// jsdom does not implement the native <dialog> modal methods yet.
// This minimal polyfill lets components using showModal()/close() be tested.
if (
  typeof HTMLDialogElement !== "undefined" &&
  !HTMLDialogElement.prototype.showModal
) {
  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.setAttribute("open", "");
    this.focus();
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    const wasOpen = this.hasAttribute("open");
    this.removeAttribute("open");
    if (wasOpen) {
      this.dispatchEvent(new Event("close"));
    }
  };
}
