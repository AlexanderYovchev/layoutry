/**
 * Shared "you can drop here" treatment for every container-capable
 * element (Body, Container, the document root) — outline + glow tint,
 * reused so drop-indicator styling never drifts between container
 * types. Deliberately just an outline/background change: never affects
 * layout, so a hovered container never shifts its own children.
 */
export const DROP_TARGET_ACTIVE_CLASSES =
  "outline-2 outline-dashed outline-blue-400 -outline-offset-2 bg-blue-50/60 dark:bg-blue-950/30";
