/**
 * figcraft-builder.js — tiny zero-dependency helper for generating FigCraft command scripts.
 *
 * Why this exists: `figcraft-cli run` steps cannot reference earlier results, and created
 * layers get sequential integer ids. This class keeps an id counter so you can nest layers
 * (`parent: id`) in one script, then verifies the ids FigCraft actually returned.
 *
 * Usage (see examples/):
 *   const { Builder, locateCli } = require('./figcraft-builder');
 *   const b = new Builder();                       // new file. Or: await-free `Builder.forFile(path)`
 *   const card = b.frame(null, 'Card', { width: 320, fill: '#fff', radius: 16, layout: 'column', padding: 16, gap: 8 });
 *   b.text(card, 'Hello', { size: 20, weight: 'Bold' });
 *   b.save('out.figcraft');                        // runs the CLI, verifies ids, throws on any failed step
 *
 * API cheat sheet (all return the new layer id; parent = id or null for the page):
 *   b.page(name, bgColor)                         rename the page / set canvas colour
 *   b.frame(parent, name, {x,y,width,height,fill,radius,layout,gap,padding,justify,align,wrap,clip,stroke,shadow,blur,absolute,opacity})
 *   b.text(parent, str, {size,weight,color,font,lineHeight,letterSpacing,align,upper,width,opacity,x,y})
 *   b.rect(parent, x, y, w, h, fill, {radius,width:'fill',height:'fill',stroke,absolute,opacity})   // positional!
 *   b.ellipse(parent, x, y, w, h, fill, {stroke,absolute})                                         // positional!
 *   b.icon(parent, nameOrPrims, size, color, {strokeWidth, filled, x, y, absolute, opacity})
 *   b.progress(parent, {width, value 0-1, height, track, fill, thumb})   slider / progress bar
 *   b.spacer(parent, w, h)                        invisible rect (CSS margin substitute)
 *   b.shadow(id,{color,x,y,blur}) · b.backgroundBlur(id,r) · b.scale(id,f) · b.set(id,props) · b.rename(id,name) · b.cmd(command,params)
 *   b.save(file) / b.run({in,out})                execute + verify ids;  render(file,png,{scale}) · exportNode(file,out,node) · query(file,[cmds]) · listFonts(filter)
 *   Absolute children: x,y are relative to the parent's top-left and the layout ignores them (the parent's hug size is unaffected).
 *   No percentage widths exist — compute pixels (e.g. progress fill = value * trackWidth).
 *   Clip: this builder defaults clip:false (raw frame.create defaults to clip:true). With clip:false, children that overflow are drawn outside the
 *   frame — pass clip:true when you want cropping (rounded cards with images, decorative shapes, whole screens).
 *
 * Everything here only builds plain `{command, params}` objects — read the output of
 * `b.toJsonl()` if you want to see exactly what is sent to the CLI.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// ── locating the CLI ─────────────────────────────────────────────────────
/** Find figcraft-cli. Order: $FIGCRAFT_CLI, PATH, common install dirs. Returns a path or throws. */
function locateCli() {
  const candidates = [];
  if (process.env.FIGCRAFT_CLI) candidates.push(process.env.FIGCRAFT_CLI);
  const finder = process.platform === 'win32' ? ['where', ['figcraft-cli']] : ['which', ['figcraft-cli']];
  const r = spawnSync(finder[0], finder[1], { encoding: 'utf8' });
  if (r.status === 0) candidates.push(...r.stdout.split(/\r?\n/).filter(Boolean));
  if (process.platform === 'win32') {
    for (const base of [process.env['ProgramFiles'], process.env['ProgramFiles(x86)'], path.join(process.env.LOCALAPPDATA || '', 'Programs')]) {
      if (base) candidates.push(path.join(base, 'FigCraft', 'figcraft-cli.exe'));
    }
  } else {
    candidates.push('/Applications/FigCraft.app/Contents/MacOS/figcraft-cli', '/usr/local/bin/figcraft-cli', path.join(os.homedir(), '.local/bin/figcraft-cli'));
  }
  const hit = candidates.find(c => c && fs.existsSync(c));
  if (!hit) throw new Error('figcraft-cli not found. Set FIGCRAFT_CLI to its full path or add it to PATH. Tried:\n  ' + candidates.join('\n  '));
  return hit;
}

function cli(args, opts = {}) {
  const r = spawnSync(locateCli(), args, { encoding: 'utf8', maxBuffer: 1 << 28, ...opts });
  if (r.error) throw r.error;
  return r;
}

