"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import { findNodeById } from "@/features/editor/utils/findNodeById";
import { commitImageUpload } from "@/features/inspector/utils/commitImageUpload";
import { rememberUploadedImage } from "@/features/inspector/utils/uploadedImageDetails";
import { validateImageUpload, type DecodeImage, type ImageUploadFile } from "@/features/inspector/utils/validateImageUpload";

export type ImageUploadStatus = { status: "idle" } | { status: "reading" } | { status: "error"; message: string };

/**
 * One Image's upload lifecycle in the Inspector (BC-07.2).
 *
 * Every upload gets a ticket. A newer upload, a different Image in the
 * section, or the section unmounting (selection cleared, multi-selection,
 * Inspector closed, another project opened) invalidates it, and a result
 * that arrives on an invalid ticket is dropped silently: it never touches
 * the document. A result on a valid ticket is still committed only to the
 * Image and document session it started with (commitImageUpload). The
 * section shows one upload at a time; a second start while one is reading
 * is ignored.
 */
export function useImageUpload(nodeId: string, decode?: DecodeImage) {
  const [state, setState] = useState<ImageUploadStatus>({ status: "idle" });
  const ticketRef = useRef(0);
  /** The ticket currently reading, if it is still the live one — a ref, so two clicks in one frame can't both start. */
  const readingTicketRef = useRef<number | null>(null);

  const [lastNodeId, setLastNodeId] = useState(nodeId);
  if (nodeId !== lastNodeId) {
    setLastNodeId(nodeId);
    setState({ status: "idle" });
  }

  // Runs on unmount and whenever the section switches to another Image.
  useEffect(
    () => () => {
      ticketRef.current += 1;
    },
    [nodeId],
  );

  async function upload(file: ImageUploadFile): Promise<boolean> {
    if (readingTicketRef.current === ticketRef.current) return false;
    ticketRef.current += 1;
    const ticket = ticketRef.current;
    readingTicketRef.current = ticket;
    const started = useEditorStore.getState();
    const target = { nodeId, documentSessionId: started.documentSessionId, startSrc: findNodeById(started.document, nodeId)?.src };
    setState({ status: "reading" });

    const validation = await validateImageUpload(file, decode);
    if (ticket !== ticketRef.current) return false;
    readingTicketRef.current = null;
    if (!validation.ok) {
      setState({ status: "error", message: validation.message });
      return false;
    }
    const committed = commitImageUpload(target, validation.image.dataUrl);
    if (!committed.ok) {
      setState({ status: "error", message: committed.message });
      return false;
    }
    const { fileName, width, height, dataUrl } = validation.image;
    rememberUploadedImage(nodeId, dataUrl, { fileName, width, height });
    setState({ status: "idle" });
    return true;
  }

  function clearError() {
    if (state.status === "error") setState({ status: "idle" });
  }

  return { state, upload, clearError };
}
