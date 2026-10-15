/**
 * Example: add a NEW screen to an EXISTING .figcraft file, matching its look.
 * Run:  node examples/extend-existing-file.js existing.figcraft extended.figcraft
 *
 * Pattern for working with existing files:
 *   1. Read the file first (info / node.get) — learn frame sizes, colours, fonts, spacing from real layers.
 *   2. Builder.forFile() probes the next free layer id so `parent:` ids stay correct.
 *   3. Place new frames beside the existing ones, run with --in <existing> --out <new> (never overwrite the original
 *      until you have looked at the render).
 */
const { Builder, query, render, alpha } = require('../scripts/figcraft-builder');

const [input, output] = [process.argv[2], process.argv[3]];
if (!input || !output) { console.error('usage: node extend-existing-file.js <existing.figcraft> <out.figcraft>'); process.exit(1); }

// 1. Inspect: top-level frames of the current page → where to put the new one, and what size to use.
const [page] = query(input, [{ command: 'node.get', params: { id: 1 } }]); // id 1 = the page; its `children` are the top-level layers
const frames = page.result.children.filter(c => c.type === 'FRAME');
const right = Math.max(...frames.map(f => f.absoluteBounds.x + f.absoluteBounds.width));
const ref = frames[0];
console.log(`found ${frames.length} frames; new frame goes at x=${right + 80}; reference size ${ref.width}×${ref.height}`);

// Sample real tokens from a reference frame instead of guessing (fills[0].color is a hex string).
const refDetail = query(input, [{ command: 'node.get', params: { id: ref.id } }])[0].result;
const bg = refDetail.fills[0].color;
console.log('reference background:', bg);

// 2. Build the new screen.
const b = Builder.forFile(input);
b.text(null, 'Alarm ringing (new)', { x: right + 80, y: -30, size: 14, weight: 'SemiBold', color: '#474238' });
const s = b.frame(null, 'Alarm ringing', { x: right + 80, y: ref.absoluteBounds.y, width: ref.width, height: ref.height, fill: bg, radius: refDetail.cornerRadius, clip: true, layout: 'column', align: 'center', justify: 'center', gap: 20, padding: 32 });
b.icon(s, 'bell', 72, '#8c491a', { strokeWidth: 2.5 });
b.text(s, '7:00 AM', { size: 56, weight: 'Bold', color: '#201e1d', font: 'heading' });
b.text(s, 'Tokyo Morning', { size: 18, color: alpha('#201e1d', 0.7) });
b.spacer(s, 1, 40);
const snooze = b.frame(s, 'Snooze', { width: 'fill', height: 52, layout: 'row', justify: 'center', align: 'center', radius: 999, stroke: { color: alpha('#201e1d', 0.16) } });
b.text(snooze, 'Snooze 5 min', { size: 15, weight: 'SemiBold' });
const stop = b.frame(s, 'Stop', { width: 'fill', height: 52, layout: 'row', justify: 'center', align: 'center', radius: 999, fill: '#c67139' });
b.text(stop, 'Stop', { size: 15, weight: 'SemiBold', color: '#f5ead8' });

// 3. Write to a NEW file; render to check.
b.run({ in: input, out: output });
render(output, output.replace(/\.figcraft$/, '.png'), { scale: 0.4 });
console.log('wrote', output);
