# Layoutry brand assets (BRAND-1.1)

`layoutry-icon-source.png` is the **approved artwork** and the visual source
of truth: layered webpage canvases, a hand with a paintbrush, a code window
with `</>`, and an arrow from design to code, on a blue → cyan → purple
rounded-square tile. Never edit it; replace it only with a newly approved
version.

Every other icon is derived from it by `npm run brand:generate`
(`generate-brand-assets.mjs` → `brandIcons.mjs`). The outputs are committed:

| File                     | Use                                     | Sizes                                |
| ------------------------ | --------------------------------------- | ------------------------------------ |
| `layoutry.ico`           | Windows exe, window, taskbar, Alt+Tab   | 16, 20, 24, 32, 40, 48, 64, 128, 256 |
| `src/app/favicon.ico`    | Browser tab favicon                     | 16, 24, 32, 48                       |
| `src/app/icon.png`       | High-resolution browser icon            | 192 (palette-quantized)              |
| `src/app/apple-icon.png` | Apple touch icon (opaque; iOS masks it) | 180 (palette-quantized)              |

The source is opaque RGB on white with a soft drop shadow. The generator
flood-fills that backdrop from the image border to transparent and crops
square around the tile; the white page and glove inside the tile are never
reached.

## Small-size variants

At 24 px and below, the full illustration becomes unrecognizable noise.
`layoutry-icon-small-24.svg` (used for 20 and 24 px) and
`layoutry-icon-small-16.svg` (16 px) redraw the same identity on a pixel
grid with the artwork's colors. Simplifications:

- **Hand dropped:** only the paintbrush remains, with its white grip end
  standing in for the glove.
- **Page contents reduced** to the purple → blue hero band and two blocks.
  The browser dots, mountains, "T" text box and dashed placeholder are gone.
- **Code window kept with `</>`** at 24 px. At 16 px it shows only `< >`;
  the slash does not fit in 4 px.
- **Design → code arrow kept** at 24 px and dropped at 16 px.
- **Stacked pages** are reduced to one back layer at 24 px and dropped at
  16 px.

The application header mark (`src/components/layout/LayoutryLogoMark.tsx`)
is the 24 px variant inlined as React SVG. Keep the two in sync.
