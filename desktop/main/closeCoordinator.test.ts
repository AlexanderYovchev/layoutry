// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createCloseCoordinator } from "./closeCoordinator";
import { createCloseGuard } from "./closeGuard";

function setup(fallbackAnswer = false) {
  const requestPageDecision = vi.fn();
  const fallback = vi.fn(() => Promise.resolve(fallbackAnswer));
  const coordinator = createCloseCoordinator({ requestPageDecision, fallback });
  return { coordinator, requestPageDecision, fallback };
}

describe("createCloseCoordinator", () => {
  it("uses the native dialog until the page has reported in", async () => {
    const { coordinator, fallback, requestPageDecision } = setup(true);
    expect(await coordinator.decide()).toBe(true);
    expect(fallback).toHaveBeenCalledOnce();
    expect(requestPageDecision).not.toHaveBeenCalled();
  });

  it("closes a saved project at once, with no dialog at all", async () => {
    const { coordinator, fallback, requestPageDecision } = setup();
    coordinator.reportUnsaved(false);
    expect(await coordinator.decide()).toBe(true);
    expect(fallback).not.toHaveBeenCalled();
    expect(requestPageDecision).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "lets the page decide when there is unsaved work (answer %s)",
    async (answer) => {
      const { coordinator, fallback, requestPageDecision } = setup();
      coordinator.reportUnsaved(true);
      const decision = coordinator.decide();
      expect(requestPageDecision).toHaveBeenCalledOnce();
      coordinator.respond(answer);
      expect(await decision).toBe(answer);
      expect(fallback).not.toHaveBeenCalled();
    },
  );

  it("falls back to the native dialog if the page crashes or hangs while deciding", async () => {
    const { coordinator, fallback } = setup(true);
    coordinator.reportUnsaved(true);
    const decision = coordinator.decide();
    coordinator.pageLost();
    expect(await decision).toBe(true);
    expect(fallback).toHaveBeenCalledOnce();
  });

  it("ignores an answer nobody asked for", async () => {
    const { coordinator } = setup();
    coordinator.reportUnsaved(true);
    coordinator.respond(true);
    const decision = coordinator.decide();
    let settled = false;
    void decision.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
  });

  it("with the close guard: repeated close clicks ask the page once, and a cancel keeps the window", async () => {
    const { coordinator, requestPageDecision } = setup();
    const closeWindow = vi.fn();
    const guard = createCloseGuard({
      confirmDiscard: coordinator.decide,
      closeWindow,
    });
    coordinator.reportUnsaved(true);
    const event = () => ({ preventDefault: vi.fn() });

    guard.handleCloseRequest(event());
    guard.handleCloseRequest(event());
    expect(requestPageDecision).toHaveBeenCalledOnce();
    coordinator.respond(false);
    await Promise.resolve();
    await Promise.resolve();
    expect(closeWindow).not.toHaveBeenCalled();

    guard.handleCloseRequest(event());
    expect(requestPageDecision).toHaveBeenCalledTimes(2);
    coordinator.respond(true);
    await vi.waitFor(() => expect(closeWindow).toHaveBeenCalledOnce());
  });
});
