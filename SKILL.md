---
name: figcraft-cli
description: Create, edit, inspect and render FigCraft design files (.figcraft, a Figma-like format; also reads .fig/.svg/.json) from the command line with figcraft-cli — no GUI needed. Use this whenever the user wants to design or mock up screens/pages/components (mobile, desktop, tablet, web, dashboards, logos, wireframes, flows), asks an AI to propose or iterate on a UI design in FigCraft, wants to add screens to or restyle an existing .figcraft file, wants to turn a spec/HTML/screenshot/codebase UI into a FigCraft file, or wants to export frames to PNG/SVG/PDF — even if they only say "make me a design file" or "rebuild this in FigCraft" and don't mention the CLI by name.
---

# figcraft-cli

`figcraft-cli` is FigCraft without a window. You drive it by feeding it **commands** (create a frame, set a fill, add a shadow…) and it saves a `.figcraft` document you can render to PNG and look at. This skill teaches you the working method; exact command shapes are discoverable from the CLI itself.

## 1. Find the CLI (don't assume a path)

It usually lives in FigCraft's install folder (on Windows commonly `C:\Program Files\FigCraft\figcraft-cli.exe`) and is often **not** on PATH. Locate it in this order: the user's stated path → `FIGCRAFT_CLI` env var → `where figcraft-cli` / `which figcraft-cli` → common install dirs. `node scripts/figcraft-builder.js --where` does this for you. Quote the path (it contains spaces) and use real files, not shell process substitution. Paths differ by tool: Git Bash uses `/c/Users/...`, but **Node on Windows reads `/tmp/x` as `C:\tmp\x`** — give Node real Windows paths (or relative ones) and use `os.tmpdir()` for scratch files.

## 2. The mental model

- A **script** is JSONL — one `{"command": "<id>", "params": {...}}` per line. `figcraft-cli run script.jsonl [--in existing.figcraft] --out result.figcraft` executes it headlessly and prints one JSON result line per step. It stops at the first failing step.
- **Discover commands instead of guessing**: `figcraft-cli commands --json --filter <word>` lists ids with their parameter shapes (≈550 commands). Error messages are precise (`missing field 'type'`), so run → read the error → fix.
- **Steps can't reference earlier results.** Layers get sequential integer ids (the page is `1`, the first layer you create is `2`, …). To nest layers (`parent: <id>`) in one script you must predict ids with a counter — and verify afterwards that the returned ids match.
- Therefore: **write a small generator** (Node/Python) rather than hand-writing JSONL. `scripts/figcraft-builder.js` is a ready-made zero-dependency helper (id counter, auto-layout frames, text, icons, shadows, run + verify + render). Use it as-is, or copy ideas into your own script. Hand-written JSONL is fine for tiny edits.

## 3. The loop that works

1. **Understand the ask** — what screens, which platform/size, what style, what content. If the user supplied a spec, HTML, screenshot or an existing file, read it first (see §5). If they gave only a brief ("suggest a desktop onboarding"), pick sensible sizes and a coherent palette/type scale yourself, state your choices, and offer to iterate.
2. **Pick a frame size and fonts.** Common: phone 390×844 (or 360×800), tablet 820×1180, desktop 1440×900. List fonts with the `text.fonts` command; a font that isn't installed silently renders as Inter, so choose installed families (or tell the user what you substituted). In a script use the builder's `listFonts('inter')` — the full list is long, so always filter.
3. **Define tokens once** (colours, radii, spacing, type) as constants in the generator, then build screens with helper functions (`card()`, `button()`, `field()`) so the design stays consistent and a later restyle is a one-line change.
4. **Build with auto-layout**, not pixel positions: `layout: 'column'|'row'`, `gap`, `padding`, `width/height: 'fill'|'hug'|number`. It mirrors CSS flexbox, survives text edits, and is what makes the file feel like a real design. Use `absolute` only for overlays, FABs, badges.
5. **Render and look.** `render file -o out.png --scale 0.5` for an overview, `export file -o x.png --node <id|name> --scale 1` for detail. Read the PNGs — don't trust "ok":true. Typical first-pass bugs: missing fills, text not wrapping, wrong alignment, content cut off or bleeding out. Clip rule: raw `frame.create` clips children by default; the builder defaults to `clip:false` so badges and shadows aren't cut — pass `clip:true` when you *want* cropping (whole screens, rounded image cards, decorative shapes that overflow).
6. **Iterate by regenerating** the whole file (takes seconds) rather than patching layer by layer. Write to a new filename until the user approves; never overwrite an existing design without being asked.
7. **Tell the user** where the file is, what's in it, which fonts were substituted, and what isn't done (interactions, components/variables, real images).

