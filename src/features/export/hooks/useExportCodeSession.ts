"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorElementNode } from "@/features/editor/types/document";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { DesktopExportFiles } from "@/features/export/desktop/desktopExportFiles";
import type { ExportEntitlement } from "@/features/export/types/exportEntitlement";
import type { ExportFile, HtmlCssExportMode, HtmlCssExportOptions, HtmlCssExportResult } from "@/features/export/types/exportResult";
import { copyTextToClipboard } from "@/features/export/utils/copyTextToClipboard";
import { exportHtmlCss } from "@/features/export/utils/exportHtmlCss";
import { joinFileNames } from "@/features/export/utils/joinFileNames";
import { downloadTextFile } from "@/lib/downloadTextFile";

/**
 * Everything the export dialog shows was generated from one snapshot: the
 * exact document object (the editor store replaces it on every edit, so
 * identity is its revision) and the title it was exported with.
 */
export interface ExportSnapshot {
  document: EditorElementNode;
  title: string;
  mode: HtmlCssExportMode;
  result: HtmlCssExportResult;
  /** How long exportHtmlCss took, for the large-document measurements. */
  generationMs: number;
}

export type ExportGenerationState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "denied"; message: string }
  | { status: "generating"; mode: HtmlCssExportMode }
  | { status: "ready"; snapshot: ExportSnapshot }
  | { status: "failed"; mode: HtmlCssExportMode; message: string };

export type ExportTransferState =
  | { status: "idle" }
  | { status: "busy"; message: string }
  /** Desktop only: files already exist in the chosen folder. */
  | { status: "conflict"; token: string; label: string; existing: string[] }
  | { status: "done"; message: string }
  | { status: "error"; message: string };

export type HtmlCssExporter = (document: EditorElementNode, options: HtmlCssExportOptions) => HtmlCssExportResult;

export interface UseExportCodeSessionOptions {
  open: boolean;
  /** The exported page's <title> (the project name). */
  title: string;
  entitlement: ExportEntitlement;
  desktop: DesktopExportFiles | null;
  /** The real engine by default; tests inject failures. */
  exporter?: HtmlCssExporter;
}

const GENERATION_FAILED =
  "Layoutry couldn't generate code for this design. Nothing was exported. Try Regenerate; if it keeps failing, save your project and report the problem.";
const STALE_BEFORE_SAVE = "The design changed while you were choosing where to save, so nothing was saved. Regenerate the code, then save again.";

/**
 * The export dialog's state machine (EXPORT-1.4), kept out of the
 * presentation components:
 * - opening checks the entitlement, then generates from the current
 *   document with the existing engine (exportHtmlCss — the same function
 *   the parity suites validate);
 * - an edit, undo or project switch while the dialog is open makes the
 *   preview stale: copy, download and save are refused until Regenerate;
 * - copy, download and save always use the files of the snapshot on
 *   screen, never a fresh or cached generation;
 * - nothing here touches the project's saved state or dirty flag.
 */
