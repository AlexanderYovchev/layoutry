import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorElementNode } from "@/features/editor/types/document";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { ExportCodeDialog } from "@/features/export/components/ExportCodeDialog";
import type { DesktopExportFiles } from "@/features/export/desktop/desktopExportFiles";
import type { HtmlCssExporter } from "@/features/export/hooks/useExportCodeSession";
import type { ExportEntitlement } from "@/features/export/types/exportEntitlement";
import { exportHtmlCss } from "@/features/export/utils/exportHtmlCss";
import * as download from "@/lib/downloadTextFile";

const SCRIPT_MARKUP = '<img src=x onerror="window.__exportPreviewRan=true"><script>window.__exportPreviewRan=true</script>';

const staticPage: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "heading-1", tag: "h1", text: "Hello export" },
    { id: "paragraph-1", tag: "p", text: SCRIPT_MARKUP },
    { id: "image-1", tag: "img" },
  ],
};

const interactivePage: EditorElementNode = {
  id: "page-root",
  tag: "page",
  children: [
    { id: "button-1", tag: "button", text: "Toggle", interactions: [{ id: "i-1", trigger: "click", action: "toggle", targetId: "panel-1" }] },
    { id: "panel-1", tag: "div", children: [{ id: "p-2", tag: "p", text: "Panel" }] },
  ],
};

function deepPage(depth: number): EditorElementNode {
  let node: EditorElementNode = { id: `div-${depth}`, tag: "div" };
  for (let level = depth - 1; level >= 2; level -= 1) node = { id: `div-${level}`, tag: "div", children: [node] };
  return { id: "page-root", tag: "page", children: [node] };
}

function setDocument(document: EditorElementNode) {
  act(() => useEditorStore.setState({ document }));
}

function renderDialog(props: Partial<Parameters<typeof ExportCodeDialog>[0]> = {}) {
  const onClose = vi.fn();
  const view = render(<ExportCodeDialog open onClose={onClose} title="My Site" desktop={null} {...props} />);
  return { ...view, onClose, dialog: () => screen.getByRole("dialog", { name: "Export Code" }) };
}

async function codeText() {
  return (await screen.findByTestId("export-code")).textContent ?? "";
}

let initialDocument: EditorElementNode;

beforeEach(() => {
  initialDocument = useEditorStore.getState().document;
  setDocument(staticPage);
});

afterEach(() => {
  act(() => useEditorStore.setState({ document: initialDocument }));
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "__exportPreviewRan");
});

