import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { InspectorLinkSection } from "./InspectorLinkSection";

const initialState = useEditorStore.getState();

// Subscribes to the store so each commit sees the freshly-updated node —
// mirrors how the real Inspector re-derives `node` from the document on
// every store change (see useSelectedNode).
function ConnectedSection({ id }: { id: string }) {
  const node = useEditorStore((state) => state.document.children?.find((c) => c.id === id));
  if (!node) return null;
  return <InspectorLinkSection node={node} />;
}

function setup(node: { id: string; tag: string; text?: string; href?: string }) {
  useEditorStore.setState((state) => ({
    document: { ...state.document, children: [{ ...node }] },
  }));
  return render(<ConnectedSection id={node.id} />);
}

function currentNode(id: string) {
  return useEditorStore.getState().document.children?.find((c) => c.id === id);
}

describe("InspectorLinkSection", () => {
  afterEach(() => {
    useEditorStore.setState(initialState, true);
  });

  it("shows the node's explicit href in the destination field", () => {
    setup({ id: "link-1", tag: "a", text: "Link text", href: "/about" });
    expect(screen.getByLabelText("Link destination")).toHaveValue("/about");
  });

  it("shows the safe default destination when href is unset", () => {
    setup({ id: "link-1", tag: "a", text: "Link text" });
    expect(screen.getByLabelText("Link destination")).toHaveValue("#");
  });

  it("commits a new destination through setElementHref on blur", () => {
    setup({ id: "link-1", tag: "a", text: "Link text", href: "#" });

    const field = screen.getByLabelText("Link destination");
    fireEvent.change(field, { target: { value: "/pricing" } });
    fireEvent.blur(field);

    expect(currentNode("link-1")?.href).toBe("/pricing");
  });

  it("commits on Enter", () => {
    setup({ id: "link-1", tag: "a", text: "Link text", href: "#" });

    const field = screen.getByLabelText("Link destination");
    fireEvent.change(field, { target: { value: "https://example.com" } });
    fireEvent.keyDown(field, { key: "Enter" });

    expect(currentNode("link-1")?.href).toBe("https://example.com");
  });

  it("Enter does not double-commit via the blur it triggers (pushes exactly one history entry)", () => {
    setup({ id: "link-1", tag: "a", text: "Link text", href: "#" });
    const pastLengthBefore = useEditorStore.getState().past.length;

    const field = screen.getByLabelText("Link destination");
    fireEvent.change(field, { target: { value: "/pricing" } });
    fireEvent.keyDown(field, { key: "Enter" });
    fireEvent.blur(field);

    expect(currentNode("link-1")?.href).toBe("/pricing");
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore + 1);
  });

  it("Escape does not revert-then-commit via the blur it triggers", () => {
    setup({ id: "link-1", tag: "a", text: "Link text", href: "/about" });
    const pastLengthBefore = useEditorStore.getState().past.length;

    const field = screen.getByLabelText("Link destination");
    fireEvent.change(field, { target: { value: "/discarded" } });
    fireEvent.keyDown(field, { key: "Escape" });
    fireEvent.blur(field);

    expect(currentNode("link-1")?.href).toBe("/about");
    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);
  });

  it("Escape reverts the draft without committing", () => {
    setup({ id: "link-1", tag: "a", text: "Link text", href: "/about" });

    const field = screen.getByLabelText("Link destination");
    fireEvent.change(field, { target: { value: "/discarded" } });
    fireEvent.keyDown(field, { key: "Escape" });

    expect(field).toHaveValue("/about");
    expect(currentNode("link-1")?.href).toBe("/about");
  });

  it("rejects an empty destination — blurring an emptied field reverts rather than commits", () => {
    setup({ id: "link-1", tag: "a", text: "Link text", href: "/about" });

    const field = screen.getByLabelText("Link destination");
    fireEvent.change(field, { target: { value: "   " } });
    fireEvent.blur(field);

    expect(field).toHaveValue("/about");
    expect(currentNode("link-1")?.href).toBe("/about");
  });

  it("rejects a javascript: destination with a validation error and does not commit it", () => {
    setup({ id: "link-1", tag: "a", text: "Link text", href: "/about" });

    const field = screen.getByLabelText("Link destination");
    fireEvent.change(field, { target: { value: "javascript:alert(1)" } });
    fireEvent.blur(field);

    expect(screen.getByRole("alert")).toHaveTextContent(/javascript/i);
    expect(currentNode("link-1")?.href).toBe("/about");
  });

  it("does not commit when the destination is unchanged (avoids a spurious history entry)", () => {
    setup({ id: "link-1", tag: "a", text: "Link text", href: "/about" });
    const pastLengthBefore = useEditorStore.getState().past.length;

    const field = screen.getByLabelText("Link destination");
    fireEvent.blur(field);

    expect(useEditorStore.getState().past).toHaveLength(pastLengthBefore);
  });

  it("Reset clears an explicit href back to the safe default", () => {
    setup({ id: "link-1", tag: "a", text: "Link text", href: "/about" });

    fireEvent.click(screen.getByRole("button", { name: "Reset link destination" }));

    expect(currentNode("link-1")?.href).toBeUndefined();
    expect(screen.getByLabelText("Link destination")).toHaveValue("#");
  });

  it("Reset is disabled when there is no explicit href to remove", () => {
    setup({ id: "link-1", tag: "a", text: "Link text" });
    expect(screen.getByRole("button", { name: "Reset link destination" })).toBeDisabled();
  });
});
