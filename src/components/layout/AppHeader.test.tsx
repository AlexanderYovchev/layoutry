import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("identifies the product and reserves space for the application menu", () => {
    render(<AppHeader />);

    expect(
      screen.getByRole("banner", { name: "Application menu bar" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Layoutry")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Application menu" }),
    ).toBeInTheDocument();
    for (const item of ["File", "Edit", "View", "Project", "Help"]) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });
});
