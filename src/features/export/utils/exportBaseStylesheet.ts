import { DOCUMENT_SANS_FONT_STACK } from "@/features/canvas";

/*
 * The base layer every exported page starts from (EXPORT-1.2).
 *
 * On the Canvas, each document element sits on Tailwind v4's Preflight
 * reset (src/app/globals.css imports tailwindcss). Exported pages must
 * start from the same baseline or every element renders differently —
 * headings would get browser default sizes, lists bullets, buttons grey
 * bevels. This is that reset, reduced to the rules that affect elements
 * the editor can produce. Rules for elements it never renders (abbr,
 * code, small, sub/sup, menu, summary, date/time inputs) are left out
 * rather than blindly copied.
 */
const RESET = `/* Base reset adapted from Tailwind CSS v4.3.2 Preflight (MIT License, https://tailwindcss.com) —
   the same baseline the Layoutry Canvas renders on. */
*,
::after,
::before,
::backdrop,
::file-selector-button {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0 solid;
}

html {
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
  tab-size: 4;
  font-family: ${DOCUMENT_SANS_FONT_STACK};
  font-feature-settings: normal;
  font-variation-settings: normal;
  -webkit-tap-highlight-color: transparent;
}

hr {
  height: 0;
  color: inherit;
  border-top-width: 1px;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  font-size: inherit;
  font-weight: inherit;
}

a {
  color: inherit;
  -webkit-text-decoration: inherit;
  text-decoration: inherit;
}

table {
  text-indent: 0;
  border-color: inherit;
  border-collapse: collapse;
}

:-moz-focusring {
  outline: auto;
}

progress {
  vertical-align: baseline;
}

ol,
ul {
  list-style: none;
}

img,
svg,
video,
audio,
iframe {
  display: block;
  vertical-align: middle;
}

img,
video {
  max-width: 100%;
  height: auto;
}

button,
input,
select,
optgroup,
textarea,
::file-selector-button {
  font: inherit;
  font-feature-settings: inherit;
  font-variation-settings: inherit;
  letter-spacing: inherit;
  color: inherit;
  border-radius: 0;
  background-color: transparent;
  opacity: 1;
}

::placeholder {
  opacity: 1;
}

@supports (not (-webkit-appearance: -apple-pay-button)) or (contain-intrinsic-size: 1px) {
  ::placeholder {
    color: color-mix(in oklab, currentcolor 50%, transparent);
  }
}

textarea {
  resize: vertical;
}

::-webkit-search-decoration {
  -webkit-appearance: none;
}

:-moz-ui-invalid {
  box-shadow: none;
}

button,
input:where([type="button"], [type="reset"], [type="submit"]),
::file-selector-button {
  appearance: button;
}

::-webkit-inner-spin-button,
::-webkit-outer-spin-button {
  height: auto;
}

[hidden]:where(:not([hidden="until-found"])) {
  display: none !important;
}`;

/**
 * The reset plus the page's own surface. `body` takes the Canvas page
 * sheet's surface (the shared "page-surface" default, passed in by the
 * printer); `html` carries the font smoothing the editor's root element
 * applies (src/app/layout.tsx's `antialiased`), which the document
 * inherits there. The sheet's presentation-only chrome — its 1440px
 * maximum width, minimum height, border, shadow and rounded corners — is
 * deliberately NOT exported: it frames the page inside the editor, it is
 * not part of the authored page.
 */
export function exportBaseStylesheet(bodyDeclarations: readonly (readonly [string, string])[]): string {
  const body = bodyDeclarations.map(([property, value]) => `  ${property}: ${value};`).join("\n");
  return `${RESET}

html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
${body}
}`;
}
