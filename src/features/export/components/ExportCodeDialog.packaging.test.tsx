import { readFileSync } from "node:fs";
import path from "node:path";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { strFromU8, unzipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { ExportCodeDialog } from "@/features/export/components/ExportCodeDialog";
import type { DesktopExportFiles } from "@/features/export/desktop/desktopExportFiles";
import { exportHtmlCss } from "@/features/export/utils/exportHtmlCss";
import * as blobDownload from "@/lib/downloadBlob";
import * as textDownload from "@/lib/downloadTextFile";

const fixture = (name: string) => readFileSync(path.join(process.cwd(), "test", "fixtures", "images", name));
const PNG = `data:image/png;base64,${fixture("upload-40x30.png").toString("base64")}`;
const JPEG = `data:image/jpeg;base64,${fixture("upload-32x24.jpg").toString("base64")}`;

/** Two uploaded images, one of them used twice, plus a remote one. */
const uploadedPage: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "img-a", tag: "img", src: PNG, displayName: "Swatch" },
    { id: "img-b", tag: "img", src: PNG, displayName: "Swatch again" },
    { id: "img-c", tag: "img", src: JPEG, displayName: "Card" },
    { id: "img-d", tag: "img", src: "https://example.com/remote.png", displayName: "Remote" },
  ],
};

let initial: ReturnType<typeof useEditorStore.getState>;
beforeEach(() => {
  initial = useEditorStore.getState();
  act(() => useEditorStore.setState({ document: uploadedPage, persistedDocument: uploadedPage, past: [], future: [] }));
});
afterEach(() => {
  act(() => useEditorStore.setState(initial, true));
  vi.restoreAllMocks();
});

function renderDialog(desktop: DesktopExportFiles | null = null) {
  return render(<ExportCodeDialog open onClose={vi.fn()} title="My Site" desktop={desktop} />);
}

async function chooseSeparate() {
  const user = userEvent.setup();
  await screen.findByTestId("export-code");
  await user.click(screen.getByRole("radio", { name: /Separate files/ }));
  await waitFor(() => expect(screen.getByTestId("export-image-files")).toBeInTheDocument());
  return user;
}

describe("ExportCodeDialog — image packaging (BC-07.3)", () => {
  it("Separate files explains the assets folder and lists each image file once, with its use count", async () => {
    renderDialog();
    await chooseSeparate();
    expect(screen.getByRole("radio", { name: /uploaded images as files in an assets folder/ })).toBeChecked();
    expect(screen.getByTestId("export-keep-together")).toHaveTextContent("Keep index.html, styles.css and the assets folder together");
    const list = screen.getByRole("list", { name: /exported as 2 image files/ });
    expect(list).toHaveTextContent("assets/image-001.png · 117 B · used 2 times");
    expect(list).toHaveTextContent("assets/image-002.jpg · 778 B");
    expect(screen.getByTestId("export-generation-status")).toHaveTextContent("Code ready: 2 files and 2 image files");
    // Remote images are still described as before.
    expect(screen.getByTestId("export-remote-assets")).toHaveTextContent("loads 1 file");
  });

  it("the single HTML file says its images are embedded inside it", async () => {
    renderDialog();
    await screen.findByTestId("export-code");
    expect(screen.getByTestId("export-embedded-images")).toHaveTextContent("Uploaded images are embedded inside index.html");
    expect(screen.queryByTestId("export-image-files")).toBeNull();
  });

  it("downloads the website as one ZIP of exactly the files on screen, and changes nothing in the project", async () => {
    const saved = vi.spyOn(blobDownload, "downloadBlob").mockImplementation(() => undefined);
    const texts = vi.spyOn(textDownload, "downloadTextFile").mockImplementation(() => undefined);
    renderDialog();
    const user = await chooseSeparate();
    const before = useEditorStore.getState();
    expect(screen.queryByRole("button", { name: "Download all files" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Download website (.zip)" }));

    expect(texts).not.toHaveBeenCalled();
    expect(saved).toHaveBeenCalledTimes(1);
    const [name, blob] = saved.mock.calls[0];
    expect(name).toBe("My Site.zip");
    expect(blob.type).toBe("application/zip");
    const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const expected = exportHtmlCss(uploadedPage, { mode: "separate", title: "My Site" });
    expect(Object.keys(entries).sort()).toEqual(["assets/image-001.png", "assets/image-002.jpg", "index.html", "styles.css"]);
    expect(strFromU8(entries["index.html"])).toBe(expected.files[0].content);
    expect(Buffer.from(entries["assets/image-001.png"]).equals(fixture("upload-40x30.png"))).toBe(true);
    expect(Buffer.from(entries["assets/image-002.jpg"]).equals(fixture("upload-32x24.jpg"))).toBe(true);
    expect(screen.getByTestId("export-transfer-status")).toHaveTextContent("Download of My Site.zip started. Unzip it and open index.html");

    const after = useEditorStore.getState();
    expect(after.document).toBe(before.document);
    expect(after.past).toBe(before.past);
    expect(after.persistedDocument).toBe(before.persistedDocument);
    expect(after.selection).toBe(before.selection);
  });

  it("the selected text file can still be downloaded on its own", async () => {
    const texts = vi.spyOn(textDownload, "downloadTextFile").mockImplementation(() => undefined);
    renderDialog();
    const user = await chooseSeparate();
    await user.click(screen.getByRole("button", { name: "Download index.html" }));
    expect(texts).toHaveBeenCalledTimes(1);
  });

  it("a failed package build is reported and nothing downloads", async () => {
    const saved = vi.spyOn(blobDownload, "downloadBlob").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderDialog();
    const user = await chooseSeparate();
    await user.click(screen.getByRole("button", { name: "Download website (.zip)" }));
    expect(saved).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("The browser refused the download. Nothing was downloaded.");
  });

  it("desktop: Save to Folder sends the text files and the image bytes, and summarizes the images", async () => {
    const desktop: DesktopExportFiles = {
      chooseExportDestination: vi.fn(async () => ({ status: "chosen" as const, destination: { token: "t".repeat(32), label: "Site" } })),
      writeExportFiles: vi.fn<DesktopExportFiles["writeExportFiles"]>(async (_token, files) => ({ status: "saved" as const, label: "Site", fileNames: files.map((file) => file.path) })),
    };
    renderDialog(desktop);
    const user = await chooseSeparate();
    await user.click(screen.getByRole("button", { name: "Save to Folder…" }));
    const expected = exportHtmlCss(uploadedPage, { mode: "separate", title: "My Site" });
    expect(desktop.writeExportFiles).toHaveBeenCalledWith("t".repeat(32), [...expected.files, ...expected.assetFiles], false);
    expect(await screen.findByText("Saved index.html, styles.css and 2 image files in assets to “Site”.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download/ })).toBeNull();
  });
});
