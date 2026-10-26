import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { createElementNode } from "@/features/editor/factories/elementFactories";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { ProjectWorkspace } from "@/features/project/components/ProjectWorkspace";
import { createFakeDesktopProjectFiles } from "@/features/project/desktop/fakeDesktopProjectFiles";
import { createIndexedDbProjectRepository } from "@/features/project/storage/indexedDbProjectRepository";
import { useProjectDialogStore } from "@/features/project/stores/useProjectDialogStore";
import { useProjectStore } from "@/features/project/stores/useProjectStore";

/** PROJECT-1.3: the workspace running inside the desktop app (bridge faked). */

const initialEditor = useEditorStore.getState();
const initialProject = useProjectStore.getState();
const initialDialogs = useProjectDialogStore.getState();

function renderDesktop() {
  const desktop = createFakeDesktopProjectFiles();
  const factory = new IDBFactory();
  render(
    <ProjectWorkspace
      createRepository={() =>
        createIndexedDbProjectRepository({ getFactory: () => factory })
      }
      createDesktopFiles={() => desktop.bridge}
    />,
  );
  return desktop;
}

function edit() {
  act(() =>
    useEditorStore
      .getState()
      .insertElement("page-root", createElementNode("paragraph")),
  );
}

beforeEach(() => {
  useEditorStore.setState(initialEditor, true);
  useProjectStore.setState(initialProject, true);
  useProjectDialogStore.setState(initialDialogs, true);
});

describe("ProjectWorkspace in the desktop app", { timeout: 15000 }, () => {
  it("offers file commands and the desktop library, not browser import/download", async () => {
    const user = userEvent.setup();
    renderDesktop();
    await user.click(screen.getByRole("menuitem", { name: "File" }));
    const menu = screen.getByRole("menu", { name: "File" });
    for (const label of [
      "New Project",
      "Open File…",
      "Open from Desktop Library…",
      "Save",
      "Save As…",
      "Rename Project…",
    ])
      expect(
        within(menu).getByRole("menuitem", { name: label }),
      ).toBeInTheDocument();
    expect(
      within(menu).queryByRole("menuitem", {
        name: /Import|Download|Open Recent/,
      }),
    ).not.toBeInTheDocument();
  });

  it("saves a new project through the native dialog and shows the file as its source", async () => {
    const user = userEvent.setup();
    const desktop = renderDesktop();
    desktop.script.saveAs = "Landing.layoutry";

    await user.keyboard("{Control>}s{/Control}");

    await waitFor(() =>
      expect(document.querySelector("[data-project-status]")).toHaveAttribute(
        "data-project-status",
        "saved",
      ),
    );
    expect(
      screen.queryByRole("dialog", { name: "Save Project" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Project: Landing. Rename project" }),
    ).toBeInTheDocument();
    const source = document.querySelector("[data-project-source]");
    expect(source).toHaveTextContent("Landing.layoutry");
    expect(source?.textContent).not.toMatch(/[\\/]/);
  });

  it("reports unsaved work to the main process and doesn't use beforeunload", async () => {
    const desktop = renderDesktop();
    await waitFor(() => expect(desktop.unsavedReports.at(-1)).toBe(false));
    edit();
    await waitFor(() => expect(desktop.unsavedReports.at(-1)).toBe(true));

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("answers a close request with the editor's own Save / Don't Save / Cancel dialog", async () => {
    const user = userEvent.setup();
    const desktop = renderDesktop();
    edit();

    act(() => desktop.requestClose());

    const dialog = await screen.findByRole("dialog", {
      name: "Unsaved Changes",
    });
    expect(dialog).toHaveTextContent("Save them before closing Layoutry?");
    expect(within(dialog).getByRole("button", { name: "Save" })).toHaveFocus();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(desktop.closeResponses).toEqual([false]);

    act(() => desktop.requestClose());
    await user.click(
      within(
        await screen.findByRole("dialog", { name: "Unsaved Changes" }),
      ).getByRole("button", { name: "Don't Save" }),
    );
    expect(desktop.closeResponses).toEqual([false, true]);
  });

  it("shows a conflict instead of overwriting an externally changed file, Cancel focused", async () => {
    const user = userEvent.setup();
    const desktop = renderDesktop();
    desktop.script.saveAs = "Site.layoutry";
    await user.keyboard("{Control>}s{/Control}");
    await waitFor(() => expect(desktop.disk.has("Site.layoutry")).toBe(true));
    desktop.disk.set("Site.layoutry", "changed elsewhere");
    edit();

    await user.keyboard("{Control>}s{/Control}");

    const dialog = await screen.findByRole("dialog", {
      name: "File Changed Outside Layoutry",
    });
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toHaveFocus();
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Saving now would replace those changes",
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(desktop.disk.get("Site.layoutry")).toBe("changed elsewhere");
    expect(document.querySelector("[data-project-status]")).toHaveAttribute(
      "data-project-status",
      "unsaved",
    );
  });

  it("opens a file passed on the command line when it starts", async () => {
    const desktop = createFakeDesktopProjectFiles();
    desktop.disk.set(
      "Startup.layoutry",
      JSON.stringify({
        format: "layoutry-project",
        formatVersion: 1,
        project: {
          id: "p-1",
          name: "Startup",
          createdAt: "2026-10-27T00:00:00.000Z",
          updatedAt: "2026-10-27T00:00:00.000Z",
        },
        document: { id: "page-root", tag: "page", children: [] },
      }),
    );
    desktop.script.pending.push("Startup.layoutry");
    const factory = new IDBFactory();
    render(
      <ProjectWorkspace
        createRepository={() =>
          createIndexedDbProjectRepository({ getFactory: () => factory })
        }
        createDesktopFiles={() => desktop.bridge}
      />,
    );
    expect(
      await screen.findByRole("button", {
        name: "Project: Startup. Rename project",
      }),
    ).toBeInTheDocument();
    expect(document.querySelector("[data-project-source]")).toHaveTextContent(
      "Startup.layoutry",
    );
  });
});
