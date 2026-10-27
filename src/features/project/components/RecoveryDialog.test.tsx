import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecoveryDialog } from "@/features/project/components/RecoveryDialog";
import type { RecoveryGroup } from "@/features/project/types/recoveryRecord";

const group: RecoveryGroup = {
  key: "s/p",
  sessionId: "s".repeat(32),
  projectId: "p",
  projectName: "Landing Page",
  source: { kind: "file", fileName: "Landing Page.layoutry" },
  original: "modified",
  versions: [
    {
      recordId: "v2",
      generation: 2,
      savedAt: "2026-10-28T09:05:00.000Z",
      damaged: true,
    },
    {
      recordId: "v1",
      generation: 1,
      savedAt: "2026-10-28T09:00:00.000Z",
      damaged: false,
    },
  ],
  restorable: true,
};

function renderDialog(
  overrides: Partial<Parameters<typeof RecoveryDialog>[0]> = {},
) {
  const props = {
    dialog: {
      kind: "recovery" as const,
      groups: [group],
      error: null,
      busy: false,
    },
    variant: "desktop" as const,
    onRestore: vi.fn(),
    onDiscard: vi.fn(),
    onKeep: vi.fn(),
    ...overrides,
  };
  render(<RecoveryDialog {...props} />);
  return props;
}

describe("RecoveryDialog", () => {
  it("describes the recovered work, where it came from, and the state of the saved copy", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog", { name: "Recover Unsaved Work" });
    const item = within(dialog).getByRole("listitem", { name: "Landing Page" });
    expect(item).toHaveTextContent("From the file Landing Page.layoutry");
    expect(item).toHaveTextContent("The saved copy has changed since then");
    expect(dialog).toHaveTextContent("Restored work opens as unsaved");
  });

  it("restores the newest version that passed validation, or the one chosen", async () => {
    const user = userEvent.setup();
    const props = renderDialog();
    const versions = screen.getByRole("combobox", { name: "Version" });
    expect(versions).toHaveValue("v1");
    expect(
      within(versions).getByRole("option", { name: /damaged/ }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(props.onRestore).toHaveBeenCalledWith("s/p", "v1");
  });

  it("asks before discarding, and Cancel discards nothing", async () => {
    const user = userEvent.setup();
    const props = renderDialog();
    await user.click(screen.getByRole("button", { name: "Discard…" }));
    expect(
      screen.getByText("Discard this recovered work permanently?"),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onDiscard).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Discard…" }));
    await user.click(
      screen.getByRole("button", { name: "Discard Permanently" }),
    );
    expect(props.onDiscard).toHaveBeenCalledWith("s/p");
  });

  it("Keep for Later keeps everything", async () => {
    const user = userEvent.setup();
    const props = renderDialog();
    await user.click(screen.getByRole("button", { name: "Keep for Later" }));
    expect(props.onKeep).toHaveBeenCalled();
    expect(props.onDiscard).not.toHaveBeenCalled();
  });

  it("damaged work can only be discarded", () => {
    renderDialog({
      dialog: {
        kind: "recovery",
        groups: [{ ...group, restorable: false }],
        error: null,
        busy: false,
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "damaged and can't be restored",
    );
    expect(screen.getByRole("button", { name: "Restore" })).toBeDisabled();
  });

  it("shows a restore error and disables actions while busy", () => {
    renderDialog({
      dialog: {
        kind: "recovery",
        groups: [group],
        error: { groupKey: "s/p", message: "This version is damaged." },
        busy: true,
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This version is damaged.",
    );
    expect(screen.getByRole("button", { name: "Restore" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Keep for Later" }),
    ).toBeDisabled();
  });

  it("says so when there is nothing to recover", () => {
    renderDialog({
      dialog: { kind: "recovery", groups: [], error: null, busy: false },
    });
    expect(
      screen.getByText("There's no unsaved work to recover."),
    ).toBeVisible();
  });
});
