import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import type { EditMenuCommands } from "./applicationMenus";

const noopEditMenuCommands: EditMenuCommands = {
  canUndo: false,
  canRedo: false,
  canCut: false,
  canCopy: false,
  canPaste: false,
  canDuplicate: false,
  canDelete: false,
  onUndo: () => {},
  onRedo: () => {},
  onCut: () => {},
  onCopy: () => {},
  onPaste: () => {},
  onDuplicate: () => {},
  onDelete: () => {},
};

const originalInnerWidth = window.innerWidth;

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
}

function renderShell() {
  return render(
    <AppShell
      workspaceContent={<div>workspace content</div>}
      inspectorContent={<div>inspector content</div>}
      editMenuCommands={noopEditMenuCommands}
    />,
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setViewportWidth(originalInnerWidth);
    window.localStorage.removeItem("layoutry:resource-panel-width");
    window.localStorage.removeItem("layoutry:inspector-panel-width");
  });

  it("renders all shell regions with feature content in their slots", () => {
    setViewportWidth(1440);
    renderShell();

    expect(
      screen.getByRole("complementary", { name: "Resource panel" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Workspace" })).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Inspector panel" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("contentinfo", { name: "Status bar" }),
    ).toBeInTheDocument();
    expect(screen.getByText("workspace content")).toBeInTheDocument();
    expect(screen.getByText("inspector content")).toBeInTheDocument();
  });

  it("hides the Resource Panel via the View menu and gives the workspace its space back", async () => {
    setViewportWidth(1440);
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("menuitem", { name: "View" }));
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: "Resource Panel" }),
    );

    expect(
      screen.queryByRole("complementary", { name: "Resource panel" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Workspace" })).toBeInTheDocument();
  });

  it("restores a hidden panel by toggling it again from the View menu", async () => {
    setViewportWidth(1440);
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("menuitem", { name: "View" }));
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: "Status Bar" }),
    );
    expect(
      screen.queryByRole("contentinfo", { name: "Status bar" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "View" }));
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: "Status Bar" }),
    );

    expect(
      screen.getByRole("contentinfo", { name: "Status bar" }),
    ).toBeInTheDocument();
  });

  it("shows the unsupported-viewport notice below the minimum supported width", () => {
    setViewportWidth(800);
    renderShell();

    expect(
      screen.getByText("Layoutry currently works best on a larger screen."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("complementary", { name: "Resource panel" }),
    ).not.toBeInTheDocument();
  });

  it("renders the full shell at the minimum supported width", () => {
    setViewportWidth(900);
    renderShell();

    expect(
      screen.queryByText("Layoutry currently works best on a larger screen."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Resource panel" }),
    ).toBeInTheDocument();
  });

  it("clamps a saved panel width that no longer fits the viewport, without rewriting the stored preference", () => {
    window.localStorage.setItem("layoutry:inspector-panel-width", "500");
    setViewportWidth(1024);
    renderShell();

    const resourcePanel = screen.getByRole("complementary", {
      name: "Resource panel",
    });
    const inspectorPanel = screen.getByRole("complementary", {
      name: "Inspector panel",
    });
    // available = 1024 - 420 (workspace) = 604. Resource Panel (lower
    // responsive priority) shrinks first, down to its 220px minimum;
    // the Inspector absorbs the remaining overflow: 500 - 116 = 384.
    expect(resourcePanel.style.width).toBe("220px");
    expect(inspectorPanel.style.width).toBe("384px");
    expect(window.localStorage.getItem("layoutry:inspector-panel-width")).toBe(
      "500",
    );
  });

  it("recovers the full preferred width once the viewport is large enough again", () => {
    window.localStorage.setItem("layoutry:inspector-panel-width", "500");
    setViewportWidth(1024);
    renderShell();

    const inspectorPanel = screen.getByRole("complementary", {
      name: "Inspector panel",
    });
    expect(inspectorPanel.style.width).toBe("384px");

    setViewportWidth(1920);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(inspectorPanel.style.width).toBe("500px");
  });
});
