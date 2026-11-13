import type { ExportBehaviors } from "@/features/export/types/exportBehavior";
import type { ExportElement } from "@/features/export/types/exportIr";

/*
 * The exported page's interaction runtime (EXPORT-1.3): a constant,
 * dependency-free script that replays Preview's interaction model on
 * plain DOM. It is never built from document data — it only reads the
 * generated attributes below, whose values are integer tokens and action
 * keywords the HTML printer writes from validated behavior descriptors —
 * so no authored text, id or URL can ever become executable code.
 *
 * Contract between the HTML printer and the runtime:
 * - data-ly-target="<token>"        an element whose visibility can change
 * - data-ly-on-click="<action>:<token> …"  its click runs these actions in order
 * - data-ly-dismiss="<token> …"     shown targets an outside click or Escape hides
 * - data-ly-expands="<token>"       aria-expanded mirrors this target
 * - data-ly-node                    a node nested inside a trigger (click boundary)
 *
 * Behavior, mirroring the editor (useEditorStore.executeInteractionsForNode,
 * editor/utils/dismissibleTargets.ts, CanvasInteractionBoundary,
 * DialogElement):
 * - A click first hides every shown dismissible target the click landed
 *   outside of (outside both its trigger and the target), then runs the
 *   actions of the nearest node only — a click on a node nested inside a
 *   trigger does not run the trigger's actions.
 * - show/hide set visibility; toggle flips it; actions apply in order.
 * - A <dialog> target opens with showModal() and closes with close();
 *   clicking its backdrop closes it, native Escape closes it, and its
 *   Escape never reaches the page (so it doesn't also dismiss a dropdown).
 * - Escape hides the first shown dismissible target in document order and,
 *   if focus was inside it, returns focus to its trigger.
 * - A dialog open at load is re-opened modally, as Preview does.
 * - Media (BC-02.5, B5): hiding a target pauses every <video>/<audio> in
 *   it (their position is kept), and media inside hidden content can't
 *   start at all, whether by autoplay at load or by a script. Showing a
 *   target starts only media that is muted autoplay, which is what
 *   Preview's re-mounted content does (the export writes autoplay only
 *   for muted media, BC-02.2.1). Anything else stays paused until the
 *   user plays it. Preview gets the same result by unmounting hidden
 *   content.
 * - Video Embed players (BC-08.3): iframe[data-ly-video-src]. A provider
 *   player cannot be paused from outside, so it is REMOVED whenever it is
 *   not shown — hidden by an interaction on it or an ancestor, inside a
 *   closed dialog, or not rendered at all (authored display: none) — and
 *   a fresh one is created from the original element when it is shown
 *   again, starting from its configured state (Preview does the same by
 *   unmounting). The markup's src has no autoplay; a shown player is
 *   loaded from data-ly-video-src (authored muted autoplay included)
 *   unless the viewer prefers reduced motion, in which case the
 *   no-autoplay src is kept. Removing an iframe ends its document, so no
 *   sound continues. New frames are new elements, never navigations of an
 *   existing one, so no history entries are added.
 * One delegated listener per event type; no per-element click handlers.
 */
