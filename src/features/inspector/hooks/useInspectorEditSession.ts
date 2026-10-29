"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type RefObject } from "react";
import { useEditorStore } from "@/features/editor/stores/useEditorStore";
import type { HistoryEntry } from "@/features/editor/types/history";
// The pure matcher only (not the project feature's index, which would pull
// ProjectWorkspace -> EditorApp -> Inspector into a cycle).
import { matchProjectShortcut } from "@/features/project/hooks/useProjectKeyboardShortcuts";

/** A parse result — wrapped so a legitimately-null value (a "Mixed" slider) is never confused with "not parseable". */
export interface ParsedDraft<T> {
  value: T;
}

interface InspectorEditSessionOptions<T> {
  /** The field's own input element — clicks inside it never end the session. */
  inputRef: RefObject<HTMLInputElement | null>;
  /** The committed value currently in the document (or the control's displayed default when unset). */
  value: T;
  format: (value: T) => string;
  /** A draft the document may hold RIGHT NOW while typing (a complete, in-range number; a valid color) — or null to keep the last preview. */
  parseLive: (draft: string) => ParsedDraft<T> | null;
  /** The draft as it should be committed when the session ends (the control's existing clamp/"auto" semantics), or null if it can't be. */
  parseFinal: (draft: string) => ParsedDraft<T> | null;
  /** The caller's ordinary one-shot commit. A call that leaves the document reference unchanged counts as rejected (the caller's own validation said no). */
  onCommit: (value: T) => void;
  /** Called when the user cancels the session (Escape), so the caller can clear a transient validation message. */
  onEditCancel?: () => void;
  /** Off: the pre-BC-01.3 behavior — nothing is written until Enter/blur. */
  live: boolean;
}

interface EditSession<T> {
  active: boolean;
  /** The transaction this session opened for its live writes, if any. */
  snapshot: HistoryEntry | null;
  /** No live writes for this session: live mode is off, or another gesture already owns the transaction. */
  deferred: boolean;
  /** The last value passed to onCommit by this session, and whether the caller accepted it (the document changed). */
  lastAttempt: { value: T; accepted: boolean } | null;
}

const FORCE_RESYNC: unique symbol = Symbol("force-resync");

/**
 * One Inspector text field's editing session — the shared engine behind
 * the numeric controls (BC-01.3: InspectorNumericValueControl,
 * InspectorNumberFieldRow, InspectorSliderField's exact-value box) and the
 * color text field (BC-01.4: InspectorColorFieldShell).
 *
 * A session starts with the first real edit (typing or an Arrow step;
 * focus alone never starts one). While live, every draft that parseLive
 * accepts is written straight away through the caller's normal onCommit,
 * inside `beginTransaction({ mergeHistory: true })`, so the Canvas, Preview
 * and Export all read the one canonical document while the whole session
 * records a single undo entry. Incomplete or invalid drafts ("", "-",
 * "1.", out of range, "#ff00z") are never written; the Canvas keeps the
 * last valid preview and the field keeps exactly what the user typed — the
 * draft is never resynced from the document mid-session, so the caret
 * never jumps.
 *
 * The session ends exactly once, whichever comes first:
 *   Enter / blur / pointerdown anywhere outside the input (capture phase,
 *   so it runs BEFORE a Canvas resize/drag opens its own transaction) /
 *   a project shortcut such as Ctrl+S (also capture phase, before the
 *   project command checks for an open transaction) / a selection change
 *   in the store (programmatic ones too) / unmount
 *     -> commit: the final draft (parseFinal) is written if it differs
 *        from the last live attempt, then the transaction commits. A final
 *        draft that is invalid, or that the caller rejects, reverts the
 *        whole session instead of keeping an intermediate preview, and the
 *        field shows its pre-edit value again; the caller's message stays,
 *        explaining why. (With live off, a rejected final commit keeps
 *        the draft and the message, as before BC-01.3.)
 *   Escape
 *     -> cancel: the pre-session document is restored and the
 *        transaction cancelled, so an unset property stays unset.
 * A session whose net effect is nothing records nothing (see
 * commitTransaction). The draft resyncs from the document once the
 * session ends.
 *
 * Carries forward the Checkpoint 5.5 / BC-01.2 guard: Enter and Escape
 * release focus with .blur(), and the one real blur that dispatches is
 * suppressed — it would otherwise run a second end-of-session.
 */
