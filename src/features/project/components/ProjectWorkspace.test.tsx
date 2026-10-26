import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { ProjectWorkspace } from "@/features/project/components/ProjectWorkspace";
import { createIndexedDbProjectRepository } from "@/features/project/storage/indexedDbProjectRepository";
import { useProjectDialogStore } from "@/features/project/stores/useProjectDialogStore";
import { useProjectStore } from "@/features/project/stores/useProjectStore";

const initialEditor = useEditorStore.getState();
const initialProject = useProjectStore.getState();
const initialDialogs = useProjectDialogStore.getState();

function renderWorkspace() {
  const factory = new IDBFactory();
  render(
    <ProjectWorkspace
      createRepository={() =>
        createIndexedDbProjectRepository({ getFactory: () => factory })
      }
    />,
  );
}

function projectStatus() {
  return document
    .querySelector("[data-project-status]")
    ?.getAttribute("data-project-status");
}

async function saveAs(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.keyboard("{Control>}s{/Control}");
  const dialog = await screen.findByRole("dialog", { name: "Save Project" });
  const input = within(dialog).getByRole("textbox", { name: "Project name" });
  await user.clear(input);
  await user.type(input, name);
  await user.click(within(dialog).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(projectStatus()).toBe("saved"));
}

beforeEach(() => {
  useEditorStore.setState(initialEditor, true);
  useProjectStore.setState(initialProject, true);
  useProjectDialogStore.setState(initialDialogs, true);
});

// Renders the whole editor; like EditorApp.test.tsx, a generous timeout
// avoids flakes when the full suite runs in parallel.
describe("ProjectWorkspace", { timeout: 15000 }, () => {
  it("shows the project name and status in the header", () => {
    renderWorkspace();
    expect(
      screen.getByRole("button", {
        name: "Project: Untitled Project. Rename project",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Not saved")).toBeInTheDocument();
  });

  it("saves with Ctrl+S: asks for a name first, focuses it, then reports success", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.keyboard("{Control>}s{/Control}");
    const dialog = await screen.findByRole("dialog", { name: "Save Project" });
    expect(
      within(dialog).getByRole("textbox", { name: "Project name" }),
    ).toHaveFocus();

    await saveAs(user, "Landing page");

    expect(
      screen.getByRole("button", {
        name: "Project: Landing page. Rename project",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Project status" }),
    ).toHaveTextContent("Saved “Landing page”");
  });

  it("validates the name and keeps the dialog open", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await user.click(screen.getByRole("button", { name: /Rename project/ }));
    const dialog = await screen.findByRole("dialog", {
      name: "Rename Project",
    });
    const input = within(dialog).getByRole("textbox", { name: "Project name" });

    await user.clear(input);
    await user.click(within(dialog).getByRole("button", { name: "Rename" }));

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Enter a project name.",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveFocus();
  });

  it("renames from the header, marking the project unsaved; Escape cancels", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    const rename = screen.getByRole("button", { name: /Rename project/ });

    await user.click(rename);
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Rename Project" }),
    ).not.toBeInTheDocument();
    expect(projectStatus()).toBe("new");

    await user.click(rename);
    const input = await screen.findByRole("textbox", { name: "Project name" });
    await user.clear(input);
    await user.type(input, "  Pricing   page {Enter}");

    expect(
      screen.getByRole("button", {
        name: "Project: Pricing page. Rename project",
      }),
    ).toBeInTheDocument();
    expect(projectStatus()).toBe("unsaved");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
  });

  it("lists saved projects in Open Project and deletes one after confirmation", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await saveAs(user, "Keep me");

    await user.keyboard("{Control>}o{/Control}");
    const library = await screen.findByRole("dialog", { name: "Open Project" });
    const list = await within(library).findByRole("list", {
      name: "Saved projects",
    });
    expect(within(list).getByText("Keep me")).toBeInTheDocument();
    expect(within(list).getByText("Open now")).toBeInTheDocument();
    expect(library).toHaveTextContent(/stored in this browser on this device/);

    await user.click(
      within(list).getByRole("button", { name: "Delete Keep me" }),
    );
    const confirm = await screen.findByRole("dialog", {
      name: "Delete Project",
    });
    expect(
      within(confirm).getByRole("button", { name: "Cancel" }),
    ).toHaveFocus();
    expect(confirm).toHaveTextContent(/permanent/);
    expect(confirm).toHaveTextContent(
      /stays open in the editor as an unsaved project/,
    );

    await user.click(
      within(confirm).getByRole("button", { name: "Delete Permanently" }),
    );

    expect(
      await within(library).findByText(/No saved projects yet/),
    ).toBeInTheDocument();
    expect(projectStatus()).toBe("unsaved");
  });

  it("asks before New Project discards unsaved changes", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    act(() => useProjectStore.getState().renameProject("Draft"));

    await user.click(screen.getByRole("menuitem", { name: "File" }));
    await user.click(screen.getByRole("menuitem", { name: "New Project" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Unsaved Changes",
    });
    expect(within(dialog).getByRole("button", { name: "Save" })).toHaveFocus();
    await user.click(
      within(dialog).getByRole("button", { name: "Don't Save" }),
    );

    await waitFor(() => expect(projectStatus()).toBe("new"));
    expect(
      screen.getByRole("button", {
        name: "Project: Untitled Project. Rename project",
      }),
    ).toBeInTheDocument();
  });

  it("rejects an invalid import with an error dialog", async () => {
    renderWorkspace();
    const input = screen.getByTestId("project-import-input");
    fireEvent.change(input, {
      target: { files: [new File(["not a project"], "notes.layoutry")] },
    });

    const dialog = await screen.findByRole("dialog", {
      name: "This file can't be imported",
    });
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      /isn't valid JSON|not valid JSON|JSON/,
    );
  });
});