export const EXPORT_INTERACTION_RUNTIME = `(function () {
  "use strict";
  var targets = {};
  var visible = {};
  var expanders = {};
  var triggers = [];

  function each(selector, callback) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), callback);
  }
  function tokens(element, name) {
    var value = element.getAttribute(name) || "";
    return value.split(" ").filter(function (token) { return /^[0-9]+$/.test(token); });
  }
  function isDialog(element) {
    return element.tagName === "DIALOG";
  }

  function isHidden(element) {
    return Boolean(element.closest("[hidden], dialog:not([open])"));
  }
  var reducedMotion = Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var players = [];
  function isShown(element) {
    return !isHidden(element) && element.getClientRects().length > 0;
  }
  function freshPlayer(player) {
    var frame = player.original.cloneNode(false);
    if (!reducedMotion) frame.setAttribute("src", player.original.getAttribute("data-ly-video-src") || "");
    return frame;
  }
  function syncPlayers() {
    players.forEach(function (player) {
      var shown = isShown(player.slot);
      if (!shown && player.frame) {
        player.frame.remove();
        player.frame = null;
      } else if (shown && !player.frame) {
        player.frame = freshPlayer(player);
        player.slot.appendChild(player.frame);
      }
    });
  }

  function mediaIn(element) {
    var media = Array.prototype.slice.call(element.querySelectorAll("video, audio"));
    if (element.matches("video, audio")) media.unshift(element);
    return media;
  }

  function setVisible(token, shown) {
    var element = targets[token];
    if (!element || visible[token] === shown) return;
    visible[token] = shown;
    if (isDialog(element)) {
      if (shown && !element.open) element.showModal();
      if (!shown && element.open) element.close();
    } else {
      element.hidden = !shown;
    }
    mediaIn(element).forEach(function (media) {
      if (!shown) media.pause();
      else if (media.autoplay && media.muted && !isHidden(media)) {
        var playing = media.play();
        if (playing && playing.catch) playing.catch(function () {});
      }
    });
    (expanders[token] || []).forEach(function (trigger) {
      trigger.setAttribute("aria-expanded", shown ? "true" : "false");
    });
    syncPlayers();
  }

  function openRelationships() {
    var open = [];
    triggers.forEach(function (trigger) {
      tokens(trigger, "data-ly-dismiss").forEach(function (token) {
        if (visible[token] === true) open.push({ trigger: trigger, token: token });
      });
    });
    return open;
  }

  each("[data-ly-target]", function (element) {
    var token = tokens(element, "data-ly-target")[0];
    if (!token) return;
    targets[token] = element;
    visible[token] = isDialog(element) ? element.hasAttribute("open") : !element.hidden;
    if (!isDialog(element)) return;
    element.addEventListener("click", function (event) {
      if (event.target === element && element.open) element.close();
    });
    element.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && element.open) event.stopPropagation();
    });
    element.addEventListener("close", function () {
      if (!element.open) setVisible(token, false);
    });
  });
  each("[data-ly-on-click]", function (trigger) {
    triggers.push(trigger);
    var token = tokens(trigger, "data-ly-expands")[0];
    if (token) (expanders[token] = expanders[token] || []).push(trigger);
  });
  Object.keys(targets).forEach(function (token) {
    var element = targets[token];
    if (isDialog(element) && visible[token]) {
      element.removeAttribute("open");
      element.showModal();
    }
  });
  // A hidden player is removed at once. A shown one is kept when its
  // markup already loads the right URL (no autoplay requested, or reduced
  // motion); otherwise it is replaced by a fresh frame with autoplay.
  each("iframe[data-ly-video-src]", function (frame) {
    if (!frame.parentNode) return;
    var player = { original: frame.cloneNode(false), slot: frame.parentNode, frame: frame };
    var wanted = reducedMotion ? frame.getAttribute("src") : frame.getAttribute("data-ly-video-src");
    if (!isShown(player.slot) || frame.getAttribute("src") !== wanted) {
      frame.remove();
      player.frame = null;
    }
    players.push(player);
  });
  syncPlayers();

  window.addEventListener("click", function (event) {
    var target = event.target;
    if (!(target instanceof Element)) return;
    openRelationships().forEach(function (relationship) {
      if (!relationship.trigger.contains(target) && !targets[relationship.token].contains(target)) setVisible(relationship.token, false);
    });
    var nearest = target.closest("[data-ly-on-click], [data-ly-node]");
    if (!nearest || !nearest.hasAttribute("data-ly-on-click")) return;
    (nearest.getAttribute("data-ly-on-click") || "").split(" ").forEach(function (entry) {
      var parts = entry.split(":");
      var action = parts[0];
      var token = parts[1];
      if (!targets[token]) return;
      if (action === "show") setVisible(token, true);
      else if (action === "hide") setVisible(token, false);
      else if (action === "toggle") setVisible(token, !visible[token]);
    });
  });

  // Hidden media never plays: not by autoplay while its target is hidden
  // at load, and not by a script while it stays hidden. Media events do
  // not bubble, so this listens in the capture phase.
  document.addEventListener("play", function (event) {
    var media = event.target;
    if (media instanceof HTMLMediaElement && isHidden(media)) media.pause();
  }, true);

  window.addEventListener("keydown", function (event) {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    var first = openRelationships()[0];
    if (!first) return;
    var focused = document.activeElement;
    var hadFocus = Boolean(focused && targets[first.token].contains(focused));
    setVisible(first.token, false);
    if (hadFocus) first.trigger.focus();
  });
})();
`;

/** Whether the exported tree contains a Video Embed player (BC-08.3). */
export function hasVideoEmbedPlayers(element: ExportElement): boolean {
  if (element.attributes.some((attribute) => attribute.name === "data-ly-video-src")) return true;
  return element.children.some((child) => child.kind === "element" && hasVideoEmbedPlayers(child));
}

/** Whether a page needs the runtime at all: anything clickable, a dialog that opens at load, or a Video Embed player. */
export function needsInteractionRuntime(behaviors: ExportBehaviors, root?: ExportElement): boolean {
  return behaviors.triggers.length > 0 || behaviors.targets.some((target) => target.kind === "dialog") || (root !== undefined && hasVideoEmbedPlayers(root));
}
