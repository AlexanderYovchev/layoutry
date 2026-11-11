import { readFileSync } from "node:fs";
import path from "node:path";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createImageNode } from "@/features/editor/factories/elementFactories";
import { registerDocumentSaveLimitGuard } from "@/features/editor/rules/documentSaveLimitGuard";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { documentFitsProjectFile } from "@/features/project/rules/projectSaveLimit";
import { IMAGE_UPLOAD_MESSAGES, type DecodeImage } from "@/features/inspector/utils/validateImageUpload";
import { ALT_TEXT_COPY, InspectorImageSection } from "./InspectorImageSection";
import { IMAGE_UPLOAD_COPY } from "./InspectorImageUploadField";

const initialState = useEditorStore.getState();
const store = () => useEditorStore.getState();
const fixture = (name: string) => readFileSync(path.join(process.cwd(), "test", "fixtures", "images", name));
const pngFile = () => new File([fixture("upload-40x30.png")], "upload-40x30.png", { type: "image/png" });
const PNG_DATA_URL = `data:image/png;base64,${fixture("upload-40x30.png").toString("base64")}`;
const decode: DecodeImage = async () => ({ width: 40, height: 30 });

function Harness({ id, decoder = decode }: { id: string; decoder?: DecodeImage }) {
  const node = useEditorStore((state) => findNodeById(state.document, id));
  return node ? <InspectorImageSection node={node} decode={decoder} /> : null;
}

const input = () => screen.getByTestId("image-upload-input") as HTMLInputElement;
const choose = (file: File) => fireEvent.change(input(), { target: { files: [file] } });
const src = (id: string) => findNodeById(store().document, id)?.src;

let imageId: string;
let unregister: () => void;
beforeEach(() => {
  unregister = registerDocumentSaveLimitGuard(documentFitsProjectFile);
  const image = createImageNode();
  store().insertElement("page-root", image);
  imageId = image.id;
});
afterEach(() => {
  unregister();
  vi.restoreAllMocks();
  useEditorStore.setState(initialState, true);
});

