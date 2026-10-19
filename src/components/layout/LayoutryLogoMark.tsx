// Gradient ids are fixed rather than useId-generated: the mark is
// rendered exactly once (the AppHeader wordmark).
const GRADIENT_A_ID = "layoutry-mark-gradient-a";
const GRADIENT_B_ID = "layoutry-mark-gradient-b";

/**
 * Layoutry's logo mark — two crossed, rounded bars in the blue→violet
 * accent gradient. Purely decorative: the adjacent "Layoutry" wordmark
 * text is the accessible name. Colors come from the --ly- accent tokens,
 * so the mark follows the theme like the rest of the chrome.
 */
export function LayoutryLogoMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className={className}
    >
      <defs>
        <linearGradient id={GRADIENT_A_ID} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--ly-accent-primary)" }} />
          <stop
            offset="100%"
            style={{ stopColor: "var(--ly-accent-violet)" }}
          />
        </linearGradient>
        <linearGradient id={GRADIENT_B_ID} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--ly-accent-violet)" }} />
          <stop
            offset="100%"
            style={{ stopColor: "var(--ly-accent-primary)" }}
          />
        </linearGradient>
      </defs>
      <rect
        x="9"
        y="1.5"
        width="6"
        height="21"
        rx="3"
        transform="rotate(45 12 12)"
        fill={`url(#${GRADIENT_A_ID})`}
      />
      <rect
        x="9"
        y="1.5"
        width="6"
        height="21"
        rx="3"
        transform="rotate(-45 12 12)"
        fill={`url(#${GRADIENT_B_ID})`}
        opacity="0.88"
      />
    </svg>
  );
}
