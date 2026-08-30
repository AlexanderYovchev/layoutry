/**
 * Layoutry's Input primitive (Checkpoint 1.10) is a single, real
 * `tag: "input"` node — never a separate tag per variant (`emailInput`,
 * `checkbox`, ...). The native HTML `type` attribute comes from this
 * dedicated `inputType` field instead, the same "one field per distinct
 * semantic concern" shape `href`/`src` already established (see
 * types/link.ts's own top comment) — not the node's `tag`, which stays a
 * genuine `input` regardless of variant (mirroring how Heading Level,
 * Checkpoint 1.7, keeps `tag` as the sole source of truth for h1–h6
 * rather than a parallel field).
 *
 * A real union, not a bare string, so later checkpoints (checkbox,
 * radio, date, time, file, range, color, ...) extend INPUT_TYPES
 * without changing this field's shape or any code that already reads
 * it. Checkpoint 1.10 exposed only "text"; Checkpoint 1.11 widens this
 * to the full text-like family (email/password/number/search/url/tel)
 * — every one of them shares the same node representation, renderer,
 * and native editing hook, differing only in this field's value.
 */
export const INPUT_TYPES = ["text", "email", "password", "number", "search", "url", "tel"] as const;

export type InputType = (typeof INPUT_TYPES)[number];

export function isInputType(value: string): value is InputType {
  return (INPUT_TYPES as readonly string[]).includes(value);
}

/** node.inputType if explicitly set, else "text" — the single place both the Canvas renderer and any future Inspector Type control read a node's effective input type from, so the two can never disagree (mirrors getLinkHref). */
export function getInputType(node: { inputType?: InputType }): InputType {
  return node.inputType ?? "text";
}
