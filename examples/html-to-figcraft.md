# Example: rebuild an HTML/CSS design as a .figcraft file

Worked from a real case: a 290 KB single-file "bundled" HTML mockup of a mobile app (7 screens, ~1,950 FigCraft commands, 17 frames). The same method applies to any HTML/CSS design — hand-written, exported from a design tool, or a running web app.

## 1. Get at the real source

Open the HTML and see what it is:
- **Plain HTML/CSS** → read it directly.
- **Bundled export** (`<script type="__bundler/manifest">`, `__bundler/template`): the page is a JSON-string template plus base64 (often gzip) assets. Extract with a short script: parse the `template` script tag's JSON string → HTML; each manifest entry has `mime`, `compressed`, base64 `data` (gunzip JS; fonts are woff2). The template contains the markup, a `<style>` block of design tokens, and often a logic script with the **data and copy** (labels, sample records, state names) — read that too, it is the content to put in the frames.
- **A running app/URL** → open it in a browser tool and read computed styles, or screenshot each state.

Shrink the markup before reading: strip `<svg>…</svg>`, `style="…"` and event attributes into a condensed copy, and read inline styles separately for the parts you build. Save the unique SVG icon paths (`d=` strings) — they feed `b.icons`.

## 2. Extract tokens → constants

Pull from the `:root`/token block: colours (including tonal ramps), font families, radii, spacing, shadows. Resolve CSS functions to concrete values:
- `color-mix(in srgb, X 16%, transparent)` → `X` + alpha hex (`#201e1d29`)
- `box-shadow: 0 3px 10px rgba(...)` → `b.shadow(id,{y:3,blur:10,color})`
- `border-radius: 999px` → `radius: 999`
- `rem/em` → px at the root size.
Keep them as named constants (`K.accent`, `SH.md`) at the top of your generator.

## 3. Map layout CSS → FigCraft

| CSS | FigCraft (builder option) |
|---|---|
| `display:flex; flex-direction:column/row` | `layout:'column'/'row'` |
| `gap` | `gap` |
| `padding: a b c d` | `padding:[a,b,c,d]` |
| `justify-content: space-between / center / flex-end` | `justify:'between'/'center'/'end'` |
| `align-items: center` | `align:'center'` |
| `flex:1`, `width:100%` | `width:'fill'` |
| fixed `width:350px` | `width:350` |
| shrink-to-content | `'hug'` (default for layout frames) |
| `position:absolute; right:20px; bottom:88px` | `absolute:true, x:…, y:…` (compute from parent size) |
| `margin` | `gap`, parent padding, or `b.spacer()` |
| `overflow:hidden` | `clip:true` |
| `border:1px solid c` | `stroke:{color,width}`; one side → `stroke:{top:true}` |
| `opacity` on text | bake alpha into the text colour |
| `line-height:1.55` | `lineHeight:'155%'` (note inherited body line-height applies to every text) |
| `backdrop-filter:blur(16px)` | translucent `fill` + `blur:16` |
| scrollable lists | lay out the visible content; frames are static (make the frame tall enough or clip) |

## 4. Turn behaviour into frames

HTML apps encode screens as conditionals (`isHome`, `isSettings`, `fabOpen`, confirm dialogs). Enumerate them from the logic/state and make **one frame per state worth showing**: each screen, each variant with distinct UI (empty vs filled, selected tab, form expanded, menu open), and each dialog on top of its parent screen. Don't try to port interactions; mention that they weren't ported.

## 5. Build and check

1. Write `build.js` with tokens, component helpers (`switch`, `button`, `chip`, `card`, `field`, `segmented`), then screens. Grid-lay frames (e.g. x-pitch 470, y-pitch 1024) with a text label above each.
2. `b.save('out.figcraft')` — the builder verifies ids.
3. `render … --scale 0.5`, then `export … --node <id> --scale 1` for dense screens. Compare against the HTML in a browser; fix and regenerate.

## 6. Things that went wrong the first time (so they don't again)

- Missing fonts (a chunky display serif + a geometric sans) silently fell back to Inter → check `text.fonts`, substitute deliberately, report it.
- An overlay in the source overlapped another control (menu over FAB) — a source quirk; fix it in the rebuild and mention it.
- `strokeTopWeight` left the other three borders on → use `strokeSides`.
- Missing `fills:[]` made frames white; missing `clip:false` clipped badges placed outside their parent.
- Hover/drag/click behaviour has no place in a static file — say so in the hand-off.