/** Colour with alpha: alpha('#201e1d', .5) → '#201e1d80'. FigCraft reads 8-digit hex as fill opacity. */
const alpha = (hex, a) => hex.slice(0, 7) + Math.round(a * 255).toString(16).padStart(2, '0');

const JUSTIFY = { start: 'min', center: 'center', end: 'max', between: 'spaceBetween', around: 'spaceAround', evenly: 'spaceEvenly' };
const ALIGN = { start: 'min', center: 'center', end: 'max', baseline: 'baseline' };

// A few generic 24×24 line icons (Lucide-style). Primitives: ['p', pathData] | ['c', cx, cy, r] | ['r', x, y, w, h, rx] | ['pl', [[x,y],..]]
// Add your own: b.icons.name = [...]. Paths are taken verbatim from SVG `d` attributes.
const ICONS = {
  plus: [['p', 'M12 5V19'], ['p', 'M5 12H19']],
  x: [['p', 'M18 6 6 18'], ['p', 'M6 6l12 12']],
  check: [['pl', [[20, 6], [9, 17], [4, 12]]]],
  menu: [['p', 'M4 6H20'], ['p', 'M4 12H20'], ['p', 'M4 18H20']],
  search: [['c', 11, 11, 8], ['p', 'M21 21l-4.3-4.3']],
  back: [['pl', [[15, 18], [9, 12], [15, 6]]]],
  forward: [['pl', [[9, 18], [15, 12], [9, 6]]]],
  chevDown: [['pl', [[6, 9], [12, 15], [18, 9]]]],
  chevUp: [['pl', [[18, 15], [12, 9], [6, 15]]]],
  home: [['p', 'M3 10.5 12 3l9 7.5'], ['p', 'M5 9v11h14V9']],
  user: [['c', 12, 8, 4], ['p', 'M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2']],
  bell: [['p', 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9'], ['p', 'M10.3 21a1.94 1.94 0 0 0 3.4 0']],
  heart: [['p', 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z']],
  clock: [['c', 12, 12, 10], ['pl', [[12, 6], [12, 12], [16, 14]]]],
  pin: [['p', 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z'], ['c', 12, 10, 3]],
  trash: [['pl', [[3, 6], [5, 6], [21, 6]]], ['p', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'], ['p', 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6']],
  // Filled glyphs (used with { filled: true }); 'p' paths are filled shapes, not strokes
  play: [['p', 'M7 4.5v15a1 1 0 0 0 1.5.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5Z']],
  pause: [['r', 6, 4, 4, 16, 1], ['r', 14, 4, 4, 16, 1]],
  next: [['p', 'M5 5.2v13.6a1 1 0 0 0 1.55.83l9.2-6.8a1 1 0 0 0 0-1.66l-9.2-6.8A1 1 0 0 0 5 5.2Z'], ['r', 17, 5, 3, 14, 1]],
  prev: [['p', 'M19 5.2v13.6a1 1 0 0 1-1.55.83l-9.2-6.8a1 1 0 0 1 0-1.66l9.2-6.8A1 1 0 0 1 19 5.2Z'], ['r', 4, 5, 3, 14, 1]],
  grid: [['r', 3, 3, 7, 7, 1.5], ['r', 14, 3, 7, 7, 1.5], ['r', 14, 14, 7, 7, 1.5], ['r', 3, 14, 7, 7, 1.5]],
};

class Builder {
  /**
   * @param {object} o
   * @param {number} [o.startId=2]  id of the first created layer. New file: 2 (the page is 1). Existing file: use Builder.forFile().
   * @param {object} [o.fonts]      { body: 'Inter', heading: 'Inter' } — check installed fonts with the `text.fonts` command.
   */
  constructor(o = {}) {
    this.nextId = o.startId || 2;
    this.fonts = { body: 'Inter', heading: 'Inter', ...(o.fonts || {}) };
    this.cmds = [];
    this.expected = new Map(); // step index → predicted id
    this.icons = { ...ICONS };
  }

  /** Builder for an existing file: probes the id the next created layer will receive. */
  static forFile(file, o = {}) {
    const tmp = path.join(os.tmpdir(), `fc-probe-${process.pid}.jsonl`);
    fs.writeFileSync(tmp, JSON.stringify({ command: 'frame.create', params: { width: 1, height: 1, name: 'probe' } }) + '\n');
    const r = cli(['run', tmp, '--in', file]); // no --out: nothing is saved
    const m = r.stdout.match(/"id":(\d+)/);
    if (!m) throw new Error('could not probe next id: ' + r.stdout + r.stderr);
    return new Builder({ ...o, startId: Number(m[1]) });
  }

  // ── raw ────────────────────────────────────────────────────────────────
  cmd(command, params = {}) { this.cmds.push({ command, params }); }
  /** Emit a command that creates exactly one layer; returns its (predicted) id. */
  create(command, params) {
    this.cmd(command, params);
    const id = this.nextId++;
    this.expected.set(this.cmds.length - 1, id);
    return id;
  }
  set(id, props) { this.cmd('node.set', { id, ...props }); }
  rename(id, name) { this.cmd('object.rename', { ids: [id], name }); }
  scale(id, factor) { this.cmd('transform.scale', { ids: [id], factor }); }
  shadow(id, { color = '#00000040', x = 0, y = 4, blur = 8, spread = 0 } = {}) {
    this.cmd('effect.add', { ids: [id], effect: { type: 'dropShadow', color, offset: [x, y], radius: blur, spread } });
  }
  backgroundBlur(id, radius = 16) { this.cmd('effect.add', { ids: [id], effect: { type: 'backgroundBlur', radius } }); }
  page(name, background) {
    if (name) this.cmd('page.rename', { name });
    if (background) this.cmd('page.setBackground', { color: background });
  }

  // ── layers ─────────────────────────────────────────────────────────────
  /**
   * @param {number|null} parent  parent layer id, or null for the page
   * @param {object} o
   *  x,y            position (ignored for auto-layout children unless `absolute`)
   *  width,height   number (fixed) | 'fill' | 'hug'   (default: 'hug' when `layout` is set, else 100)
   *  fill           '#rrggbb' or '#rrggbbaa'; omit for no fill (FigCraft's default white is explicitly removed)
   *  radius         number | [tl,tr,br,bl]            (999 = pill)
   *  layout         'row' | 'column'  (auto-layout)    gap, padding (n | [t,r,b,l]), justify, align, wrap, crossGap
   *  clip           default false
   *  stroke         { color, width=1, align='inside', dashes, top:true (top border only) | sides:[t,r,b,l] booleans } | '#hex'
   *  shadow         { color, x, y, blur }    blur  (background blur radius)
   *  absolute       true → positioned by x,y inside an auto-layout parent
   *  opacity
   */
  frame(parent, name, o = {}) {
    const props = this._boxProps(o);
    const hasLayout = !!o.layout;
    const w = o.width != null ? o.width : (hasLayout ? 'hug' : 100);
    const h = o.height != null ? o.height : (hasLayout ? 'hug' : 100);
    this._sizing(props, w, h);
    const p = { x: o.x || 0, y: o.y || 0, width: typeof w === 'number' ? w : 100, height: typeof h === 'number' ? h : 100, name, props };
    if (parent != null) p.parent = parent;
    const id = this.create('frame.create', p);
    if (o.shadow) this.shadow(id, o.shadow);
    if (o.blur) this.backgroundBlur(id, o.blur);
    return id;
  }

  _boxProps(o) {
    const props = {};
    if (o.fill) props.fill = o.fill; else props.fills = [];
    if (o.radius != null) props.cornerRadius = o.radius;
    props.clip = !!o.clip;
    if (o.layout) {
      props.layout = o.layout === 'row' ? 'horizontal' : o.layout === 'column' ? 'vertical' : o.layout;
      if (o.gap != null) props.gap = o.gap;
      if (o.padding != null) props.padding = o.padding;
      if (o.justify) props.mainAlign = JUSTIFY[o.justify] || o.justify;
      if (o.align) props.crossAlign = ALIGN[o.align] || o.align;
      if (o.wrap) { props.wrap = true; if (o.crossGap != null) props.crossGap = o.crossGap; }
    }
    if (o.stroke) {
      const s = typeof o.stroke === 'string' ? { color: o.stroke } : o.stroke;
      props.strokes = [{ type: 'solid', color: s.color }];
      props.strokeWeight = s.width || 1;
      // strokeSides = per-side weight multipliers [top,right,bottom,left]; 0 hides a side
      if (s.top) props.strokeSides = [1, 0, 0, 0]; else if (s.sides) props.strokeSides = s.sides.map(Number);
      props.strokeAlign = s.align || 'inside';
      if (s.dashes) props.dashes = s.dashes;
    }
    if (o.absolute) props.absolute = true;
    if (o.opacity != null) props.opacity = o.opacity;
    return props;
  }

  _sizing(props, w, h) {
    if (w === 'fill' || w === 'hug') props.sizingH = w; else if (typeof w === 'number') props.sizingH = 'fixed';
    if (h === 'fill' || h === 'hug') props.sizingV = h; else if (typeof h === 'number') props.sizingV = 'fixed';
  }

  /**
   * @param {object} o
   *  size, weight ('Regular'|'Medium'|'SemiBold'|'Bold'…), color, font ('body'|'heading'|family name)
   *  lineHeight ('150%'|px|'auto'), letterSpacing ('-1%'|px), align, upper, opacity
   *  width         number → wraps at that width | 'fill' → fills the auto-layout parent. Omit for a single hugging line.
   */
  text(parent, str, o = {}) {
    const family = o.font === 'heading' ? this.fonts.heading : (o.font && o.font !== 'body' ? o.font : this.fonts.body);
    const props = { fontFamily: family, fontStyle: o.weight || 'Regular', fontSize: o.size || 14, fill: o.color || '#000000' };
    if (o.lineHeight != null) props.lineHeight = o.lineHeight;
    if (o.letterSpacing != null) props.letterSpacing = o.letterSpacing;
    if (o.align) props.textAlign = o.align;
    if (o.upper) props.textCase = 'upper';
    if (o.opacity != null) props.opacity = o.opacity;
    if (o.absolute) props.absolute = true;
    if (o.width === 'fill') { props.sizingH = 'fill'; props.textAutoResize = 'height'; }
    else if (typeof o.width === 'number') props.textAutoResize = 'height';
    const p = { text: str, x: o.x || 0, y: o.y || 0, props };
    if (parent != null) p.parent = parent;
    if (typeof o.width === 'number') p.width = o.width;
    return this.create('text.create', p);
  }

  rect(parent, x, y, width, height, fill, o = {}) {
    const props = { ...(fill ? { fill } : { fills: [] }) };
    if (o.radius != null) props.cornerRadius = o.radius;
    if (o.width === 'fill') props.sizingH = 'fill';
    if (o.height === 'fill') props.sizingV = 'fill';
    if (o.stroke) { props.stroke = o.stroke.color || o.stroke; props.strokeWeight = o.stroke.width || 1; props.strokeAlign = o.stroke.align || 'inside'; }
    if (o.absolute) props.absolute = true;
    if (o.opacity != null) props.opacity = o.opacity;
    const p = { x, y, width, height, props };
    if (parent != null) p.parent = parent;
    return this.create('shape.rectangle', p);
  }

  ellipse(parent, x, y, width, height, fill, o = {}) {
    const props = { ...(fill ? { fill } : { fills: [] }) };
    if (o.stroke) { props.stroke = o.stroke.color || o.stroke; props.strokeWeight = o.stroke.width || 1; props.strokeAlign = o.stroke.align || 'inside'; }
    if (o.absolute) props.absolute = true;
    const p = { x, y, width, height, props };
    if (parent != null) p.parent = parent;
    return this.create('shape.ellipse', p);
  }

  /** Spacer used in place of CSS margins: an invisible rect of the given size. */
  spacer(parent, width, height) {
    const id = this.rect(parent, 0, 0, width, height, '#000000');
    this.set(id, { opacity: 0 });
    return id;
  }

  /**
   * Line icon built from 24×24 primitives, scaled to `size`. Strokes scale with it (like SVG).
   * `name` is a key of this.icons, or pass primitives directly.
   */
  icon(parent, name, size, color, o = {}) {
    const prims = Array.isArray(name) ? name : this.icons[name];
    if (!prims) throw new Error(`unknown icon "${name}" — add it to builder.icons`);
    const label = Array.isArray(name) ? 'custom' : name;
    const f = this.frame(parent, `icon/${label}`, { width: 24, height: 24, x: o.x, y: o.y, absolute: o.absolute });
    const stroke = o.filled
      ? { fill: color }
      : { fills: [], stroke: color, strokeWeight: o.strokeWidth || 2, strokeAlign: 'center', strokeCap: 'round', strokeJoin: 'round' };
    for (const pr of prims) {
      const t = pr[0];
      if (t === 'c') this.create('shape.ellipse', { x: pr[1] - pr[3], y: pr[2] - pr[3], width: pr[3] * 2, height: pr[3] * 2, parent: f, props: stroke });
      else if (t === 'r') this.create('shape.rectangle', { x: pr[1], y: pr[2], width: pr[3], height: pr[4], parent: f, props: { ...stroke, cornerRadius: pr[5] || 0 } });
      else if (t === 'p') this.create('vector.create', { path: pr[1], x: 0, y: 0, parent: f, props: stroke });
      else if (t === 'pl') this.create('vector.create', { path: 'M' + pr[1].map(p => p.join(' ')).join(' L'), x: 0, y: 0, parent: f, props: stroke });
      else throw new Error('bad icon primitive ' + t);
    }
    if (size !== 24) this.scale(f, size / 24);
    if (o.opacity != null) this.set(f, { opacity: o.opacity });
    return f;
  }

  /** Progress bar / slider: rounded track, accent fill (value 0–1 of width) and optional thumb. */
  progress(parent, { width, value = 0.4, height = 4, track = '#00000022', fill = '#3b82f6', thumb = null, name = 'progress' } = {}) {
    const thumbD = thumb ? (thumb.size || 16) : 0;
    const box = this.frame(parent, name, { width, height: Math.max(height, thumbD) });
    const y = (Math.max(height, thumbD) - height) / 2;
    this.rect(box, 0, y, width, height, track, { radius: height / 2 });
    if (value > 0) this.rect(box, 0, y, Math.max(height, width * value), height, fill, { radius: height / 2 });
    if (thumb) this.ellipse(box, Math.min(width - thumbD, Math.max(0, width * value - thumbD / 2)), 0, thumbD, thumbD, thumb.color || fill);
    return box;
  }

  // ── output ─────────────────────────────────────────────────────────────
  toJsonl() { return this.cmds.map(c => JSON.stringify(c)).join('\n') + '\n'; }
  writeScript(file) { fs.writeFileSync(file, this.toJsonl()); return file; }

  /**
   * Execute the script with the CLI and verify every step. Throws on a failed step or id mismatch.
   * @param {object} o  { in: existing .figcraft to start from, out: file to write }
   */
  run({ in: input, out }) {
    const script = path.join(os.tmpdir(), `fc-script-${process.pid}.jsonl`);
    this.writeScript(script);
    const args = ['run', script];
    if (input) args.push('--in', input);
    if (out) args.push('--out', out);
    const r = cli(args);
    const lines = (r.stdout || '').split(/\r?\n/).filter(l => l.startsWith('{'));
    const results = lines.map(l => JSON.parse(l));
    const failed = results.find(x => x.ok === false);
    if (failed) throw new Error(`step ${failed.step} (${failed.command}) failed: ${failed.error}`);
    if (r.status !== 0) throw new Error((r.stderr || r.stdout).trim());
    for (const x of results) {
      const exp = this.expected.get(x.step);
      if (exp != null && x.result && x.result.id !== exp) {
        throw new Error(`id mismatch at step ${x.step} (${x.command}): FigCraft gave ${x.result.id}, predicted ${exp}. A command created extra layers (group/boolean ops?) — build in stages.`);
      }
    }
    return results;
  }
  save(out, o = {}) { return this.run({ out, ...o }); }
}

/** Render the whole page (or one page by name) to a PNG. */
function render(file, out, { scale = 0.5, page } = {}) {
  const args = ['render', file, '-o', out, '--scale', String(scale)];
  if (page) args.push('--page', page);
  const r = cli(args);
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return out;
}
/** Export one layer (id or name) to PNG/SVG/PDF — format is inferred from the extension of `out`. */
function exportNode(file, out, node, { scale = 1 } = {}) {
  const r = cli(['export', file, '-o', out, '--node', String(node), '--scale', String(scale)]);
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return out;
}
/** Run arbitrary read-only commands (e.g. node.get, page.list, text.fonts) and return parsed results. */
function query(file, commands) {
  const tmp = path.join(os.tmpdir(), `fc-query-${process.pid}.jsonl`);
  fs.writeFileSync(tmp, commands.map(c => JSON.stringify(c)).join('\n') + '\n');
  const args = ['run', tmp]; if (file) args.push('--in', file);
  const r = cli(args);
  return r.stdout.split(/\r?\n/).filter(l => l.startsWith('{')).map(l => JSON.parse(l));
}

/** Installed font families (optionally filtered by case-insensitive substring). Missing families render as Inter — check first. */
function listFonts(filter) {
  const r = query(null, [{ command: 'text.fonts', params: {} }])[0].result;
  return filter ? r.filter(f => f.toLowerCase().includes(filter.toLowerCase())) : r;
}

module.exports = { Builder, locateCli, cli, render, exportNode, query, listFonts, alpha };

// CLI: `node figcraft-builder.js --where` prints the located CLI path.
if (require.main === module && process.argv.includes('--where')) console.log(locateCli());
