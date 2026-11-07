"use client";

import { useEffect, useLayoutEffect, useRef, type FocusEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ResourceScrollRegionProps {
  /** True while the Resource panel is collapsed: its content is then display:none. */
  hidden: boolean;
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * The scroll container of a Resource panel list (BC-03.2), which keeps
 * its position across a panel collapse.
 *
 * Collapsing hides the panel content with display:none (so it leaves the
 * tab order and the accessibility tree), and browsers handle the scroll
 * offset of a box that isn't rendered differently: Firefox keeps it,
 * WebKit resets it, Chromium keeps part of it. So the last position seen
 * while the region was visible is remembered, and put back as soon as the
 * region is shown again, before paint.
 *
 * The position is kept in a ref, written by a passive scroll listener:
 * no React state, so scrolling never re-renders anything. It is scoped
 * to this region instance. A new section is a new region (the callers
 * key it by section), so switching sections starts at the top, as
 * before.
 *
 * Keyboard focus is always scrolled fully into view, the same way in
 * every browser. Chromium and WebKit do this natively. Firefox scrolls a
 * newly focused element only when it is entirely out of view, so a tile
 * half-hidden at the list's edge stayed half-hidden. Only keyboard focus
 * (:focus-visible) is handled: a pointer press must never scroll the list
 * under the pointer, or it would move a tile while a drag starts.
 *
 * Scroll anchoring is off (overflow-anchor: none). Expanding animates
 * the panel's width, so the position is restored while the list is still
 * narrow and its tiles are taller. With anchoring, the browser then moves
 * the offset as the list widens, to keep that narrow layout's top tile in
 * place, and ends on a different tile (measured: 900 → 532 px in
 * Chromium). Without it, the offset stays put, and once the width is
 * back, the same item is at the top. Nothing in these lists changes
 * above the visible part while the user is scrolled, so anchoring has
 * nothing else to do here.
 */
export function ResourceScrollRegion({ hidden, id, className, children }: ResourceScrollRegionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const position = useRef(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const remember = () => {
      // A box that isn't rendered has no height and reports a meaningless offset.
      if (element.clientHeight > 0) position.current = element.scrollTop;
    };
    element.addEventListener("scroll", remember, { passive: true });
    return () => element.removeEventListener("scroll", remember);
  }, []);

  useLayoutEffect(() => {
    const element = ref.current;
    if (hidden || !element) return;
    if (element.scrollTop !== position.current) element.scrollTop = position.current;
  }, [hidden]);

  function revealKeyboardFocus(event: FocusEvent<HTMLDivElement>) {
    const target = event.target;
    if (target instanceof HTMLElement && target !== event.currentTarget && target.matches(":focus-visible")) {
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  return (
    // data-no-drag-autoscroll: dragging a tile out of this list must not scroll it (EditorApp's AUTO_SCROLL_OPTIONS).
    <div ref={ref} id={id} onFocus={revealKeyboardFocus} data-no-drag-autoscroll="" className={cn("[overflow-anchor:none]", className)}>
      {children}
    </div>
  );
}
