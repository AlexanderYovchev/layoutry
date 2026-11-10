import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MAX_NAVIGATION_LINKS } from "@/features/editor/commands/navigationLinkCommands";
import { createBasicNavbarNode, createNavbarWithCtaNode } from "@/features/editor/factories/navigationCompositions";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { NAVIGATION_LINKS_COPY } from "@/features/inspector/utils/navigationLinksCopy";
import { InspectorNavigationLinksSection } from "./InspectorNavigationLinksSection";

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();

function setup(nav: EditorElementNode) {
  useEditorStore.setState((state) => ({ document: { ...state.document, children: [nav] } }));
  store().selectElement(nav.id);
  render(<LiveSection navId={nav.id} />);
}

/** Re-renders from the store like the real Inspector (which reads the selected node through a live selector). */
function LiveSection({ navId }: { navId: string }) {
  const node = useEditorStore((state) => state.document.children?.find((child) => child.id === navId));
  if (!node) return null;
  return <InspectorNavigationLinksSection node={node} />;
}

function rowLabels(): string[] {
  const list = screen.queryByRole("list", { name: "Navigation links" });
  if (!list) return [];
  return within(list)
    .getAllByRole("listitem")
    .map((row) => within(row).getByRole("button", { name: /^Select / }).getAttribute("aria-label")!.replace(/^Select /, ""));
}

function navWithLinks(count: number, extra: EditorElementNode[] = []): EditorElementNode {
  return {
    id: "nav-1",
    tag: "nav",
    flowLayout: { display: "flex", flex: { direction: "row", wrap: "nowrap", justifyContent: "start", alignItems: "center", rowGap: 24, columnGap: 24 } },
    children: [...Array.from({ length: count }, (_, index) => ({ id: `a-${index}`, tag: "a", text: `Link ${index + 1}`, href: "#" })), ...extra],
  };
}