describe("Image section upload (BC-07.2)", () => {
  it("offers a keyboard-reachable Upload button tied to a hidden, single-file raster picker", () => {
    render(<Harness id={imageId} />);
    const button = screen.getByRole("button", { name: IMAGE_UPLOAD_COPY.upload });
    expect(button).toHaveAccessibleDescription(IMAGE_UPLOAD_COPY.hint);
    expect(input()).toHaveAttribute("accept", ".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp");
    expect(input()).not.toHaveAttribute("multiple");
    expect(input()).toHaveAttribute("tabindex", "-1");
    // Every Inspector form control has a name, the hidden picker input included (inspector-final-regression).
    // (aria-hidden, so it's checked as an attribute: the accessible-name algorithm skips hidden elements.)
    expect(input()).toHaveAttribute("aria-label", "Upload image file");
    const click = vi.spyOn(input(), "click");
    fireEvent.click(button);
    expect(click).toHaveBeenCalledOnce();
  });

  it("uploads a PNG as one Undo step, then shows it as the uploaded file with Replace and Remove", async () => {
    render(<Harness id={imageId} />);
    const history = store().past.length;
    choose(pngFile());
    await waitFor(() => expect(src(imageId)).toBe(PNG_DATA_URL));
    expect(store().past.length).toBe(history + 1);
    expect(screen.getByText("upload-40x30.png")).toBeInTheDocument();
    expect(screen.getByText("PNG · 40 × 30 · 117 B")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: IMAGE_UPLOAD_COPY.replace })).toBeInTheDocument();
    expect(screen.getByLabelText("Source URL")).toHaveValue("");
    expect(screen.getByLabelText("Reset source url")).toBeDisabled();
  });

  it("an embedded image from a reopened project shows what its data says, without a file name", () => {
    store().setElementSrc(imageId, PNG_DATA_URL);
    render(<Harness id={imageId} />);
    expect(screen.getByText("Uploaded PNG image")).toBeInTheDocument();
    expect(screen.getByText("PNG · 117 B")).toBeInTheDocument();
  });

  it("a rejected file shows an alert and changes nothing: source, history, unsaved state", async () => {
    store().setElementSrc(imageId, PNG_DATA_URL);
    store().markDocumentPersisted(store().document);
    const before = { document: store().document, past: store().past };
    render(<Harness id={imageId} />);
    choose(new File([fixture("svg-renamed.png")], "logo.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(IMAGE_UPLOAD_MESSAGES.svg);
    expect(store().document).toBe(before.document);
    expect(store().past).toBe(before.past);
    expect(store().persistedDocument).toBe(before.document);
  });

  it("a project-size refusal is shown the same way", async () => {
    // Fill the project with another image to the largest size that still
    // fits once this Image holds a short URL, but not once it holds the PNG.
    store().setElementSrc(imageId, "a.png");
    const filler = createImageNode();
    store().insertElement("page-root", filler);
    const withFiller = (length: number) => store().setElementSrc(filler.id, "data:image/png;base64," + "A".repeat(length));
    let low = 0;
    let high = 17_000_000;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      withFiller(middle);
      if (documentFitsProjectFile(store().document)) low = middle;
      else high = middle - 1;
    }
    withFiller(low);
    const before = store().document;
    render(<Harness id={imageId} />);
    choose(pngFile());
    expect(await screen.findByRole("alert")).toHaveTextContent("This image would make the project too large to save.");
    expect(store().document).toBe(before);
  });

  it("while reading: the button says so, keeps focus, and ignores further clicks", async () => {
    let finish!: (size: { width: number; height: number }) => void;
    const slowDecode: DecodeImage = () => new Promise((resolve) => (finish = resolve));
    render(<Harness id={imageId} decoder={slowDecode} />);
    const button = screen.getByRole("button", { name: IMAGE_UPLOAD_COPY.upload });
    button.focus();
    choose(pngFile());
    const busy = await screen.findByRole("button", { name: IMAGE_UPLOAD_COPY.reading });
    expect(busy).toBe(button);
    expect(busy).toHaveAttribute("aria-disabled", "true");
    expect(busy).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(IMAGE_UPLOAD_COPY.reading);
    const click = vi.spyOn(input(), "click");
    fireEvent.click(busy);
    expect(click).not.toHaveBeenCalled();
    await act(async () => finish({ width: 40, height: 30 }));
    await waitFor(() => expect(src(imageId)).toBe(PNG_DATA_URL));
    expect(screen.getByRole("button", { name: IMAGE_UPLOAD_COPY.replace })).toHaveFocus();
  });

  it("switching the section to another Image during a read drops the result", async () => {
    const other = createImageNode();
    store().insertElement("page-root", other);
    let finish!: (size: { width: number; height: number }) => void;
    const slowDecode: DecodeImage = () => new Promise((resolve) => (finish = resolve));
    const { rerender } = render(<Harness id={imageId} decoder={slowDecode} />);
    choose(pngFile());
    await screen.findByRole("button", { name: IMAGE_UPLOAD_COPY.reading });
    rerender(<Harness id={other.id} decoder={slowDecode} />);
    const before = store().document;
    await act(async () => finish({ width: 40, height: 30 }));
    expect(store().document).toBe(before);
    expect(screen.getByRole("button", { name: IMAGE_UPLOAD_COPY.upload })).toBeInTheDocument();
  });

  it("closing the section (unmount) during a read drops the result", async () => {
    let finish!: (size: { width: number; height: number }) => void;
    const slowDecode: DecodeImage = () => new Promise((resolve) => (finish = resolve));
    const { unmount } = render(<Harness id={imageId} decoder={slowDecode} />);
    choose(pngFile());
    await screen.findByRole("button", { name: IMAGE_UPLOAD_COPY.reading });
    unmount();
    const before = store().document;
    await act(async () => finish({ width: 40, height: 30 }));
    expect(store().document).toBe(before);
  });

  it("cancelling the picker (a change with no file) does nothing", () => {
    render(<Harness id={imageId} />);
    const before = store().document;
    fireEvent.change(input(), { target: { files: [] } });
    expect(store().document).toBe(before);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Remove clears the source in one Undo step and moves focus to the Upload button", async () => {
    store().setElementSrc(imageId, PNG_DATA_URL);
    render(<Harness id={imageId} />);
    const history = store().past.length;
    fireEvent.click(screen.getByRole("button", { name: IMAGE_UPLOAD_COPY.removeLabel }));
    expect(src(imageId)).toBeUndefined();
    expect(store().past.length).toBe(history + 1);
    expect(screen.getByRole("button", { name: IMAGE_UPLOAD_COPY.upload })).toHaveFocus();
    store().undo();
    expect(src(imageId)).toBe(PNG_DATA_URL);
  });

  it("typing a URL over an upload replaces it", () => {
    store().setElementSrc(imageId, PNG_DATA_URL);
    render(<Harness id={imageId} />);
    const field = screen.getByLabelText("Source URL");
    fireEvent.change(field, { target: { value: "https://example.com/photo.jpg" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(src(imageId)).toBe("https://example.com/photo.jpg");
  });
});

describe("Image section Alt text (BC-07.2)", () => {
  it("has a visible label and associated helper text", () => {
    render(<Harness id={imageId} />);
    const field = screen.getByLabelText(ALT_TEXT_COPY.label);
    expect(field).toHaveAccessibleDescription(ALT_TEXT_COPY.description);
    expect(screen.getByText(ALT_TEXT_COPY.description)).toBeVisible();
  });

  it("commits on blur as one Undo step, not per keystroke", () => {
    render(<Harness id={imageId} />);
    const field = screen.getByLabelText(ALT_TEXT_COPY.label);
    const history = store().past.length;
    for (const value of ["A", "A d", "A dog"]) fireEvent.change(field, { target: { value } });
    expect(store().past.length).toBe(history);
    fireEvent.blur(field);
    expect(findNodeById(store().document, imageId)?.displayName).toBe("A dog");
    expect(store().past.length).toBe(history + 1);
  });

  it("emptying the field commits an empty (decorative) alt instead of reverting", () => {
    store().setElementAltText(imageId, "Logo");
    render(<Harness id={imageId} />);
    const field = screen.getByLabelText(ALT_TEXT_COPY.label);
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(findNodeById(store().document, imageId)).not.toHaveProperty("displayName");
    expect(field).toHaveValue("");
  });

  it("Escape reverts a draft without committing", () => {
    store().setElementAltText(imageId, "Logo");
    render(<Harness id={imageId} />);
    const field = screen.getByLabelText(ALT_TEXT_COPY.label);
    const history = store().past.length;
    fireEvent.change(field, { target: { value: "Other" } });
    fireEvent.keyDown(field, { key: "Escape" });
    expect(field).toHaveValue("Logo");
    expect(store().past.length).toBe(history);
  });
});
