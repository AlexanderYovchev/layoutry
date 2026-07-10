import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("identifies the product and shows the tagline", () => {
    render(<AppHeader />);

    expect(screen.getByText("Layoutry")).toBeInTheDocument();
    expect(
      screen.getByText("Build layouts visually. Own the code."),
    ).toBeInTheDocument();
  });
});