export function useExportCodeSession({ open, title, entitlement, desktop, exporter = exportHtmlCss }: UseExportCodeSessionOptions) {
  const [mode, setModeState] = useState<HtmlCssExportMode>("standalone");
  const [generation, setGeneration] = useState<ExportGenerationState>(() => (open ? { status: "checking" } : { status: "idle" }));
  const [transfer, setTransfer] = useState<ExportTransferState>({ status: "idle" });
  const [selectedPath, setSelectedPath] = useState("index.html");
  const currentDocument = useEditorStore((state) => (open ? state.document : null));
  const requestRef = useRef(0);
  const transferBusyRef = useRef(false);
  const titleRef = useRef(title);
  useEffect(() => {
    titleRef.current = title;
  });
  const [seenOpen, setSeenOpen] = useState(open);
  // Opening or closing resets the session during render (no stale frame
  // of the previous session's code); the effect below does the async part.
  if (open !== seenOpen) {
    setSeenOpen(open);
    setGeneration(open ? { status: "checking" } : { status: "idle" });
    setTransfer({ status: "idle" });
  }

  const generate = useCallback(
    (nextMode: HtmlCssExportMode) => {
      const request = ++requestRef.current;
      setGeneration({ status: "generating", mode: nextMode });
      setTransfer({ status: "idle" });
      // A macrotask, so "Generating…" can paint before a large document
      // blocks the page for the (synchronous) generation.
      window.setTimeout(() => {
        if (request !== requestRef.current) return;
        const document = useEditorStore.getState().document;
        const snapshotTitle = titleRef.current;
        const started = performance.now();
        let result: HtmlCssExportResult;
        try {
          result = exporter(document, { mode: nextMode, title: snapshotTitle });
        } catch {
          setGeneration({ status: "failed", mode: nextMode, message: GENERATION_FAILED });
          return;
        }
        const generationMs = performance.now() - started;
        setGeneration({ status: "ready", snapshot: { document, title: snapshotTitle, mode: nextMode, result, generationMs } });
        setSelectedPath((path) => (result.files.some((file) => file.path === path) ? path : "index.html"));
      }, 0);
    },
    [exporter],
  );

  // Opening: entitlement first, then generation. Closing cancels anything pending.
  useEffect(() => {
    const request = ++requestRef.current;
    if (!open) return;
    entitlement.canExportCode().then(
      (decision) => {
        if (request !== requestRef.current) return;
        if (decision.allowed) generate(mode);
        else setGeneration({ status: "denied", message: decision.message });
      },
      () => {
        if (request !== requestRef.current) return;
        setGeneration({ status: "denied", message: "Layoutry couldn't confirm that code export is available. Try again." });
      },
    );
    // Only on open/close: a mode change regenerates through setMode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entitlement]);

  const snapshot = generation.status === "ready" ? generation.snapshot : null;
  const stale = snapshot !== null && currentDocument !== null && (currentDocument !== snapshot.document || title !== snapshot.title);
  const files: readonly ExportFile[] = snapshot?.result.ok ? snapshot.result.files : [];
  const exportable = snapshot !== null && snapshot.result.ok && !stale;

  function setMode(nextMode: HtmlCssExportMode) {
    if (nextMode === mode || transferBusyRef.current) return;
    setModeState(nextMode);
    if (generation.status !== "denied" && generation.status !== "checking") generate(nextMode);
  }

  function regenerate() {
    if (transferBusyRef.current) return;
    generate(mode);
  }

  async function runTransfer(task: () => Promise<ExportTransferState>) {
    if (transferBusyRef.current) return;
    transferBusyRef.current = true;
    try {
      setTransfer(await task());
    } finally {
      transferBusyRef.current = false;
    }
  }

  function copySelected() {
    const file = files.find((candidate) => candidate.path === selectedPath);
    if (!exportable || !file) return;
    void runTransfer(async () => {
      setTransfer({ status: "busy", message: `Copying ${file.path}…` });
      return (await copyTextToClipboard(file.content))
        ? { status: "done", message: `Copied ${file.path} to the clipboard.` }
        : { status: "error", message: `Layoutry couldn't copy ${file.path}. Select the code in the preview and copy it with Ctrl+C.` };
    });
  }

  function downloadFiles(paths: readonly string[]) {
    const chosen = files.filter((file) => paths.includes(file.path));
    if (!exportable || chosen.length === 0 || transferBusyRef.current) return;
    try {
      for (const file of chosen) downloadTextFile(file.path, file.content, file.mediaType);
    } catch {
      setTransfer({ status: "error", message: "The browser refused the download. Nothing was downloaded." });
      return;
    }
    // The browser only accepted the request: it may still ask the user or block it.
    setTransfer({
      status: "done",
      message:
        chosen.length === 1
          ? `Download of ${chosen[0].path} started. Your browser decides where it is saved.`
          : `Downloads of ${joinFileNames(chosen.map((file) => file.path))} started. If your browser asks, allow multiple downloads, or download each file separately. Keep the files together in one folder.`,
    });
  }

  function writeToDesktop(token: string, overwrite: boolean, saving: ExportSnapshot): Promise<ExportTransferState> {
    if (!desktop) return Promise.resolve({ status: "idle" });
    const latest = useEditorStore.getState().document;
    if (latest !== saving.document || titleRef.current !== saving.title) return Promise.resolve({ status: "error", message: STALE_BEFORE_SAVE });
    setTransfer({ status: "busy", message: "Saving…" });
    return desktop.writeExportFiles(token, saving.result.files, overwrite).then((result): ExportTransferState => {
      if (result.status === "saved") return { status: "done", message: `Saved ${joinFileNames(result.fileNames)} to “${result.label}”.` };
      if (result.status === "conflict") return { status: "conflict", token, label: result.label, existing: result.existing };
      return { status: "error", message: result.error.message };
    });
  }

  function saveToDesktop() {
    if (!desktop || !exportable || !snapshot) return;
    const saving = snapshot;
    void runTransfer(async () => {
      setTransfer({ status: "busy", message: saving.mode === "standalone" ? "Choose where to save the HTML file…" : "Choose a folder for the files…" });
      const chosen = await desktop.chooseExportDestination(saving.mode, saving.mode === "standalone" ? "index.html" : saving.title);
      if (chosen.status === "cancelled") return { status: "done", message: "Save cancelled. Nothing was saved." };
      if (chosen.status === "error") return { status: "error", message: chosen.error.message };
      return writeToDesktop(chosen.destination.token, false, saving);
    });
  }

  function resolveConflict(choice: "overwrite" | "cancel") {
    if (transfer.status !== "conflict" || !snapshot) return;
    if (choice === "cancel") {
      setTransfer({ status: "done", message: "Nothing was saved. The existing files were left unchanged." });
      return;
    }
    const { token } = transfer;
    const saving = snapshot;
    void runTransfer(() => writeToDesktop(token, true, saving));
  }

  return {
    mode,
    setMode,
    generation,
    snapshot,
    stale,
    exportable,
    files,
    selectedPath,
    setSelectedPath,
    regenerate,
    transfer,
    busy: transfer.status === "busy",
    copySelected,
    downloadFiles,
    saveToDesktop,
    resolveConflict,
  };
}
