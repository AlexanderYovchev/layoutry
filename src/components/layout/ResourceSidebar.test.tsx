import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResourceSidebar } from "./ResourceSidebar";

const noop = () => {};

function renderResourceSidebar(
  props: Partial<React.ComponentProps<typeof ResourceSidebar>> = {},
) {
  return render(
    <ResourceSidebar
      width={280}
      minWidth={220}
      maxWidth={520}
      isDragging={false}
      onPointerDown={noop}
      onPointerMove={noop}
      onPointerUp={noop}
      {...props}
    />,
  );
}

describe("ResourceSidebar", () => {
  it("shows the six navigation items with Elements active by default", () => {
    renderResourceSidebar();

    const rail = within(
      screen.getByRole("tablist", { name: "Resource categories" }),
    );
    for (const label of [
      "Elements",
      "Components",
      "Templates",
      "Structure",
      "Assets",
      "Favorites",
    ]) {
      expect(rail.getByRole("tab", { name: label })).toBeInTheDocument();
    }

    expect(rail.getByRole("tab", { name: "Elements" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByText(
        "This area will contain the complete HTML element library.",
      ),
    ).toBeInTheDocument();
  });

  it("switches the context panel content when a different navigation item is clicked", async () => {
    const user = userEvent.setup();
    renderResourceSidebar();

    await user.click(screen.getByRole("tab", { name: "Assets" }));

    expect(screen.getByRole("tab", { name: "Assets" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "Elements" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(
      screen.getByText("This area will contain uploaded assets."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "This area will contain the complete HTML element library.",
      ),
    ).not.toBeInTheDocument();
  });

  it("moves focus between navigation items with the arrow keys", async () => {
    const user = userEvent.setup();
    renderResourceSidebar();

    const elementsTab = screen.getByRole("tab", { name: "Elements" });
    elementsTab.focus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("tab", { name: "Components" })).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(elementsTab).toHaveFocus();
  });

  it("renders the provided structureContent when Structure is selected, and only then", async () => {
    const user = userEvent.setup();
    renderResourceSidebar({
      structureContent: <div>mock structure panel</div>,
    });

    expect(screen.queryByText("mock structure panel")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Structure" }));

    expect(screen.getByText("mock structure panel")).toBeInTheDocument();
  });

  it("renders at the width it's given and forwards resize-handle pointer events", () => {
    const onPointerDown = vi.fn();
    const onPointerMove = vi.fn();
    const onPointerUp = vi.fn();
    renderResourceSidebar({
      width: 340,
      onPointerDown,
      onPointerMove,
      onPointerUp,
    });

    const panel = screen.getByRole("complementary", {
      name: "Resource panel",
    });
    expect(panel.style.width).toBe("340px");

    const handle = screen.getByRole("separator");
    fireEvent.pointerDown(handle, { clientX: 100 });
    fireEvent.pointerMove(handle, { clientX: 160 });
    fireEvent.pointerUp(handle, { clientX: 160 });

    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onPointerMove).toHaveBeenCalledTimes(1);
    expect(onPointerUp).toHaveBeenCalledTimes(1);
  });
});