describe("InspectorNavigationLinksSection (BC-06.2)", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows the heading, the count and the four default links in order", () => {
    setup(createBasicNavbarNode());
    expect(screen.getByRole("button", { name: "Navigation links" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("4 links")).toHaveAttribute("aria-live", "polite");
    expect(rowLabels()).toEqual(["Home", "About", "Services", "Contact"]);
    expect(screen.getByRole("button", { name: "Remove Home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move About up" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Move Services down" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add link" })).not.toHaveAttribute("aria-disabled");
  });

  it("does not list the CTA button", () => {
    setup(createNavbarWithCtaNode());
    expect(screen.getByText("3 links")).toBeInTheDocument();
    expect(rowLabels()).toEqual(["Home", "Features", "Pricing"]);
    expect(screen.queryByRole("button", { name: /Get Started/ })).toBeNull();
  });

  it("disables Move up on the first row and Move down on the last row only", () => {
    setup(createBasicNavbarNode());
    expect(screen.getByRole("button", { name: "Move Home up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Home down" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Move Contact down" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Contact up" })).toBeEnabled();
  });

  it("Add link adds a row and updates the count; focus stays on Add link", () => {
    setup(createBasicNavbarNode());
    const add = screen.getByRole("button", { name: "Add link" });
    add.focus();
    fireEvent.click(add);
    expect(screen.getByText("5 links")).toBeInTheDocument();
    expect(rowLabels()).toEqual(["Home", "About", "Services", "Contact", "New link"]);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add link" }));
  });

  it("Remove removes that row and moves focus to the next row's Remove, then the previous, then Add link", () => {
    setup(navWithLinks(3));
    fireEvent.click(screen.getByRole("button", { name: "Remove Link 2" }));
    expect(rowLabels()).toEqual(["Link 1", "Link 3"]);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove Link 3" }));

    fireEvent.click(screen.getByRole("button", { name: "Remove Link 3" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove Link 1" }));

    fireEvent.click(screen.getByRole("button", { name: "Remove Link 1" }));
    expect(screen.getByText(NAVIGATION_LINKS_COPY.empty)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Navigation links" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add link" }));
  });

  it("Move keeps focus on the moved row, switching to its other Move button at an end", () => {
    setup(createBasicNavbarNode());
    fireEvent.click(screen.getByRole("button", { name: "Move About down" }));
    expect(rowLabels()).toEqual(["Home", "Services", "About", "Contact"]);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Move About down" }));

    fireEvent.click(screen.getByRole("button", { name: "Move About down" }));
    expect(rowLabels()).toEqual(["Home", "Services", "Contact", "About"]);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Move About up" }));
  });

  it(`at ${MAX_NAVIGATION_LINKS} links Add link stays focusable but is aria-disabled, explained, and does nothing`, () => {
    setup(navWithLinks(MAX_NAVIGATION_LINKS));
    const add = screen.getByRole("button", { name: "Add link" });
    expect(add).toHaveAttribute("aria-disabled", "true");
    expect(add).toBeEnabled();
    expect(add).toHaveAccessibleDescription(NAVIGATION_LINKS_COPY.maximumNote);
    expect(add).toHaveAttribute("title", NAVIGATION_LINKS_COPY.maximum);
    const before = store().document;
    fireEvent.click(add);
    expect(store().document).toBe(before);
    expect(screen.getByText(`${MAX_NAVIGATION_LINKS} links`)).toBeInTheDocument();
  });

  it("shows the real count of an over-limit nav and keeps every row", () => {
    setup(navWithLinks(14));
    expect(screen.getByText("14 links")).toBeInTheDocument();
    expect(rowLabels()).toHaveLength(14);
    expect(screen.getByRole("button", { name: "Add link" })).toHaveAttribute("aria-disabled", "true");
  });

  it("shows the Wrap hint from 6 links, hides it below 6, and never changes the nav", () => {
    setup(navWithLinks(5));
    expect(screen.queryByText(NAVIGATION_LINKS_COPY.wrapHint)).toBeNull();
    const historyBefore = store().past.length;
    fireEvent.click(screen.getByRole("button", { name: "Add link" }));
    expect(screen.getByText(NAVIGATION_LINKS_COPY.wrapHint)).toBeInTheDocument();
    expect(store().past.length).toBe(historyBefore + 1);
    const nav = store().document.children![0];
    expect(nav.flowLayout?.flex?.wrap).toBe("nowrap");
    fireEvent.click(screen.getByRole("button", { name: "Remove New link" }));
    expect(screen.queryByText(NAVIGATION_LINKS_COPY.wrapHint)).toBeNull();
  });

  it("hides the Wrap hint when Wrap is already on, or the nav has no Wrap control (not Flex)", () => {
    const wrapped = navWithLinks(7);
    setup({ ...wrapped, flowLayout: { display: "flex", flex: { ...wrapped.flowLayout!.flex!, wrap: "wrap" } } });
    expect(screen.queryByText(NAVIGATION_LINKS_COPY.wrapHint)).toBeNull();
  });

  it("hides the Wrap hint for a block nav", () => {
    setup({ ...navWithLinks(7), flowLayout: undefined });
    expect(screen.queryByText(NAVIGATION_LINKS_COPY.wrapHint)).toBeNull();
  });

  it("gives duplicated and empty labels distinguishable names", () => {
    setup({
      id: "nav-1",
      tag: "nav",
      children: [
        { id: "a-1", tag: "a", text: "Docs", href: "#" },
        { id: "a-2", tag: "a", text: "Docs", href: "#" },
        { id: "a-3", tag: "a", text: "", href: "#" },
      ],
    });
    expect(screen.getByRole("button", { name: "Remove Docs (link 1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Docs (link 2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Remove ${NAVIGATION_LINKS_COPY.untitled}` })).toBeInTheDocument();
  });

  it("shows each destination, and selecting a row selects that link", () => {
    setup({ id: "nav-1", tag: "nav", children: [{ id: "a-1", tag: "a", text: "Blog", href: "/blog" }] });
    expect(screen.getByText("/blog")).toBeInTheDocument();
    expect(screen.getByText("1 link")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select Blog" }));
    expect(store().selection.primaryId).toBe("a-1");
  });
});
