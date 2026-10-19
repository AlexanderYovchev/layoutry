// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createCloseGuard } from "./closeGuard";

function deferred() {
  let resolve!: (value: boolean) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<boolean>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function closeEvent() {
  return { preventDefault: vi.fn() };
}

function setup() {
  const answers: ReturnType<typeof deferred>[] = [];
  const confirmDiscard = vi.fn(() => {
    const answer = deferred();
    answers.push(answer);
    return answer.promise;
  });
  const closeWindow = vi.fn();
  const guard = createCloseGuard({ confirmDiscard, closeWindow });
  return { guard, confirmDiscard, closeWindow, answers };
}

describe("createCloseGuard", () => {
  it("holds the window open and asks before discarding", () => {
    const { guard, confirmDiscard, closeWindow } = setup();
    const event = closeEvent();
    guard.handleCloseRequest(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(confirmDiscard).toHaveBeenCalledTimes(1);
    expect(closeWindow).not.toHaveBeenCalled();
  });

  it("keeps the window open when the user cancels, and asks again next time", async () => {
    const { guard, confirmDiscard, closeWindow, answers } = setup();
    guard.handleCloseRequest(closeEvent());
    answers[0].resolve(false);
    await answers[0].promise;
    await Promise.resolve();
    expect(closeWindow).not.toHaveBeenCalled();

    const again = closeEvent();
    guard.handleCloseRequest(again);
    expect(again.preventDefault).toHaveBeenCalled();
    expect(confirmDiscard).toHaveBeenCalledTimes(2);
  });

  it("closes once on confirmation without asking a second time", async () => {
    const { guard, confirmDiscard, closeWindow, answers } = setup();
    guard.handleCloseRequest(closeEvent());
    answers[0].resolve(true);
    await answers[0].promise;
    await Promise.resolve();
    expect(closeWindow).toHaveBeenCalledTimes(1);

    // The re-issued close passes straight through — no loop, no second dialog.
    const reissued = closeEvent();
    guard.handleCloseRequest(reissued);
    expect(reissued.preventDefault).not.toHaveBeenCalled();
    expect(confirmDiscard).toHaveBeenCalledTimes(1);
  });

  it("shows only one dialog for repeated close requests while it is open", () => {
    const { guard, confirmDiscard } = setup();
    const first = closeEvent();
    const second = closeEvent();
    guard.handleCloseRequest(first);
    guard.handleCloseRequest(second);
    expect(second.preventDefault).toHaveBeenCalled();
    expect(confirmDiscard).toHaveBeenCalledTimes(1);
  });

  it("recovers if the dialog itself fails", async () => {
    const { guard, confirmDiscard, closeWindow, answers } = setup();
    guard.handleCloseRequest(closeEvent());
    answers[0].reject(new Error("dialog failed"));
    await answers[0].promise.catch(() => undefined);
    await Promise.resolve();
    expect(closeWindow).not.toHaveBeenCalled();
    guard.handleCloseRequest(closeEvent());
    expect(confirmDiscard).toHaveBeenCalledTimes(2);
  });

  it("lets an OS session end close without a dialog", () => {
    const { guard, confirmDiscard } = setup();
    guard.allowClose();
    const event = closeEvent();
    guard.handleCloseRequest(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(confirmDiscard).not.toHaveBeenCalled();
  });
});
