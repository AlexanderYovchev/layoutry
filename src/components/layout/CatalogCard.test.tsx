import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CatalogCardPlaceholder } from "@/components/layout/creationToolbarCategories";
import { CatalogCard } from "./CatalogCard";

const enabledCard: CatalogCardPlaceholder = {
  id: "html-forms-1",
  name: "Button",
  description: "Interactive button",
  disabled: false,
  elementType: "button",
};

const disabledCard: CatalogCardPlaceholder = {
  id: "html-navigation-0",
  name: "Link",
  description: "Navigable link",
  disabled: true,
};

describe("CatalogCard", () => {
  it("calls onActivate when an enabled card is clicked", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(<CatalogCard card={enabledCard} onActivate={onActivate} />);

    await user.click(screen.getByRole("menuitem", { name: /Button/ }));

    expect(onActivate).toHaveBeenCalledWith(enabledCard);
  });

  it("is reachable via Tab and activates on Enter", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(<CatalogCard card={enabledCard} onActivate={onActivate} />);

    await user.tab();
    expect(screen.getByRole("menuitem", { name: /Button/ })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(onActivate).toHaveBeenCalledWith(enabledCard);
  });

  it("never activates a disabled card", async () => {
    const user = userEvent.setup();
    const onActivate = vi.fn();
    render(<CatalogCard card={disabledCard} onActivate={onActivate} />);

    const card = screen.getByRole("menuitem", { name: /Link/ });
    expect(card).toBeDisabled();
    expect(card).toHaveAttribute("tabindex", "-1");

    await user.click(card);
    expect(onActivate).not.toHaveBeenCalled();
  });
});
