import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("renders all shell regions with feature content in their slots", () => {
    render(
      <AppShell
        workspaceContent={<div>workspace content</div>}
        inspectorContent={<div>inspector content</div>}
      />,
    );

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
    const user = userEvent.setup();
    render(
      <AppShell
        workspaceContent={<div>workspace content</div>}
        inspectorContent={<div>inspector content</div>}
      />,
    );

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
    const user = userEvent.setup();
    render(
      <AppShell
        workspaceContent={<div>workspace content</div>}
        inspectorContent={<div>inspector content</div>}
      />,
    );

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
});
