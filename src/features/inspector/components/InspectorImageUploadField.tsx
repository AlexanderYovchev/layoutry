"use client";

import { useRef, type ChangeEvent } from "react";
import { Upload, X } from "lucide-react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { EditorElementNode } from "@/features/editor/types/document";
import { InspectorPropertyRow } from "@/features/inspector/components/InspectorPropertyRow";
import { useImageUpload } from "@/features/inspector/hooks/useImageUpload";
import { describeEmbeddedImage, formatImageByteSize } from "@/features/inspector/utils/describeEmbeddedImage";
import { getUploadedImageDetails } from "@/features/inspector/utils/uploadedImageDetails";
import { IMAGE_UPLOAD_ACCEPT, type DecodeImage } from "@/features/inspector/utils/validateImageUpload";
import { cn } from "@/lib/utils";

export const IMAGE_UPLOAD_COPY = {
  label: "Image file",
  upload: "Upload image…",
  replace: "Replace image…",
  reading: "Reading image…",
  remove: "Remove",
  removeLabel: "Remove uploaded image",
  hint: "PNG, JPEG, GIF or WebP, up to 5 MB and 8192 pixels on each side.",
  uploaded: "Image uploaded.",
} as const;

const BUTTON_CLASS_NAME =
  "flex h-7 min-w-0 items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 transition-colors duration-150 hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 aria-disabled:cursor-progress aria-disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800";

interface InspectorImageUploadFieldProps {
  node: EditorElementNode;
  /** Tests inject a decoder; the browser's own is used otherwise. */
  decode?: DecodeImage;
}

/**
 * Upload / Replace / Remove for an Image's embedded file (BC-07.2).
 *
 * The button opens the system file picker through a hidden file input, the
 * same pattern Import Project uses, in the browser and in the desktop app
 * alike: the bytes arrive as a File, so no path ever reaches the renderer
 * and no new desktop IPC exists. Validation and the commit live in
 * useImageUpload; this component only presents them.
 *
 * The button is never `disabled` while reading (aria-disabled instead), so
 * keyboard focus stays on it through the whole upload, and it is the same
 * element before and after ("Upload image…" becomes "Replace image…").
 * Errors use the row's role="alert" message; progress and success are
 * announced politely.
 */
export function InspectorImageUploadField({ node, decode }: InspectorImageUploadFieldProps) {
  const setElementSrc = useEditorStore((state) => state.setElementSrc);
  const { state, upload, clearError } = useImageUpload(node.id, decode);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hintId = `image-upload-hint-${node.id}`;

  const embedded = describeEmbeddedImage(node.src);
  const details = embedded ? getUploadedImageDetails(node.id, node.src) : undefined;
  const reading = state.status === "reading";

  function openPicker() {
    if (reading) return;
    inputRef.current?.click();
  }

  function handleFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so choosing the same file again still fires a change.
    event.target.value = "";
    if (!file) return;
    void upload(file);
  }

  function handleRemove() {
    clearError();
    setElementSrc(node.id, undefined);
    buttonRef.current?.focus();
  }

  const summary = embedded
    ? [embedded.label, details ? `${details.width} × ${details.height}` : undefined, formatImageByteSize(embedded.byteLength)].filter(Boolean).join(" · ")
    : undefined;

  return (
    <InspectorPropertyRow
      label={IMAGE_UPLOAD_COPY.label}
      variant="stack"
      state={embedded ? "set" : "unset"}
      error={state.status === "error" ? state.message : undefined}
    >
      {embedded && (
        <div className="flex min-w-0 items-center gap-2 rounded-md border border-zinc-200 p-1 dark:border-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element -- a thumbnail of the document's own embedded data URL, not an app asset. */}
          <img src={node.src} alt="" aria-hidden="true" className="size-8 shrink-0 rounded bg-zinc-100 object-contain dark:bg-zinc-800" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-fg-primary" title={details?.fileName}>
              {details?.fileName ?? `Uploaded ${embedded.label} image`}
            </p>
            <p className="truncate text-[11px] text-fg-secondary">{summary}</p>
          </div>
        </div>
      )}
      <div className="flex min-w-0 gap-1.5">
        <button
          ref={buttonRef}
          type="button"
          onClick={openPicker}
          aria-disabled={reading ? true : undefined}
          aria-busy={reading ? true : undefined}
          aria-describedby={hintId}
          className={cn(BUTTON_CLASS_NAME, "flex-1")}
        >
          <Upload aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="truncate">{reading ? IMAGE_UPLOAD_COPY.reading : embedded ? IMAGE_UPLOAD_COPY.replace : IMAGE_UPLOAD_COPY.upload}</span>
        </button>
        {embedded && (
          <button type="button" onClick={handleRemove} aria-label={IMAGE_UPLOAD_COPY.removeLabel} title={IMAGE_UPLOAD_COPY.removeLabel} className={cn(BUTTON_CLASS_NAME, "shrink-0 hover:text-red-600 dark:hover:text-red-400")}>
            <X aria-hidden="true" className="size-3.5" />
            {IMAGE_UPLOAD_COPY.remove}
          </button>
        )}
      </div>
      <p id={hintId} className="text-[11px] text-fg-secondary">
        {IMAGE_UPLOAD_COPY.hint}
      </p>
      <p role="status" className="sr-only">
        {reading ? IMAGE_UPLOAD_COPY.reading : ""}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_UPLOAD_ACCEPT}
        onChange={handleFileChosen}
        tabIndex={-1}
        aria-hidden="true"
        aria-label="Upload image file"
        data-testid="image-upload-input"
        className="hidden"
      />
    </InspectorPropertyRow>
  );
}
