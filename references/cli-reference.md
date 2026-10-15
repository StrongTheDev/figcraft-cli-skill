# figcraft-cli reference (verified)

Everything here was exercised against a real install. When unsure, `figcraft-cli commands --json --filter <word>` is the source of truth; `node.get {id}` shows what a layer actually ended up with.

## Contents
- Subcommands
- `run` and ids
- Creating layers
- Styling props
- Auto-layout
- Text
- Vectors and icons
- Effects
- Reading and editing existing files
- Export / render
- Recipes
- Pitfalls

## Subcommands

```
figcraft-cli commands [--json] [--filter TEXT]
figcraft-cli run <script.jsonl|json> [--in <file>] [--out <file>]
figcraft-cli info <file> [--json]                 # node count, pages, top-level frames with ids and sizes
figcraft-cli render <file> -o out.png [--scale N] [--page NAME]       # whole page → one PNG
figcraft-cli export <file> -o <out> [--format png|jpg|svg|webp|pdf|fig] [--scale N] [--page NAME] [--node ID|NAME]
figcraft-cli convert <in> <out>                   # .fig / .svg / .json / images ⇄ .figcraft
figcraft-cli mcp [--attach PORT]                  # MCP server mode (not covered here)
```
`export` without `--node` writes one file per top-level frame into the `-o` directory; with `--node` (id or exact layer name) or an image extension on `-o` it writes one file. Add `--no-system-fonts` for machine-independent text rendering.

## `run` and ids

- Output: one line per step `{"command","ok","result","step"}`; first failure prints `error: step N (...)` and stops. `--out` prints `wrote <path>`.
- New document: page id = 1; first created layer = **2**; each created layer takes the next integer (frame, text, rectangle, ellipse, vector = 1 each). Commands that wrap/combine layers (`object.group`, `object.frameSelection`, `bool.*`) also allocate ids and break a pre-computed counter → build in stages (run, read ids, run again with `--in`).
- Existing document loaded with `--in`: new ids continue from (highest id + 1). `Builder.forFile()` probes this by running a throw-away `frame.create` without `--out`.
- `result.id` of every create step is returned; compare with your prediction (the builder does this and throws on mismatch).
- Steps cannot read earlier outputs; there is no variable substitution.

## Creating layers

```json
{"command":"frame.create","params":{"x":0,"y":0,"width":390,"height":844,"name":"Home","parent":2,"props":{...}}}
{"command":"text.create","params":{"text":"Hello","x":0,"y":0,"parent":2,"width":280,"props":{"fontSize":16}}}
{"command":"shape.rectangle","params":{"x":0,"y":0,"width":10,"height":1,"parent":2,"props":{"fill":"#ccc"}}}
{"command":"shape.ellipse","params":{...}}   {"command":"vector.create","params":{"path":"M3 10.5 12 3l9 7.5","x":0,"y":0,"parent":2,"props":{...}}}
```
- Omit `parent` → placed on the current page. `x`/`y` are relative to the parent frame.
- `props` accepts any `node.set` key. Later changes: `node.set` flat `{"id":3,"opacity":0.5}` or `{"ids":[3],"props":{...}}`.
- Other useful commands: `object.rename`, `node.reparent {ids,parent,index}`, `node.reorder {id,index}`, `edit.duplicate`, `edit.delete {ids}`, `transform.scale {ids,factor}` (scales strokes/text too), `transform.resize`, `command.batch {commands:[…]}` (one undo step), `page.rename`, `page.add`, `page.setBackground {color}`.

## Styling props (node.set keys)

| Want | Prop |
|---|---|
| fill | `fill:"#rrggbb"`; 8-digit hex = alpha (`#f5ead8ad` → opacity 0.68). None: `fills:[]`. **New frames default to a white fill and `clip:true`.** |
| stroke | `stroke:"#hex"` or `strokes:[{type:"solid",color}]`, `strokeWeight`, `strokeAlign: inside\|center\|outside`, `strokeCap/Join`, `dashes:[4,3]` |
| single-side border | `strokeWeight:1, strokeSides:[1,0,0,0]` — array is per-side **weights multiplier** `[top,right,bottom,left]`, `0` hides a side. (`strokeTopWeight` alone leaves the other sides drawn at 1px — avoid.) |
| corners | `cornerRadius: n \| [tl,tr,br,bl]` (999 = pill), `cornerSmoothing` |
| opacity / clip | `opacity` 0–1, `clip` bool |
| size | `width`,`height`, `sizingH`/`sizingV`: `fixed\|hug\|fill`, `minWidth/maxWidth/minHeight/maxHeight` |
| images / gradients | `image.place {path or data, x, y, width, height, parent, mode}` places an image layer; for gradients see the `fill.add` / `fill.set` params in `commands --json` (not exercised) |

Shadows/blur: `{"command":"effect.add","params":{"ids":[id],"effect":{"type":"dropShadow","color":"#00000040","offset":[0,4],"radius":8,"spread":0}}}`. `type` goes **inside** `effect` when `effect` is given (`{ids,type}` alone adds a default shadow). Other types: `innerShadow`, `layerBlur`, `backgroundBlur` (`{type,radius}` — pair with a translucent fill for frosted glass).

## Auto-layout (≈ CSS flexbox)

`layout: horizontal|vertical|grid` · `gap` · `padding` (n or `[t,r,b,l]`) · `mainAlign: min|center|max|spaceBetween|spaceAround|spaceEvenly` · `crossAlign: min|center|max|baseline` · `wrap:true` + `crossGap` · per child `sizingH/sizingV: fixed|hug|fill` (fill = `flex:1`/`width:100%`, needs a layout parent) · `absolute:true` (leaves the flow, positioned by x/y, like `position:absolute`).
- A "hug" frame still needs some `width`/`height` in the create call — it is recomputed.
- A wrap row needs a fixed (or fill) width to know where to wrap.
- Grid: `layout:"grid"`, `gridColumns`, `gridRows`, `columnTracks:[120,"1fr"]`, `gridColumn/gridRow/gridColumnSpan`.
- Margins don't exist: use `gap`, padding, or an invisible 1-px rectangle.

