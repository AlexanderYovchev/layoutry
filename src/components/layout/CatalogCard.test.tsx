import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MousePointerClick } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import type { CatalogCardPlaceholder } from "@/components/layout/creationToolbarCategories";
import { CatalogCard } from "./CatalogCard";

const enabledCard: CatalogCardPlaceholder = {
  id: "html-forms-1",
  name: "Button",
  description: "Interactive button",
  disabled: false,
  elementType: "button",
  icon: MousePointerClick,
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

  it("gives an enabled card pointer-cursor and hover/focus-visible styling hooks", () => {
    render(<CatalogCard card={enabledCard} />);

    const card = screen.getByRole("menuitem", { name: /Button/ });
    expect(card.className).toContain("enabled:cursor-pointer");
    expect(card.className).toContain("enabled:hover:scale-[1.02]");
    expect(card.className).toContain("enabled:hover:bg-zinc-100");
    expect(card.className).toContain("enabled:hover:border-zinc-300");
    expect(card.className).toContain("enabled:focus-visible:scale-[1.02]");
    expect(card.className).toContain("enabled:focus-visible:bg-zinc-100");
    expect(card.className).toContain("enabled:active:scale-100");
  });

  it("does not apply the enabled interactive styling hooks to a disabled card", () => {
    render(<CatalogCard card={disabledCard} />);

    const card = screen.getByRole("menuitem", { name: /Link/ });
    expect(card.className).toContain("disabled:cursor-not-allowed");
    expect(card.className).not.toContain("hover:cursor-pointer");
  });

  it("renders the card's icon when one is provided (Checkpoint 1.12.1)", () => {
    render(<CatalogCard card={enabledCard} />);

    const card = screen.getByRole("menuitem", { name: /Button/ });
    expect(card.querySelector("svg")).toBeInTheDocument();
    // No dashed-placeholder fallback square once a real icon renders.
    expect(card.querySelector(".border-dashed")).not.toBeInTheDocument();
  });

  it("falls back to the dashed placeholder square when a card has no icon", () => {
    render(<CatalogCard card={disabledCard} />);

    const card = screen.getByRole("menuitem", { name: /Link/ });
    expect(card.querySelector("svg")).not.toBeInTheDocument();
    expect(card.querySelector(".border-dashed")).toBeInTheDocument();
  });
});
