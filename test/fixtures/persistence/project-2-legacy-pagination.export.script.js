(function () {
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
  // Shown = not inside a hidden target or closed dialog, rendered at all
  // (no display: none on it or an ancestor), and not visibility: hidden /
  // collapse (computed, so an ancestor's authored Visibility counts, and a
  // descendant's own "visible" overrides it) — Preview's rule
  // (isNodeAuthoredHidden), BC-08.5.
  function isShown(element) {
    if (isHidden(element) || element.getClientRects().length === 0) return false;
    var visibility = window.getComputedStyle(element).visibility;
    return visibility !== "hidden" && visibility !== "collapse";
  }
  function wantedSrc(frame) {
    var authored = frame.getAttribute("data-ly-video-src");
    return !reducedMotion && authored ? authored : frame.getAttribute("src");
  }
  function freshPlayer(player) {
    var frame = player.original.cloneNode(false);
    var src = wantedSrc(player.original);
    if (src !== null) frame.setAttribute("src", src);
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
  each("iframe", function (frame) {
    if (!frame.parentNode) return;
    var player = { original: frame.cloneNode(false), slot: frame.parentNode, frame: frame };
    if (!isShown(player.slot) || frame.getAttribute("src") !== wantedSrc(frame)) {
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
