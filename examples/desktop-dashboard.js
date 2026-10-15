/**
 * Example: "Suggest a desktop dashboard screen for a habit-tracking app" → a new .figcraft file.
 * Run:  node examples/desktop-dashboard.js out.figcraft
 * Shows: tokens as constants, auto-layout (row/column, fill/hug), cards, shadows, icons, text,
 *        descriptive frame names (the canvas shows them above each frame), then render for visual review.
 */
const path = require('path');
const { Builder, render, alpha } = require('../scripts/figcraft-builder');

const out = process.argv[2] || 'dashboard.figcraft';
const T = { bg: '#f6f7fb', card: '#ffffff', ink: '#1b1f2a', muted: '#6b7280', brand: '#5b5bd6', brandSoft: '#ececff', good: '#16a34a', line: '#e5e7eb' };

const b = new Builder({ fonts: { body: 'Inter', heading: 'Inter' } }); // check `text.fonts` for what is installed
b.page('Desktop', '#e9eaf0');

// Root screen: row = sidebar + main. The frame name doubles as its caption on the canvas — no separate label layer needed.
const screen = b.frame(null, 'Dashboard — 1440×900', { width: 1440, height: 900, fill: T.bg, layout: 'row', clip: true, radius: 12 });

// Sidebar
const side = b.frame(screen, 'Sidebar', { width: 240, height: 'fill', fill: T.card, layout: 'column', padding: [24, 16, 24, 16], gap: 6, stroke: { color: T.line, width: 1 } });
b.text(side, 'Habitly', { size: 22, weight: 'Bold', color: T.brand });
b.spacer(side, 1, 16);
[['home', 'Today', true], ['grid', 'Habits', false], ['clock', 'History', false], ['user', 'Profile', false]].forEach(([ic, label, active]) => {
  const item = b.frame(side, `nav/${label}`, { width: 'fill', layout: 'row', gap: 12, padding: [10, 12, 10, 12], align: 'center', radius: 10, fill: active ? T.brandSoft : undefined });
  b.icon(item, ic, 20, active ? T.brand : T.muted);
  b.text(item, label, { size: 14, weight: active ? 'SemiBold' : 'Regular', color: active ? T.brand : T.ink });
});

// Main column
const main = b.frame(screen, 'Main', { width: 'fill', height: 'fill', layout: 'column', padding: 32, gap: 24 });
const head = b.frame(main, 'Header', { width: 'fill', layout: 'row', justify: 'between', align: 'center' });
const titles = b.frame(head, 'Titles', { layout: 'column', gap: 2 });
b.text(titles, 'Good morning, Ada', { size: 28, weight: 'Bold', color: T.ink });
b.text(titles, 'You have 3 habits left today', { size: 14, color: T.muted });
const add = b.frame(head, 'Add habit', { layout: 'row', gap: 8, padding: [10, 16, 10, 16], radius: 999, fill: T.brand, align: 'center' });
b.icon(add, 'plus', 16, '#fff');
b.text(add, 'New habit', { size: 14, weight: 'SemiBold', color: '#fff' });

// Stat cards
const stats = b.frame(main, 'Stats', { width: 'fill', layout: 'row', gap: 20 });
[['Current streak', '12 days', T.good], ['Completed today', '5 / 8', T.brand], ['This week', '86%', T.ink]].forEach(([k, v, c]) => {
  const card = b.frame(stats, `stat/${k}`, { width: 'fill', layout: 'column', gap: 6, padding: 20, fill: T.card, radius: 16, shadow: { color: alpha('#1b1f2a', 0.08), y: 2, blur: 8 } });
  b.text(card, k, { size: 13, color: T.muted });
  b.text(card, v, { size: 30, weight: 'Bold', color: c });
});

// Habit list
const list = b.frame(main, 'Habits', { width: 'fill', height: 'fill', layout: 'column', gap: 12, padding: 20, fill: T.card, radius: 16, shadow: { color: alpha('#1b1f2a', 0.08), y: 2, blur: 8 } });
b.text(list, "Today's habits", { size: 16, weight: 'SemiBold' });
[['Drink water', '2 L', true], ['Read 20 pages', '20 min', true], ['Meditate', '10 min', false], ['Evening walk', '30 min', false]].forEach(([n, meta, done]) => {
  const row = b.frame(list, `habit/${n}`, { width: 'fill', layout: 'row', gap: 12, align: 'center', padding: [10, 0, 10, 0], stroke: { color: T.line, top: true } });
  const box = b.frame(row, 'check', { width: 22, height: 22, radius: 7, fill: done ? T.brand : undefined, stroke: done ? undefined : { color: T.line, width: 2 }, layout: 'row', justify: 'center', align: 'center' });
  if (done) b.icon(box, 'check', 14, '#fff', { strokeWidth: 3 });
  b.text(row, n, { size: 15, weight: 'Medium', width: 'fill' });
  b.text(row, meta, { size: 13, color: T.muted });
});

b.save(out);
const png = out.replace(/\.figcraft$/, '.png');
render(out, png, { scale: 0.6 });
console.log('wrote', out, 'and', png);