## Text

`fontFamily`, `fontStyle` (must exist for the family: `Regular|Medium|SemiBold|Bold|…`), `fontSize`, `fill`, `lineHeight` (`"150%"`, px, `"auto"`), `letterSpacing` (`"-1%"`, px), `textAlign`, `textCase: upper|lower|title`, `textDecoration`, `maxLines`.
- Wrapping: give a `width` (or `sizingH:"fill"`) **and** `textAutoResize:"height"`; otherwise text is one hugging line.
- `text.fonts {}` returns installed families. A family that isn't installed keeps its name in the file but **renders as Inter** — check the list, pick stand-ins, and tell the user. (Georgia Bold made a decent stand-in for a chunky display serif.)
- Muted text: bake alpha into the colour rather than using opacity.
- `text.set {id, characters}` changes content; `edit.findReplace {find, replace}` bulk-replaces text.

## Vectors and icons

- `vector.create {path}` keeps the path's own coordinates relative to `x,y` of the parent → SVG icon `d` strings work unchanged at `x:0,y:0` inside a 24×24 frame.
- Circle → `shape.ellipse` (x=cx−r, w=2r); rect → `shape.rectangle` with `cornerRadius`; polyline/polygon → path `M x y L x y … [Z]`.
- Line-icon props: `fills:[]`, `stroke`, `strokeWeight`, `strokeAlign:"center"`, `strokeCap:"round"`, `strokeJoin:"round"`.
- Resize with `transform.scale {ids:[frame], factor}` (strokes scale like SVG). Do it after the children exist; set opacity afterwards.
- Filled shapes: `fill` instead of `stroke`.

## Reading and editing existing files

- `info <file>` → counts, pages, top-level frames `id NAME w×h`.
- `node.get {id}`: `id 1` = the current page → `children` with ids/type/bounds; a frame → its `children` (with `childCount`), `fills`, `layout`, `sizing`, `cornerRadius`, `effects`; text → `characters`, font props. This is how you sample the real colours/fonts/spacing before extending a design.
- `select.byName {query}` finds layers by name; `select.layersAt {x,y}` finds layers under a point; `page.list`, `doc.list`.
- Modify with `node.set`, `text.set`, `node.reparent`, `edit.duplicate {ids,dx,dy}` (cloning a finished screen then tweaking is often faster than rebuilding), `edit.delete`.
- Always `run … --in old.figcraft --out new.figcraft`; compare renders; only then replace the original.

## Export / render

`render` → one PNG of the page (use `--scale 0.5` for big boards). `export --node <id|"Layer name">` → a single layer; `.svg`/`.pdf`/`.webp` by extension or `--format`; PDF supports `--bleed`, `--crop-marks`, `--cmyk`. Read the PNG with your image viewer to review.

## Recipes (builder syntax; the raw commands use the same props)

```js
// Progress bar / slider with thumb: track rect + fill rect (width = value × track width; no percentage sizing exists)
b.progress(parent, { width: 340, value: 0.38, fill: accent, track: alpha(ink, .15), thumb: { size: 14 } });

// Media controls: filled glyphs, scaled
b.icon(row, 'play', 56, accent, { filled: true });          // also prev / next / pause

// Modal: full-size absolute translucent frame holding a centred dialog
const ov = b.frame(screen, 'backdrop', { x: 0, y: 0, width: 390, height: 844, absolute: true, fill: '#2e2b2580', layout: 'column', justify: 'center', align: 'center', padding: 18 });
const dlg = b.frame(ov, 'dialog', { width: 'fill', layout: 'column', gap: 12, padding: 18, fill: '#fff', radius: 24, shadow: { y: 12, blur: 32, color: '#00000038' } });

// FAB / badge: absolute child; x,y relative to the parent's top-left; ignored by the parent's layout and hug size
b.frame(screen, 'fab', { x: 314, y: 700, width: 56, height: 56, radius: 999, fill: accent, absolute: true, layout: 'row', justify: 'center', align: 'center' });

// Frosted tab bar: translucent fill + background blur
b.frame(screen, 'tabbar', { x: 20, y: 759, width: 350, absolute: true, layout: 'row', padding: 8, radius: 999, fill: '#f5ead8ad', blur: 16 });

// Toggle switch: track frame + knob rect (knob x = on ? 21 : 3)
const t = b.frame(row, 'switch', { width: 44, height: 26, radius: 999, fill: accent });
b.rect(t, 21, 3, 20, 20, '#fff', { radius: 10 });

// Cropped decorative art: parent clip:true, oversized shapes inside
const art = b.frame(card, 'cover', { width: 300, height: 300, radius: 24, clip: true, fill: '#3b2f8f' });
b.ellipse(art, -60, 120, 260, 260, '#ff7a59');
```

## Pitfalls

- Check for `"ok":false`; nothing after a failed step runs.
- Predict ids with a counter and verify; wrapping commands break the counter.
- Defaults bite: white frame fill, `clip:true`, text default colour is black.
- Use quoted full path on Windows (spaces); under Git Bash use `/c/Program Files/...`.
- Don't assume a prop exists — check `commands --json`, then confirm with `node.get`.
- Big files: ~2,000 commands run in a few seconds; rendering a huge board at `--scale 1` is large — use `0.5` for overviews.
