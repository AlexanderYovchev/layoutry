import type { ExportBehaviors } from "@/features/export/types/exportBehavior";

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
    (expanders[token] || []).forEach(function (trigger) {
      trigger.setAttribute("aria-expanded", shown ? "true" : "false");
    });
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

/** Whether a page needs the runtime at all: anything clickable, or a dialog that opens at load. */
export function needsInteractionRuntime(behaviors: ExportBehaviors): boolean {
  return behaviors.triggers.length > 0 || behaviors.targets.some((target) => target.kind === "dialog");
}
