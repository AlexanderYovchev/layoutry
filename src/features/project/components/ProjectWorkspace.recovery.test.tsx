import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { createElementNode } from "@/features/editor/factories/elementFactories";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { ProjectWorkspace } from "@/features/project/components/ProjectWorkspace";
import { createIndexedDbProjectRepository } from "@/features/project/storage/indexedDbProjectRepository";
import { createIndexedDbRecoveryStorage } from "@/features/project/storage/indexedDbRecoveryStorage";
import {
  createMemoryRecoveryLocks,
  SESSION_LOCK_PREFIX,
} from "@/features/project/storage/recoveryLocks";
import { useProjectDialogStore } from "@/features/project/stores/useProjectDialogStore";
import { useProjectStore } from "@/features/project/stores/useProjectStore";
import { useRecoveryStore } from "@/features/project/stores/useRecoveryStore";
import { pageWith } from "@/features/project/utils/projectTestDocuments";
import {
  createProjectMetadata,
  serializeProject,
} from "@/features/project/utils/serializeProject";
import { sha256Hex } from "@/features/project/utils/sha256Hex";

/** PROJECT-1.4 in the real workspace: header status and the startup offer. */

const initialEditor = useEditorStore.getState();
const initialProject = useProjectStore.getState();
const initialDialogs = useProjectDialogStore.getState();
const initialRecovery = useRecoveryStore.getState();

function environment() {
  const factory = new IDBFactory();
  const locks = createMemoryRecoveryLocks();
  let sessions = 0;
  const storage = () =>
    createIndexedDbRecoveryStorage({
      getFactory: () => factory,
      locks: locks.locks,
      createSessionId: () => {
        sessions += 1;
        return sessions.toString(16).padStart(32, "0");
      },
    });
  return {
    factory,
    locks,
    storage,
    renderWorkspace() {
      return render(
        <ProjectWorkspace
          createRepository={() =>
            createIndexedDbProjectRepository({ getFactory: () => factory })
          }
          createDesktopFiles={() => null}
          createRecoveryStorage={() => storage()}
          recoveryTiming={{ debounceMs: 20, maxWaitMs: 100 }}
        />,
      );
    },
  };
}

beforeEach(() => {
  useEditorStore.setState(initialEditor, true);
  useProjectStore.setState(initialProject, true);
  useProjectDialogStore.setState(initialDialogs, true);
  useRecoveryStore.setState(initialRecovery, true);
});

describe("ProjectWorkspace recovery", { timeout: 15000 }, () => {
  it("shows 'Recovery protected' next to 'Unsaved changes' once a copy exists, never 'Saved'", async () => {
    const { renderWorkspace } = environment();
    const view = renderWorkspace();
    await waitFor(
      () => expect(useRecoveryStore.getState().status).toBe("idle"),
      { timeout: 10_000 },
    );
    act(() => {
      useEditorStore
        .getState()
        .insertElement("page-root", createElementNode("paragraph"));
    });
    await waitFor(
      () =>
        expect(
          document
            .querySelector("[data-recovery-status]")
            ?.getAttribute("data-recovery-status"),
        ).toBe("protected"),
      { timeout: 10_000 },
    );
    expect(screen.getByText("Recovery protected")).toBeVisible();
    expect(
      document
        .querySelector("[data-project-status]")
        ?.getAttribute("data-project-status"),
    ).toBe("unsaved");
    view.unmount();
  });

  it("says when recovery isn't available, without blocking editing", async () => {
    render(
      <ProjectWorkspace
        createRepository={() =>
          createIndexedDbProjectRepository({
            getFactory: () => new IDBFactory(),
          })
        }
        createDesktopFiles={() => null}
        createRecoveryStorage={() => null}
      />,
    );
    act(() => {
      useEditorStore
        .getState()
        .insertElement("page-root", createElementNode("paragraph"));
    });
    await waitFor(() =>
      expect(screen.getByText("Recovery unavailable")).toBeVisible(),
    );
  });

  it("offers a crashed session's work at startup and restores it as unsaved", async () => {
    const user = userEvent.setup();
    const { storage, locks, renderWorkspace } = environment();
    const crashed = storage();
    const crashedId = await crashed.beginSession();
    const project = {
      metadata: createProjectMetadata({
        id: "crashed-1",
        name: "Crashed Site",
      }),
      document: pageWith({
        id: "heading-c",
        tag: "h1",
        text: "Recovered headline",
      }),
    };
    const text = serializeProject(project);
    await crashed.write({
      generation: 1,
      metadata: project.metadata,
      source: { kind: "unsaved" },
      savedAt: "2026-10-28T09:00:00.000Z",
      sha256: await sha256Hex(text),
      text,
    });
    locks.drop(`${SESSION_LOCK_PREFIX}${crashedId}`);

    renderWorkspace();
    // The startup scan opens IndexedDB, then reads, hashes and validates
    // the snapshot: allow for a loaded machine running the full suite.
    const dialog = await screen.findByRole(
      "dialog",
      { name: "Recover Unsaved Work" },
      { timeout: 10_000 },
    );
    expect(within(dialog).getByText("Crashed Site")).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Restore" }));

    await waitFor(
      () =>
        expect(
          screen.getByRole("button", {
            name: "Project: Crashed Site. Rename project",
          }),
        ).toBeVisible(),
      { timeout: 10_000 },
    );
    expect(
      screen.getByRole("heading", { name: "Recovered headline" }),
    ).toBeVisible();
    expect(
      document
        .querySelector("[data-project-status]")
        ?.getAttribute("data-project-status"),
    ).toBe("unsaved");
  });
});