## 4. Layout conventions that make designs look right

- Lay screens on the canvas in a grid (e.g. 390-wide frames at an x-pitch of 470) and group the states of one screen next to each other (default / empty / error / dialog open).
- **Name frames descriptively instead of adding text labels above them.** Figma draws every top-level frame's name above it on the canvas, and FigCraft is Figma-like (confirm in the app if it matters), so a separate label is redundant — it adds layers, drifts out of sync when frames move or get renamed, and shows up in exports and layer lists. Put the caption in the frame name itself, e.g. `Home — 820×1180`, `Checkout / Error state`, `Dialog — delete alarm`. (The name is not drawn in `render`/`export` PNGs; only in the app's canvas. If the user needs captions *inside* a rendered image — a presentation board, a printed sheet — that is the one case for a real text layer.)
- Model interactive states (hover, open menu, selected tab, modal) as **separate frames**; model dialogs as an absolute full-size translucent frame with the dialog centred inside.
- CSS-style margin doesn't exist: use `gap`, parent `padding`, or `b.spacer()`.
- Alpha is part of the colour: `#201e1d80` = 50% (works for fills, strokes, text). Use it for muted text and dividers instead of separate greys.
- Icons: build from 24×24 line-icon paths and scale (`b.icon(parent,'bell',20,color)`); strokes scale with the icon. The builder ships ~17 generic icons; extend `b.icons` with any SVG path data.

## Size and type starting points (when the user gives none)

| Target | Frame | Notes |
|---|---|---|
| Phone | 390×844 (or 360×800) | body 15–16, caption 12–13, titles 20–28; touch targets ≥ 44, side padding 16–24, radius 12–16 |
| Tablet portrait / landscape | 820×1180 / 1180×820 | body 16–18, targets ≥ 48, 2-column layouts, side padding 32–48 |
| Desktop | 1440×900 (or 1280×800) | body 14–16, sidebar 240–280, content max ≈ 1100 |
| Web landing page | 1440 wide, height hug | section padding 80–120, hero title 56–72 |

Pick a spacing scale (4/8/12/16/24/32), one accent plus neutrals, at most two font families, and reuse them through constants.

## 5. Common situations

| Situation | Do this | Details |
|---|---|---|
| **New design from a brief** ("suggest a desktop dashboard / phone onboarding") | choose size + tokens → generator → render → show the user | `examples/desktop-dashboard.js` |
| **Build on an existing .figcraft** (add screens, restyle, fix) | `info` + `node.get` to read real sizes/colours/fonts → `Builder.forFile()` → `--in old --out new` | `examples/extend-existing-file.js` |
| **Convert an HTML/CSS (or bundled-HTML) design** | extract markup + tokens, map CSS→props, one frame per state | `examples/html-to-figcraft.md` |
| **From a screenshot / reference image** | read the image yourself; rebuild structure with auto-layout, sample colours; optionally `image.place` the original off-canvas as a reference | — |
| **From a codebase** (e.g. Flutter/React screens) | read the widget/component tree + theme tokens; mirror them as frames and constants | — |
| **Export** | `export file -o dir/ [--format png\|svg\|pdf]` (one file per top-level frame into a directory; `--node` for one layer; `--scale 2` for retina) | `references/cli-reference.md` |

## 6. Reference

- `references/cli-reference.md` — verified command shapes, styling props, auto-layout, text, vectors, effects, editing existing files, export, pitfalls. Read it before writing non-trivial scripts.
- `scripts/figcraft-builder.js` — the helper library (API cheat sheet at the top of the file; `require` it by relative path from `examples/`, or by absolute path from elsewhere).
- `examples/` — worked, tested examples. Run one to see the output format before writing your own.

## 7. Things not yet exercised (verify before promising)

Variables/styles/components (`variable.*`, `style.*`, `component.*` exist — worth using when the user wants a design system rather than hard-coded colours), prototyping links (`proto.*`), `dashes` rendering, plugin/MCP modes (`figcraft-cli mcp`).
