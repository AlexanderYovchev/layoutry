import { create } from "zustand";

interface ExportDialogState {
  open: boolean;
  openDialog: () => void;
  closeDialog: () => void;
}

/**
 * Whether File › Export Code… is open (EXPORT-1.4). Kept here rather than
 * in the composing component's state so opening and closing re-render only
 * the dialog: re-rendering the editor root also re-renders every Canvas
 * node through the drag-and-drop context. On a 20,000-element page that
 * delayed the first "Generating…" frame from ~155 ms to ~240 ms.
 */
export const useExportDialogStore = create<ExportDialogState>((set) => ({
  open: false,
  openDialog: () => set({ open: true }),
  closeDialog: () => set({ open: false }),
}));