describe("ExportCodeDialog — generation and preview", () => {
  it("shows exactly what the engine generates from the current document, as text", async () => {
    renderDialog();
    const expected = exportHtmlCss(staticPage, { mode: "standalone", title: "My Site" });
    expect(await codeText()).toBe(expected.files[0].content);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([expect.stringMatching(/^index\.html/)]);
    // Generated markup is never parsed into the preview: no element, no script.
    expect(screen.getByTestId("export-code").children).toHaveLength(0);
    expect(screen.getByTestId("export-code").querySelector("img, script")).toBeNull();
    expect(Reflect.get(window, "__exportPreviewRan")).toBeUndefined();
  });

  it("switches to separate files and lets every file be inspected", async () => {
    setDocument(interactivePage);
    const user = userEvent.setup();
    renderDialog();
    await codeText();
    await user.click(screen.getByRole("radio", { name: /Separate files/ }));
    const expected = exportHtmlCss(interactivePage, { mode: "separate", title: "My Site" });
    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(3));
    for (const file of expected.files) {
      await user.click(screen.getByRole("tab", { name: new RegExp(file.path.replace(".", "\\.")) }));
      expect(await codeText()).toBe(file.content);
    }
    expect(screen.getByTestId("export-keep-together")).toHaveTextContent("Keep index.html, styles.css and script.js together in one folder");
  });

  it("moves between file tabs with the arrow keys", async () => {
    setDocument(interactivePage);
    const user = userEvent.setup();
    renderDialog();
    await codeText();
    await user.click(screen.getByRole("radio", { name: /Separate files/ }));
    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(3));
    screen.getByRole("tab", { name: /index\.html/ }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /styles\.css/ })).toHaveFocus();
    expect(screen.getByRole("tab", { name: /styles\.css/ })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: /script\.js/ })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /index\.html/ })).toHaveFocus();
  });

  it("lists every diagnostic with its severity, element and property", async () => {
    renderDialog();
    await codeText();
    const list = screen.getByRole("list", { name: "Export diagnostics" });
    const item = within(list).getByText(/The image has no source/).closest("li");
    expect(item).toHaveAttribute("data-severity", "warning");
    expect(item).toHaveTextContent("Warning:");
    expect(item).toHaveTextContent("Element: Image (img)");
    expect(item).toHaveTextContent("Property: src");
    expect(screen.getByRole("heading", { name: "Export notes (1 warning)" })).toBeInTheDocument();
    expect(screen.getByTestId("export-generation-status")).toHaveTextContent("Code ready: 1 file, 1 warning.");
  });

  it("explains remote resources instead of implying they are bundled", async () => {
    setDocument({ id: "page-root", tag: "page", children: [{ id: "image-1", tag: "img", src: "https://example.com/a.png" }] });
    renderDialog();
    await codeText();
    expect(screen.getByTestId("export-remote-assets")).toHaveTextContent("loads 1 file (images, fonts or media) from the internet. They are not included in the export");
  });

  it("blocks export when the engine refuses the document", async () => {
    setDocument(deepPage(101));
    renderDialog();
    expect(await screen.findByText(/can't be exported until the errors below are fixed/)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Export diagnostics" })).toHaveTextContent(/Error:.*nested more than 100 levels/);
    expect(screen.queryByTestId("export-code")).toBeNull();
    expect(screen.getByRole("button", { name: /Copy code/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Download index\.html/ })).toBeDisabled();
  });

  it("reports a generation failure and can try again", async () => {
    const exporter = vi.fn<HtmlCssExporter>(() => {
      throw new Error("boom");
    });
    const user = userEvent.setup();
    renderDialog({ exporter });
    expect(await screen.findByText(/couldn't generate code for this design/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy code/ })).toBeDisabled();
    exporter.mockImplementation(exportHtmlCss);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await codeText()).toContain("Hello export");
  });

  it("asks the entitlement before generating and shows its reason when export isn't allowed", async () => {
    const entitlement: ExportEntitlement = { canExportCode: vi.fn(async () => ({ allowed: false as const, message: "Code export needs a plan that includes it." })) };
    const exporter = vi.fn(exportHtmlCss);
    renderDialog({ entitlement, exporter });
    expect(await screen.findByText("Code export needs a plan that includes it.")).toBeInTheDocument();
    expect(exporter).not.toHaveBeenCalled();
    expect(screen.queryByTestId("export-code")).toBeNull();
  });
});

describe("ExportCodeDialog — stale previews", () => {
  it("marks the preview stale after an edit, refuses to export it, and regenerates the current design", async () => {
    const user = userEvent.setup();
    const save = vi.spyOn(download, "downloadTextFile").mockImplementation(() => undefined);
    renderDialog();
    expect(await codeText()).toContain("Hello export");

    setDocument({ ...staticPage, children: [{ id: "heading-1", tag: "h1", text: "Edited heading" }] });
    expect(await screen.findByTestId("export-stale")).toHaveTextContent("The design changed after this code was generated");
    expect(screen.getByRole("button", { name: /Download index\.html/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Copy code/ })).toBeDisabled();
    // The old code stays visible as it was generated; it can't be exported.
    expect(await codeText()).toContain("Hello export");

    await user.click(screen.getByRole("button", { name: "Regenerate" }));
    await waitFor(() => expect(screen.queryByTestId("export-stale")).toBeNull());
    expect(await codeText()).toContain("Edited heading");
    await user.click(screen.getByRole("button", { name: /Download index\.html/ }));
    expect(save).toHaveBeenCalledWith("index.html", expect.stringContaining("Edited heading"), "text/html; charset=utf-8");
  });

  it("treats a renamed project as stale too (the title is part of the snapshot)", async () => {
    const { rerender } = renderDialog();
    expect(await codeText()).toContain("<title>My Site</title>");
    rerender(<ExportCodeDialog open onClose={vi.fn()} title="Renamed" desktop={null} />);
    expect(await screen.findByTestId("export-stale")).toBeInTheDocument();
  });
});

describe("ExportCodeDialog — copy and browser downloads", () => {
  it("copies the exact text of the selected file", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => undefined);
    vi.spyOn(navigator, "clipboard", "get").mockReturnValue({ writeText } as unknown as Clipboard);
    renderDialog();
    const text = await codeText();
    await user.click(screen.getByRole("button", { name: /Copy code/ }));
    expect(writeText).toHaveBeenCalledWith(text);
    expect(await screen.findByText("Copied index.html to the clipboard.")).toBeInTheDocument();
  });

  it("says so when copying fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator, "clipboard", "get").mockReturnValue({ writeText: vi.fn(async () => Promise.reject(new Error("denied"))) } as unknown as Clipboard);
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn(() => false) });
    renderDialog();
    await codeText();
    await user.click(screen.getByRole("button", { name: /Copy code/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't copy index.html");
    Reflect.deleteProperty(document, "execCommand");
  });

  it("downloads the single file, and each separate file on its own or all together", async () => {
    setDocument(interactivePage);
    const user = userEvent.setup();
    const save = vi.spyOn(download, "downloadTextFile").mockImplementation(() => undefined);
    renderDialog();
    const standalone = exportHtmlCss(interactivePage, { mode: "standalone", title: "My Site" });
    await codeText();
    await user.click(screen.getByRole("button", { name: /Download index\.html/ }));
    expect(save.mock.calls).toEqual([["index.html", standalone.files[0].content, "text/html; charset=utf-8"]]);
    expect(screen.getByTestId("export-transfer-status")).toHaveTextContent("Download of index.html started");

    save.mockClear();
    await user.click(screen.getByRole("radio", { name: /Separate files/ }));
    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(3));
    const separate = exportHtmlCss(interactivePage, { mode: "separate", title: "My Site" });
    await user.click(screen.getByRole("tab", { name: /styles\.css/ }));
    await user.click(screen.getByRole("button", { name: /Download styles\.css/ }));
    expect(save.mock.calls).toEqual([["styles.css", separate.files[1].content, "text/css; charset=utf-8"]]);
    save.mockClear();
    await user.click(screen.getByRole("button", { name: /Download all files/ }));
    expect(save.mock.calls.map((call) => [call[0], call[1]])).toEqual(separate.files.map((file) => [file.path, file.content]));
    expect(screen.getByTestId("export-transfer-status")).toHaveTextContent("allow multiple downloads");
  });

  it("closes from Cancel and Escape", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await codeText();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe("ExportCodeDialog — desktop saving", () => {
  function fakeDesktop(overrides: Partial<DesktopExportFiles> = {}) {
    const desktop: DesktopExportFiles = {
      chooseExportDestination: vi.fn(async () => ({ status: "chosen" as const, destination: { token: "t".repeat(32), label: "Site" } })),
      writeExportFiles: vi.fn<DesktopExportFiles["writeExportFiles"]>(async (_token, files) => ({ status: "saved" as const, label: "Site", fileNames: files.map((file) => file.path) })),
      ...overrides,
    };
    return desktop;
  }

  it("saves exactly the files on screen to the chosen destination", async () => {
    setDocument(interactivePage);
    const user = userEvent.setup();
    const desktop = fakeDesktop();
    renderDialog({ desktop });
    await codeText();
    await user.click(screen.getByRole("radio", { name: /Separate files/ }));
    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(3));
    await user.click(screen.getByRole("button", { name: "Save to Folder…" }));
    const separate = exportHtmlCss(interactivePage, { mode: "separate", title: "My Site" });
    expect(desktop.chooseExportDestination).toHaveBeenCalledWith("separate", "My Site");
    expect(desktop.writeExportFiles).toHaveBeenCalledWith("t".repeat(32), separate.files, false);
    expect(await screen.findByText("Saved index.html, styles.css and script.js to “Site”.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download/ })).toBeNull();
  });

  it("asks before replacing existing files and replaces them only on confirmation", async () => {
    const user = userEvent.setup();
    const writeExportFiles = vi
      .fn<DesktopExportFiles["writeExportFiles"]>()
      .mockResolvedValueOnce({ status: "conflict", label: "Site", existing: ["index.html"] })
      .mockResolvedValueOnce({ status: "saved", label: "Site", fileNames: ["index.html"] });
    const desktop = fakeDesktop({ writeExportFiles });
    renderDialog({ desktop });
    await codeText();
    await user.click(screen.getByRole("button", { name: "Save HTML File…" }));
    const prompt = await screen.findByRole("alertdialog");
    expect(prompt).toHaveTextContent("index.html already exists in “Site”. Replace it?");
    await user.click(within(prompt).getByRole("button", { name: "Replace" }));
    expect(writeExportFiles).toHaveBeenLastCalledWith("t".repeat(32), expect.any(Array), true);
    expect(await screen.findByText("Saved index.html to “Site”.")).toBeInTheDocument();
  });

  it("keeps existing files when the user declines, and reports cancel and failures honestly", async () => {
    const user = userEvent.setup();
    const desktop = fakeDesktop({
      chooseExportDestination: vi
        .fn<DesktopExportFiles["chooseExportDestination"]>()
        .mockResolvedValueOnce({ status: "cancelled" })
        .mockResolvedValueOnce({ status: "chosen", destination: { token: "t".repeat(32), label: "Site" } })
        .mockResolvedValueOnce({ status: "chosen", destination: { token: "u".repeat(32), label: "Site" } }),
      writeExportFiles: vi
        .fn<DesktopExportFiles["writeExportFiles"]>()
        .mockResolvedValueOnce({ status: "conflict", label: "Site", existing: ["index.html"] })
        .mockResolvedValueOnce({ status: "error", error: { code: "disk-full", message: "There isn't enough disk space to export to “Site”." } }),
    });
    renderDialog({ desktop });
    await codeText();
    await user.click(screen.getByRole("button", { name: "Save HTML File…" }));
    expect(await screen.findByText("Save cancelled. Nothing was saved.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save HTML File…" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Keep existing files" }));
    expect(await screen.findByText("Nothing was saved. The existing files were left unchanged.")).toBeInTheDocument();
    expect(desktop.writeExportFiles).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Save HTML File…" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("There isn't enough disk space");
  });

  it("refuses to save if the design changed while the folder dialog was open", async () => {
    const user = userEvent.setup();
    const desktop = fakeDesktop({
      chooseExportDestination: vi.fn(async () => {
        useEditorStore.setState({ document: { ...staticPage, children: [] } });
        return { status: "chosen" as const, destination: { token: "t".repeat(32), label: "Site" } };
      }),
    });
    renderDialog({ desktop });
    await codeText();
    await user.click(screen.getByRole("button", { name: "Save HTML File…" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The design changed while you were choosing where to save");
    expect(desktop.writeExportFiles).not.toHaveBeenCalled();
  });

  it("can't start a second save, switch output or close while one is running", async () => {
    let finish: (value: Awaited<ReturnType<DesktopExportFiles["writeExportFiles"]>>) => void = () => undefined;
    const user = userEvent.setup();
    const desktop = fakeDesktop({ writeExportFiles: vi.fn<DesktopExportFiles["writeExportFiles"]>(() => new Promise((resolve) => (finish = resolve))) });
    const { onClose } = renderDialog({ desktop });
    await codeText();
    await user.click(screen.getByRole("button", { name: "Save HTML File…" }));
    expect(await screen.findByText("Saving…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save HTML File…" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Separate files/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => finish({ status: "saved", label: "Site", fileNames: ["index.html"] }));
    expect(desktop.chooseExportDestination).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Saved index.html to “Site”.")).toBeInTheDocument();
  });
});
