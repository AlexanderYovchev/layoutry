// Gradient ids are fixed rather than useId-generated: the mark is
// rendered exactly once (the AppHeader wordmark).
const BACKGROUND_ID = "layoutry-mark-background";
const HERO_ID = "layoutry-mark-hero";
const BRUSH_TIP_ID = "layoutry-mark-brush-tip";

/**
 * Layoutry's logo mark — the simplified small-size variant of the approved
 * app icon (design/branding/layoutry-icon-small-24.svg, BRAND-1.1): a
 * webpage canvas, a paintbrush and a code window on the blue tile. Keep
 * the two in sync. The colors are the brand's own, not --ly- theme tokens:
 * like the app icon, the mark looks the same in light and dark themes.
 * Purely decorative: the adjacent "Layoutry" wordmark text is the
 * accessible name.
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
        <linearGradient id={BACKGROUND_ID} x1="0.85" y1="0" x2="0.15" y2="1">
          <stop offset="0" stopColor="#0b94fd" />
          <stop offset="0.45" stopColor="#1640d6" />
          <stop offset="1" stopColor="#2a1694" />
        </linearGradient>
        <linearGradient id={HERO_ID} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9a4dff" />
          <stop offset="1" stopColor="#4f86ff" />
        </linearGradient>
        <linearGradient id={BRUSH_TIP_ID} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff9b5c" />
          <stop offset="1" stopColor="#a24dff" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="5.5" fill={`url(#${BACKGROUND_ID})`} />
      {/* Design → code arrow */}
      <path
        d="M10.5 4.2 Q14.5 1.8 18.2 4.6"
        fill="none"
        stroke="#5fd8ff"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path d="M18.9 3.2 L18.6 5.6 L16.4 5.1 Z" fill="#5fd8ff" />
      {/* Code window with </> */}
      <rect x="14" y="6.5" width="8" height="9" rx="1.3" fill="#0e1442" />
      <path
        d="M16.6 9.4 L15.6 10.7 L16.6 12 M18.5 9.2 L17.7 12.2 M19.6 9.4 L20.6 10.7 L19.6 12"
        fill="none"
        stroke="#eaf0ff"
        strokeWidth="0.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Layered webpage canvases */}
      <rect x="2" y="7" width="11" height="14" rx="1.5" fill="#6d7cf2" />
      <rect x="3.5" y="5" width="11" height="14.5" rx="1.5" fill="#f3f5ff" />
      <rect
        x="5"
        y="7.5"
        width="8"
        height="4"
        rx="0.8"
        fill={`url(#${HERO_ID})`}
      />
      <rect x="5" y="13" width="3.5" height="1.3" rx="0.5" fill="#9fb7ff" />
      <rect x="5" y="15.3" width="3.5" height="2.5" rx="0.6" fill="#8aa8ff" />
      {/* Paintbrush */}
      <path
        d="M20.6 20.6 L15.6 15.6"
        stroke="#2f62ff"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M20.6 20.6 L17.6 17.6"
        stroke="#ffffff"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path d="M15.8 15.8 L14.6 14.6" stroke="#d5dcec" strokeWidth="2" />
      <path
        d="M14.8 14.8 Q12.6 11.6 11 11.2 Q11.6 13.2 14.8 14.8 Z"
        fill={`url(#${BRUSH_TIP_ID})`}
        stroke={`url(#${BRUSH_TIP_ID})`}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
