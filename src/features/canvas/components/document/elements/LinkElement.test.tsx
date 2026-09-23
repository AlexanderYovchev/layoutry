import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { LinkElement } from "./LinkElement";

const initialState = useEditorStore.getState();

describe("LinkElement", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useEditorStore.setState(initialState, true);
  });

  it("renders a genuine <a> with its visible text from node.text", () => {
    render(<LinkElement node={{ id: "link-1", tag: "a", text: "Learn more", href: "/about" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    const link = screen.getByRole("link", { name: "Learn more" });
    expect(link.tagName).toBe("A");
  });

  it("reflects the node's own destination as a real href attribute", () => {
    render(<LinkElement node={{ id: "link-1", tag: "a", text: "Learn more", href: "/about" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute("href", "/about");
  });

  it("falls back to the safe default destination when href is unset", () => {
    render(<LinkElement node={{ id: "link-1", tag: "a", text: "Learn more" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute("href", "#");
  });

  it("prevents the browser's default navigation on click without removing the real href (Checkpoint 1.4)", () => {
    render(<LinkElement node={{ id: "link-1", tag: "a", text: "Learn more", href: "https://example.com" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    const link = screen.getByRole("link", { name: "Learn more" });
    // fireEvent.click returns false exactly when preventDefault() was
    // called by a handler — the same signal a native dispatchEvent gives.
    const notCancelled = fireEvent.click(link);

    expect(notCancelled).toBe(false);
    expect(link).toHaveAttribute("href", "https://example.com");
  });

  it("applies the preferred size and clips overflow once resized — same shared resolver pipeline as every other primitive", () => {
    render(
      <LinkElement
        node={{
          id: "link-1",
          tag: "a",
          text: "Learn more",
          href: "/about",
          dimensions: { preferredWidth: 200, preferredHeight: 40, offsetX: 0, offsetY: 0 },
        }}
        parentId="section-1"
        parentLayoutMode="flow"
        parentFlowDisplay="block"
      />,
    );

    const link = screen.getByRole("link", { name: "Learn more" });
    expect(link.style.width).toBe("200px");
    expect(link.style.height).toBe("40px");
    expect(link.style.overflow).toBe("hidden");
  });

  it("is not editable until double-clicked (Checkpoint 1.3 architecture reused)", () => {
    render(<LinkElement node={{ id: "link-1", tag: "a", text: "Learn more", href: "/about" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute("contenteditable", "false");
  });

  it("double-click enters editing mode while remaining a real <a>", () => {
    render(<LinkElement node={{ id: "link-1", tag: "a", text: "Learn more", href: "/about" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);

    const link = screen.getByRole("link", { name: "Learn more" });
    fireEvent.doubleClick(link);

    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("contenteditable", "true");
  });

  it("commits edited text through the store's generic setElementText — the same Checkpoint 1.3 command Heading/Paragraph use, not a Link-specific mutation", () => {
    render(<LinkElement node={{ id: "link-1", tag: "a", text: "Learn more", href: "/about" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
    const spy = vi.spyOn(useEditorStore.getState(), "setElementText");

    const link = screen.getByRole("link", { name: "Learn more" });
    fireEvent.doubleClick(link);
    link.textContent = "Read the docs";
    fireEvent.blur(link);

    expect(spy).toHaveBeenCalledWith("link-1", "Read the docs");
    expect(link).toHaveAttribute("contenteditable", "false");
  });

  describe("Legacy underline chrome (Checkpoint 1.15.6.10.3)", () => {
    it("renders underlined by default when no decoration is authored — the legacy fallback", () => {
      render(<LinkElement node={{ id: "link-1", tag: "a", text: "Learn more", href: "/about" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
      expect(screen.getByRole("link", { name: "Learn more" }).className).toContain("underline");
    });

    it("yields the legacy underline class entirely once a real decoration is authored", () => {
      render(
        <LinkElement
          node={{ id: "link-1", tag: "a", text: "Learn more", href: "/about", typography: { textDecorationLine: "underline" } }}
          parentId="section-1"
          parentLayoutMode="flow"
          parentFlowDisplay="block"
        />,
      );
      const link = screen.getByRole("link", { name: "Learn more" });
      // The class-level legacy underline is gone; the real underline now
      // comes from resolveTypographyStyle's own inline style instead.
      expect(link.className).not.toContain("underline");
      expect(link.style.textDecorationLine).toBe("underline");
    });

    it("authoring 'none' actually removes the underline — not the same as leaving it unset", () => {
      render(
        <LinkElement
          node={{ id: "link-1", tag: "a", text: "Learn more", href: "/about", typography: { textDecorationLine: "none" } }}
          parentId="section-1"
          parentLayoutMode="flow"
          parentFlowDisplay="block"
        />,
      );
      const link = screen.getByRole("link", { name: "Learn more" });
      expect(link.className).not.toContain("underline");
      expect(link.style.textDecorationLine).toBe("none");
    });

    it("never renders the w-fit class — removed unconditionally, not made conditional", () => {
      render(<LinkElement node={{ id: "link-1", tag: "a", text: "Learn more", href: "/about" }} parentId="section-1" parentLayoutMode="flow" parentFlowDisplay="block" />);
      const classList = screen.getByRole("link", { name: "Learn more" }).className.split(" ");
      expect(classList).not.toContain("w-fit");
    });

    it("stays inline-block regardless of authored decoration", () => {
      render(
        <LinkElement
          node={{ id: "link-1", tag: "a", text: "Learn more", href: "/about", typography: { textDecorationLine: "overline" } }}
          parentId="section-1"
          parentLayoutMode="flow"
          parentFlowDisplay="block"
        />,
      );
      expect(screen.getByRole("link", { name: "Learn more" }).className).toContain("inline-block");
    });
  });
});
