/**
 * The section's guidance copy (BC-04.2, approved in BC-04.1 section 10).
 * Kept out of the component so unit and browser tests assert the exact
 * wording instead of repeating it.
 */
export const INTERACTION_COPY = {
  description:
    "Clicking this element can show, hide or toggle another element. Set it up here, then try it in Preview; your exported page works the same.",
  initialStateHelp:
    "Whether this element is visible when the page first loads, in Preview and on your exported page. In Design it always stays visible so you can edit it.",
  initialHiddenNote:
    "Starts hidden in Preview and on your exported page. It stays visible here so you can edit it. An interaction on another element can show it.",
  actionHelp:
    "Show makes the target visible. Hide hides it. Toggle switches between the two each time this element is clicked.",
  targetHelp:
    "The element that is shown or hidden when this element is clicked. It can be another element or this one.",
  keyboardNote:
    "Keyboard users can't click this element. Use a Button or Link for interactions everyone can use.",
  targetPlaceholder: "Select an element…",
  targetRequired:
    "Choose a target to finish this interaction. Until then it does nothing.",
  missingTargetOption: "Missing target",
  missingTarget: "The target was deleted. Choose another element.",
} as const;
