import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import type { EditMenuCommands } from "./applicationMenus";
import type { PreviewControl } from "./GlobalActions";

const noopPreviewControl: PreviewControl = { mode: "design", onToggle: () => {} };

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
      previewControl={noopPreviewControl}
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

// UI-1.6 — collapsed is a third panel state, distinct from hidden.
describe("AppShell panel collapse", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    setViewportWidth(1440);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setViewportWidth(originalInnerWidth);
    window.localStorage.removeItem("layoutry:resource-panel-width");
    window.localStorage.removeItem("layoutry:inspector-panel-width");
  });

  const resourcePanel = () =>
    screen.getByRole("complementary", { name: "Resource panel" });
  const inspectorPanel = () =>
    screen.getByRole("complementary", { name: "Inspector panel" });

  it("collapses the Resource panel to its rail and restores its expanded width", async () => {
    const user = userEvent.setup();
    renderShell();
    expect(resourcePanel().style.width).toBe("280px");

    const collapse = screen.getByRole("button", {
      name: "Collapse Resource panel",
    });
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    await user.click(collapse);

    expect(resourcePanel().style.width).toBe("66px");
    // The rail stays: navigation remains discoverable while collapsed.
    expect(
      screen.getByRole("tablist", { name: "Resource categories" }),
    ).toBeInTheDocument();
    const expand = screen.getByRole("button", {
      name: "Expand Resource panel",
    });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    // Content is kept mounted but hidden.
    expect(
      document.getElementById(expand.getAttribute("aria-controls") ?? ""),
    ).toHaveClass("hidden");

    await user.click(expand);
    expect(resourcePanel().style.width).toBe("280px");
  });

  it("collapses the Inspector to a labeled rail while keeping its content mounted", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(
      screen.getByRole("button", { name: "Collapse Inspector panel" }),
    );

    expect(inspectorPanel().style.width).toBe("56px");
    expect(screen.getByText("inspector content")).toBeInTheDocument();
    const expand = screen.getByRole("button", {
      name: "Expand Inspector panel",
    });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    // Focus follows the user to the replacement toggle.
    expect(expand).toHaveFocus();

    await user.click(expand);
    expect(inspectorPanel().style.width).toBe("300px");
    expect(
      screen.getByRole("button", { name: "Collapse Inspector panel" }),
    ).toHaveFocus();
  });

  it("collapses both panels at once and gives the reclaimed width to the workspace", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(
      screen.getByRole("button", { name: "Collapse Resource panel" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Collapse Inspector panel" }),
    );

    expect(resourcePanel().style.width).toBe("66px");
    expect(inspectorPanel().style.width).toBe("56px");
  });

  it("removes resize handles while collapsed and brings them back on expand", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(
      screen.getByRole("button", { name: "Collapse Resource panel" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Collapse Inspector panel" }),
    );
    expect(
      screen.queryByRole("separator", { name: "Resize Resource Panel" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("separator", { name: "Resize Inspector Panel" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Expand Resource panel" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Expand Inspector panel" }),
    );
    expect(
      screen.getByRole("separator", { name: "Resize Resource Panel" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("separator", { name: "Resize Inspector Panel" }),
    ).toBeInTheDocument();
  });

  it("never rewrites the stored width preference when collapsing", async () => {
    window.localStorage.setItem("layoutry:inspector-panel-width", "360");
    const user = userEvent.setup();
    renderShell();
    expect(inspectorPanel().style.width).toBe("360px");

    await user.click(
      screen.getByRole("button", { name: "Collapse Inspector panel" }),
    );
    expect(window.localStorage.getItem("layoutry:inspector-panel-width")).toBe(
      "360",
    );

    await user.click(
      screen.getByRole("button", { name: "Expand Inspector panel" }),
    );
    expect(inspectorPanel().style.width).toBe("360px");
  });

  it("keeps hidden (View menu) and collapsed distinct: re-showing restores the collapsed rail", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(
      screen.getByRole("button", { name: "Collapse Resource panel" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "View" }));
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: "Resource Panel" }),
    );
    expect(
      screen.queryByRole("complementary", { name: "Resource panel" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "View" }));
    await user.click(
      screen.getByRole("menuitemcheckbox", { name: "Resource Panel" }),
    );
    expect(resourcePanel().style.width).toBe("66px");
    expect(
      screen.getByRole("button", { name: "Expand Resource panel" }),
    ).toBeInTheDocument();
  });

  it("preserves the active Resource section, and a rail tab expands the panel in one action", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("tab", { name: "Assets" }));
    await user.click(
      screen.getByRole("button", { name: "Collapse Resource panel" }),
    );
    expect(screen.getByRole("tab", { name: "Assets" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(screen.getByRole("tab", { name: "Templates" }));
    expect(resourcePanel().style.width).toBe("280px");
    expect(screen.getByRole("tab", { name: "Templates" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});

// UI-1.7 — the status bar shows only true information.
describe("AppShell status bar", () => {
  afterEach(() => setViewportWidth(originalInnerWidth));

  it("reports the real editor mode and no fake save/zoom/selection values", () => {
    setViewportWidth(1440);
    const { rerender } = renderShell();
    const statusBar = screen.getByRole("contentinfo", { name: "Status bar" });

    expect(statusBar).toHaveTextContent("Design mode");
    expect(statusBar).toHaveTextContent("Saving isn't available yet");
    expect(statusBar).not.toHaveTextContent(/Saved|Zoom|selected/);

    rerender(
      <AppShell
        workspaceContent={<div>workspace content</div>}
        inspectorContent={<div>inspector content</div>}
        editMenuCommands={noopEditMenuCommands}
        previewControl={{ mode: "preview", onToggle: () => {} }}
      />,
    );
    expect(statusBar).toHaveTextContent("Preview mode");
  });
});