export function useInspectorEditSession<T>(options: InspectorEditSessionOptions<T>) {
  const { value, format, inputRef } = options;
  const [draft, setDraft] = useState(() => format(value));
  const [badInput, setBadInput] = useState(false);
  const [editing, setEditing] = useState(false);

  // External value changes (Undo/Redo, another control, a new selection)
  // resync the draft — but never mid-session, where the change is this
  // session's own live write (possibly clamped/rounded by the caller).
  // FORCE_RESYNC makes the render after a session ends resync once.
  const [lastSyncedValue, setLastSyncedValue] = useState<T | typeof FORCE_RESYNC>(value);
  if (lastSyncedValue === FORCE_RESYNC || !Object.is(value, lastSyncedValue)) {
    setLastSyncedValue(value);
    if (!editing) {
      setDraft(format(value));
      setBadInput(false);
    }
  }

  const latestRef = useRef({ ...options, draft, badInput });
  useLayoutEffect(() => {
    latestRef.current = { ...options, draft, badInput };
  });

  const sessionRef = useRef<EditSession<T> | null>(null);
  const suppressNextBlurRef = useRef(false);

  const endSession = useCallback((mode: "commit" | "cancel") => {
    const session = sessionRef.current;
    if (!session?.active) return;
    session.active = false;
    const latest = latestRef.current;
    const ownedSnapshot =
      session.snapshot !== null && useEditorStore.getState().transactionSnapshot === session.snapshot ? session.snapshot : null;

    function revert() {
      if (ownedSnapshot) {
        useEditorStore.setState({ document: ownedSnapshot.document });
        useEditorStore.getState().cancelTransaction();
      }
    }

    // Escape clears the caller's transient message; a rejected final draft
    // keeps it, since it explains why the field just reverted.
    if (mode === "cancel") latest.onEditCancel?.();
    const final = mode === "commit" && !latest.badInput ? latest.parseFinal(latest.draft) : null;
    if (!final) {
      revert();
    } else {
      const attempt = session.lastAttempt;
      let accepted: boolean;
      // The caller's validation is deterministic: a value just attempted
      // live is never re-submitted.
      if (attempt && Object.is(attempt.value, final.value)) {
        accepted = attempt.accepted;
      } else {
        const before = useEditorStore.getState().document;
        latest.onCommit(final.value);
        accepted = useEditorStore.getState().document !== before;
      }
      if (accepted) {
        if (ownedSnapshot) useEditorStore.getState().commitTransaction();
      } else if (session.deferred) {
        setEditing(false);
        return;
      } else {
        revert();
      }
    }

    setEditing(false);
    setBadInput(false);
    setLastSyncedValue(FORCE_RESYNC);
  }, []);

  function ensureSession(): EditSession<T> {
    const current = sessionRef.current;
    if (current?.active) return current;
    const next: EditSession<T> = { active: true, snapshot: null, deferred: !latestRef.current.live, lastAttempt: null };
    sessionRef.current = next;
    return next;
  }

  /** Writes one live preview value. Returns false when this session can't write live (deferred). */
  function writeLive(session: EditSession<T>, next: T): boolean {
    if (session.deferred) return false;
    if (session.lastAttempt && Object.is(session.lastAttempt.value, next)) return true;
    const state = useEditorStore.getState();
    if (session.snapshot === null) {
      // Never join or end another gesture's transaction.
      if (state.transactionSnapshot !== null) {
        session.deferred = true;
        return false;
      }
      state.beginTransaction({ mergeHistory: true });
      session.snapshot = useEditorStore.getState().transactionSnapshot;
    } else if (state.transactionSnapshot !== session.snapshot) {
      session.deferred = true;
      return false;
    }
    const before = useEditorStore.getState().document;
    latestRef.current.onCommit(next);
    session.lastAttempt = { value: next, accepted: useEditorStore.getState().document !== before };
    return true;
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextDraft = event.target.value;
    // A type="number" input reports "" for a partial entry such as "-" or
    // "1."; badInput tells that apart from a genuinely cleared field.
    const nextBadInput = event.target.validity?.badInput === true;
    setDraft(nextDraft);
    setBadInput(nextBadInput);
    setEditing(true);
    const session = ensureSession();
    const parsed = nextBadInput ? null : latestRef.current.parseLive(nextDraft);
    if (parsed) writeLive(session, parsed.value);
  }

  /** An Arrow Up/Down step: part of the live session, or (not live) its own one-shot commit as before. */
  function stepTo(next: T) {
    setDraft(latestRef.current.format(next));
    setBadInput(false);
    const session = ensureSession();
    if (writeLive(session, next)) {
      setEditing(true);
      return;
    }
    session.active = false;
    setEditing(false);
    latestRef.current.onCommit(next);
  }

  function releaseFocus(input: HTMLInputElement) {
    // Only arm the suppression when .blur() will really dispatch a blur.
    if (document.activeElement === input) suppressNextBlurRef.current = true;
    input.blur();
  }

  function commitAndRelease(input: HTMLInputElement) {
    endSession("commit");
    releaseFocus(input);
  }

  function cancelAndRelease(input: HTMLInputElement) {
    endSession("cancel");
    releaseFocus(input);
  }

  function handleBlur() {
    if (suppressNextBlurRef.current) {
      suppressNextBlurRef.current = false;
      return;
    }
    endSession("commit");
  }

  useEffect(() => {
    if (!editing) return;
    function handlePointerDown(event: PointerEvent) {
      const input = inputRef.current;
      if (input && event.target instanceof Node && input.contains(event.target)) return;
      endSession("commit");
    }
    // Project commands refuse to run while any transaction is open
    // ("Finish the current edit first"), so Ctrl/Cmd+S, Shift+S, O and N
    // first commit this edit — capture phase, ahead of the project
    // shortcut listener — and then save/open/create the committed state.
    function handleKeyDown(event: KeyboardEvent) {
      if (matchProjectShortcut(event)) endSession("commit");
    }
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown, true);
    const unsubscribe = useEditorStore.subscribe((state, previous) => {
      if (state.selection !== previous.selection) endSession("commit");
    });
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
      unsubscribe();
    };
  }, [editing, endSession, inputRef]);

  useEffect(() => () => endSession("commit"), [endSession]);

  return { draft, handleChange, handleBlur, commitAndRelease, cancelAndRelease, stepTo };
}
