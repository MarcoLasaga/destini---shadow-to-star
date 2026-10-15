/* eslint-disable */
// StyleSense — Figma-ready layered SVG generator
// Run:  node figma-layered-screens/generate-svgs.js
// Emits 8 × 375x812 SVGs whose nested <g id> groups, <rect rx>, <path> icons and
// <text> nodes import into Figma as a named, editable layer hierarchy.

const fs = require('fs');
const path = require('path');

const OUT = __dirname;
const FONT = "Inter, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif";

// ── Official StyleSense brand palette ─────────────────────────────────────────
const B = {
  darkPlum: '#24152C',
  mediumPlum: '#4B1D6F',
  softLilac: '#DECFE8',
  paleYellow: '#FBF5A7',
  peach: '#FDD78B',
  softCream: '#FDF3D2',
  alabaster: '#FAF7F0',
  darkCard: '#2E1B38',
  darkTile: '#3A2447',
  white: '#FFFFFF',
};

const LIGHT = {
  mode: 'light', bg: B.alabaster, surface: B.white, border: B.softLilac, text: B.darkPlum,
  muted: B.mediumPlum, accent: B.darkPlum, onAccent: B.paleYellow, badge: B.softLilac, tile: B.softCream,
};
const DARK = {
  mode: 'dark', bg: B.darkPlum, surface: B.darkCard, border: B.mediumPlum, text: B.softCream,
  muted: B.softLilac, accent: B.paleYellow, onAccent: B.darkPlum, badge: B.mediumPlum, tile: B.darkTile,
};

// ── Primitive builders (unique ids → Figma layer names) ──────────────────────
let ids = new Map();
const uid = (raw) => {
  const id = String(raw).replace(/[^A-Za-z0-9_\-]/g, '_').replace(/_+/g, '_').replace(/_$/, '');
  if (!ids.has(id)) { ids.set(id, 1); return id; }
  const n = ids.get(id) + 1; ids.set(id, n); return `${id}_${n}`;
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const A = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== false).map(([k, v]) => `${k}="${v}"`).join(' ');
const flat = (k) => [].concat(k).flat(Infinity).filter(Boolean).join('\n');
const n2 = (v) => (typeof v === 'number' ? +v.toFixed(2) : v);

const G = (id, kids, extra = {}) => `<g ${A({ id: uid(id), ...extra })}>\n${flat(kids)}\n</g>`;
const R = (id, x, y, w, h, o = {}) => `<rect ${A({
  id: uid(id), x: n2(x), y: n2(y), width: n2(w), height: n2(h), rx: o.rx !== undefined ? n2(o.rx) : undefined,
  fill: o.fill || 'none', 'fill-opacity': o.fo, stroke: o.stroke, 'stroke-width': o.stroke ? (o.sw || 1) : undefined,
  'stroke-dasharray': o.dash, opacity: o.opacity, filter: o.shadow ? 'url(#Card_Shadow)' : undefined,
})}/>`;
const C = (id, cx, cy, r, o = {}) => `<circle ${A({
  id: uid(id), cx: n2(cx), cy: n2(cy), r: n2(r), fill: o.fill || 'none', 'fill-opacity': o.fo, stroke: o.stroke,
  'stroke-width': o.stroke ? (o.sw || 1) : undefined, 'stroke-dasharray': o.dash, 'stroke-linecap': o.cap,
  opacity: o.opacity, transform: o.transform,
})}/>`;
const P = (id, d, o = {}) => `<path ${A({
  id: uid(id), d, fill: o.fill || 'none', 'fill-opacity': o.fo, stroke: o.stroke, 'stroke-width': o.stroke ? n2(o.sw || 2) : undefined,
  'stroke-linecap': o.stroke ? 'round' : undefined, 'stroke-linejoin': o.stroke ? 'round' : undefined,
  'stroke-dasharray': o.dash, opacity: o.opacity,
})}/>`;
// Text: string, or array of [string, fill, weight?] segments for mixed styling.
const T = (id, x, y, s, o = {}) => {
  const body = Array.isArray(s)
    ? s.map(([str, fill, weight]) => `<tspan ${A({ fill, 'font-weight': weight })}>${esc(str)}</tspan>`).join('')
    : esc(s);
  return `<text ${A({
    id: uid(id), x: n2(x), y: n2(y), 'font-family': FONT, 'font-size': o.size || 14, 'font-weight': o.weight || 400,
    fill: o.fill || B.darkPlum, 'text-anchor': o.anchor, 'letter-spacing': o.ls, opacity: o.opacity,
    'text-decoration': o.deco,
  })}>${body}</text>`;
};
const TM = (id, x, y, lines, lh, o = {}) => `<text ${A({
  id: uid(id), x: n2(x), y: n2(y), 'font-family': FONT, 'font-size': o.size || 14, 'font-weight': o.weight || 400,
  fill: o.fill || B.darkPlum, 'text-anchor': o.anchor,
})}>${lines.map((l, i) => `<tspan x="${n2(x)}"${i ? ` dy="${lh}"` : ''}>${esc(l)}</tspan>`).join('')}</text>`;

const tw = (s, size, weight = 400) => {
  const upper = s === s.toUpperCase() && /[A-Z]/.test(s);
  const f = upper ? 0.68 : weight >= 700 ? 0.6 : 0.54;
  return s.length * size * f;
};

// ── Vector icon set (24×24 grid, stroke-based) ────────────────────────────────
const ICON = {
  home: 'M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  shirt: 'M8 3L3 6l2 4.5 2-1V21h10V9.5l2 1L21 6l-5-3a4 4 0 0 1-8 0z',
  sparkles: 'M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z M18.5 14.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z',
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21v-1a7 7 0 0 1 14 0v1 M16 3.2a4 4 0 0 1 0 7.6 M22 21v-1a7 7 0 0 0-4-6.3',
  person: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z M4 21v-.5a8 8 0 0 1 16 0v.5',
  bell: 'M18 8.5a6 6 0 1 0-12 0c0 7-3 8.5-3 8.5h18s-3-1.5-3-8.5z M13.7 20.5a2 2 0 0 1-3.4 0',
  camera: 'M22 18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h3.5L9.5 4h5l2 2.5H20a2 2 0 0 1 2 2z M12 16.5a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6z',
  image: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M8.5 10.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z M21 15.5l-5-5L5 20',
  options: 'M4 6h16 M7 12h10 M10 18h4',
  chevronDown: 'M6 9l6 6 6-6',
  chevronUp: 'M18 15l-6-6-6 6',
  chevronRight: 'M9 6l6 6-6 6',
  arrowLeft: 'M19 12H5 M12 19l-7-7 7-7',
  arrowRight: 'M5 12h14 M12 5l7 7-7 7',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 1v2 M12 21v2 M4.2 4.2l1.4 1.4 M18.4 18.4l1.4 1.4 M1 12h2 M21 12h2 M4.2 19.8l1.4-1.4 M18.4 5.6l1.4-1.4',
  cloudSun: 'M10 2v2 M3.5 4.5l1.4 1.4 M1.5 11h2 M16.5 4.5l-1.4 1.4 M13.9 9.6A4 4 0 0 0 6.2 11 M17.5 21H9a5 5 0 1 1 4.6-7h3.9a3.5 3.5 0 0 1 0 7z',
  leaf: 'M11 20A7 7 0 0 1 4 13c0-6 6-10 16-10 0 10-4 16-9 17z M4 21c4-6 8-9 12-11',
  droplet: 'M12 2.7l5.7 5.6a8 8 0 1 1-11.3 0z',
  star: 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M8.8 12l2.2 2.2 4.2-4.4',
  bookmark: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
  calendar: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M16 2v4 M8 2v4 M3 10h18',
  suitcase: 'M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M3 13h18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M12 5v14 M5 12h14',
  x: 'M18 6L6 18 M6 6l12 12',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3',
  cpu: 'M6 6h12v12H6z M10 10h4v4h-4z M9 2v4 M15 2v4 M9 18v4 M15 18v4 M18 9h4 M18 15h4 M2 9h4 M2 15h4',
  alert: 'M12 9v4 M12 17h.01 M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  wind: 'M9.6 4.6A2 2 0 1 1 11 8H2 M12.6 19.4A2 2 0 1 0 14 16H2 M17.7 7.7A2.5 2.5 0 1 1 19.5 12H2',
  share: 'M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7 M16 6l-4-4-4 4 M12 2v13',
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const I = (name, x, y, size, color, o = {}) =>
  G(`Icon_${o.id || cap(name)}`, P('Vector', ICON[name], { stroke: color, sw: o.sw || 2, fill: o.fill, fo: o.fo }), {
    transform: `translate(${n2(x)} ${n2(y)}) scale(${(size / 24).toFixed(4)})`,
  });

// ── Vector garment illustrations (100×100 grid) ──────────────────────────────
const GARMENT = {
  tee: 'M32 14 L14 26 L22 42 L31 38 L31 88 L69 88 L69 38 L78 42 L86 26 L68 14 Q50 26 32 14 Z',
  knit: 'M32 14 L14 26 L22 42 L31 38 L31 88 L69 88 L69 38 L78 42 L86 26 L68 14 L58 14 L50 24 L42 14 Z',
  hoodie: 'M34 16 Q50 2 66 16 L84 26 L88 62 L78 64 L72 42 L72 90 L28 90 L28 42 L22 64 L12 62 L16 26 Z',
  pants: 'M30 10 H70 L75 90 H56 L50 38 L44 90 H25 Z',
  shoe: 'M10 64 Q12 50 28 52 L46 56 Q60 42 72 54 L90 62 Q94 72 86 76 H14 Q8 72 10 64 Z',
  jacket: 'M30 14 L12 26 L16 90 H45 V32 L50 24 L55 32 V90 H84 L88 26 L70 14 L60 12 L50 24 L40 12 Z',
  bag: 'M20 40 H80 L86 90 H14 Z',
};
const DETAIL = {
  tee: 'M42 16 Q50 22 58 16',
  knit: 'M42 14 L50 24 L58 14 M50 24 V36 M31 80 H69',
  hoodie: 'M45 20 V34 M55 20 V34 M28 76 H72 M38 56 H62',
  pants: 'M30 18 H70 M50 18 V38',
  shoe: 'M12 70 H88 M40 56 L44 62 M48 54 L52 60',
  jacket: 'M50 24 V90 M22 62 H38 M62 62 H78',
  bag: 'M34 40 V32 A16 16 0 0 1 66 32 V40',
};
const garment = (id, type, x, y, size, color, o = {}) => {
  const line = o.line || B.darkPlum;
  const sw = (1.3 * 100) / size;
  return G(id, [
    P('Silhouette', GARMENT[type], { fill: color, stroke: line, sw }),
    P('Stitch_Detail', DETAIL[type], { stroke: line, sw, opacity: type === 'bag' ? 1 : 0.45 }),
  ], { transform: `translate(${n2(x)} ${n2(y)}) scale(${(size / 100).toFixed(4)})` });
};
const tile = (id, x, y, w, h, type, color, o = {}) => {
  const size = Math.min(w, h) * (o.scale || 0.8);
  return G(id, [
    R('Tile_Background', x, y, w, h, { rx: o.rx || 12, fill: o.bg || B.softCream, stroke: o.stroke }),
    garment('Garment_Vector', type, x + (w - size) / 2, y + (h - size) / 2, size, color, o),
  ]);
};

// ── Shared components ────────────────────────────────────────────────────────
const statusBar = (t) => {
  const c = t.text;
  return G('Status_Bar', [
    T('Time', 32, 31, '9:41', { size: 15, weight: 600, fill: c }),
    G('Cellular_Signal', [4, 6, 8, 10].map((h, i) => R(`Signal_Bar_${i + 1}`, 289 + i * 5, 30 - h, 3, h, { rx: 1, fill: c }))),
    G('WiFi', [
      P('Wifi_Arc_Outer', 'M311.5 22a10.5 10.5 0 0 1 14 0', { stroke: c, sw: 1.8 }),
      P('Wifi_Arc_Inner', 'M314.7 25.4a5.5 5.5 0 0 1 7.6 0', { stroke: c, sw: 1.8 }),
      C('Wifi_Dot', 318.5, 28.8, 1.6, { fill: c }),
    ]),
    G('Battery', [
      R('Battery_Body', 332, 20, 25, 12, { rx: 3.5, stroke: c, opacity: 0.5 }),
      R('Battery_Level', 334, 22, 19, 8, { rx: 2, fill: c }),
      R('Battery_Cap', 358.5, 24, 1.8, 4, { rx: 0.9, fill: c, opacity: 0.5 }),
    ]),
  ]);
};
const homeIndicator = (t) => R('Home_Indicator', 120.5, 799, 134, 5, { rx: 2.5, fill: t.text });

const bottomNav = (t, active) => {
  const tabs = [['Home', 'home'], ['Wardrobe', 'shirt'], ['Outfit', 'sparkles'], ['Community', 'people'], ['Account', 'person']];
  const kids = [R('Nav_Surface', 0, 728, 375, 84, { fill: t.surface }), R('Nav_Top_Hairline', 0, 728, 375, 1, { fill: t.border })];
  tabs.forEach(([key, icon], i) => {
    const cx = 37.5 + i * 75;
    const on = key === active;
    if (key === 'Outfit') {
      kids.push(G('Tab_Outfit_AI_Center_Badge', [
        C('Badge_Glow', cx, 740, 31, { fill: t.accent, opacity: 0.12 }),
        C('Badge_Circle', cx, 740, 24, { fill: t.accent, stroke: on ? B.peach : t.border, sw: 1.5 }),
        I('sparkles', cx - 11, 729, 22, t.onAccent, { fill: on ? t.onAccent : undefined }),
        T('Tab_Label', cx, 782, 'Outfit', { size: 10, weight: 800, fill: on ? t.accent : t.muted, anchor: 'middle', opacity: on ? 1 : 0.75 }),
      ]));
      return;
    }
    const col = on ? t.accent : t.muted;
    kids.push(G(`Tab_${key}`, [
      on && R('Active_Indicator_Pill', cx - 10, 729, 20, 3, { rx: 1.5, fill: t.accent }),
      I(icon, cx - 11, 744, 22, col, { fill: on ? col : undefined, fo: on ? 0.2 : undefined, sw: on ? 2.2 : 1.8 }),
      T('Tab_Label', cx, 782, key, { size: 10, weight: on ? 800 : 600, fill: col, anchor: 'middle', opacity: on ? 1 : 0.75 }),
    ]));
  });
  return G('Bottom_Navigation_Bar', kids);
};

const sec = (id, x, y, label, t, o = {}) =>
  T(id, x, y, label, { size: 11, weight: 800, fill: t.muted, ls: 1.3, anchor: o.anchor });

const card = (id, x, y, w, h, t, kids, o = {}) =>
  G(id, [R('Card_Surface', x, y, w, h, { rx: o.rx || 18, fill: o.fill || t.surface, stroke: o.stroke || t.border, shadow: o.shadow !== false }), kids]);

const btn = (id, x, y, w, h, label, o = {}) => {
  const t = o.t || LIGHT;
  const v = o.variant || 'primary';
  const size = o.size || 14;
  const sty = {
    primary: { fill: t.accent, txt: t.onAccent },
    secondary: { fill: t.surface, stroke: t.border, txt: t.text },
    soft: { fill: t.badge, txt: t.text },
    peach: { fill: B.peach, txt: B.darkPlum },
    ghostDark: { fill: 'none', stroke: B.softLilac, txt: B.softCream },
  }[v];
  const isz = o.iconSize || size + 3;
  const cw = tw(label, size, 800) + (o.icon ? isz + 6 : 0);
  const sx = x + (w - cw) / 2;
  const by = y + h / 2 + size * 0.36;
  return G(id, [
    R('Button_Surface', x, y, w, h, { rx: o.rx !== undefined ? o.rx : h / 2, fill: sty.fill, stroke: sty.stroke }),
    o.icon && I(o.icon, sx, y + (h - isz) / 2, isz, sty.txt, { sw: 2.2 }),
    T('Button_Label', o.icon ? sx + isz + 6 : x + w / 2, by, label, { size, weight: 800, fill: sty.txt, anchor: o.icon ? undefined : 'middle' }),
  ]);
};

const pillW = (label, o = {}) => Math.round(tw(label, o.size || 12, 700) + 2 * (o.px !== undefined ? o.px : 14));
const pill = (id, x, y, label, o = {}) => {
  const t = o.t || LIGHT;
  const size = o.size || 12;
  const h = o.h || 30;
  const w = pillW(label, o);
  const on = o.active;
  return G(id, [
    R('Pill_Surface', x, y, w, h, { rx: h / 2, fill: on ? t.accent : t.surface, stroke: on ? t.accent : t.border }),
    T('Pill_Label', x + w / 2, y + h / 2 + size * 0.36, label, { size, weight: 700, fill: on ? t.onAccent : t.text, anchor: 'middle' }),
  ]);
};
const flow = (prefix, items, x, y, maxW, o = {}) => {
  let cx = x;
  let cy = y;
  const h = o.h || 30;
  const gap = o.gap || 6;
  const out = items.map((it) => {
    const w = pillW(it.label, o);
    if (cx > x && cx + w > x + maxW) { cx = x; cy += h + gap; }
    const s = pill(`Pill_${it.label}`, cx, cy, it.label, { ...o, active: it.active });
    cx += w + gap;
    return s;
  });
  return { svg: G(prefix, out), h: cy + h - y };
};

const toggle = (id, x, y, on, t) => G(id, [
  R('Switch_Track', x, y, 46, 28, { rx: 14, fill: on ? t.accent : t.border }),
  C('Switch_Thumb', on ? x + 32 : x + 14, y + 14, 11, { fill: on ? t.onAccent : t.mode === 'dark' ? B.softCream : B.white }),
]);

const backHeader = (t, title, right) => G('Header_Bar', [
  G('Back_Button', [C('Button_Circle', 39, 77, 19, { fill: t.surface, stroke: t.border }), I('arrowLeft', 30, 68, 18, t.text)]),
  T('Screen_Title', 70, 84, title, { size: 20, weight: 800, fill: t.text, ls: -0.3 }),
  right,
]);

const svgDoc = (screenId, t, body) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="375" height="812" viewBox="0 0 375 812" fill="none">
<title>${screenId}</title>
<defs>
<filter id="Card_Shadow" x="-10%" y="-10%" width="120%" height="135%" color-interpolation-filters="sRGB">
<feDropShadow dx="0" dy="4" stdDeviation="7" flood-color="${B.darkPlum}" flood-opacity="${t.mode === 'dark' ? 0.4 : 0.07}"/>
</filter>
<clipPath id="Screen_Clip"><rect width="375" height="812"/></clipPath>
</defs>
<g id="${screenId}" clip-path="url(#Screen_Clip)">
${flat(body)}
</g>
</svg>
`;

// ═════════════════════════════════════════════════════════════════════════════
// 01 — Onboarding: name + style
// ═════════════════════════════════════════════════════════════════════════════
function s01() {
  const t = LIGHT;
  const styles = [
    ['Easy & casual', 'Relaxed everyday', true], ['Clean & minimal', 'Simple, considered', true],
    ['Streetwear', 'Statement layers', false], ['Classic', 'Timeless polish', true],
    ['Creative', 'Colour & texture', false], ['Soft & romantic', 'Flowy details', false],
  ];
  const cw = (335 - 8) / 2;
  return ['Screen_01_Onboarding_Name_and_Style', t, [
    R('Background', 0, 0, 375, 812, { fill: t.bg }),
    statusBar(t),
    G('Header_Bar', [
      G('Brand_Logo', [
        R('Brand_Mark', 20, 58, 34, 34, { rx: 11, fill: B.peach }),
        T('Brand_Mark_Letter', 37, 81, 'S', { size: 18, weight: 900, fill: B.darkPlum, anchor: 'middle' }),
        T('Brand_Wordmark', 63, 81, [['Style', B.darkPlum], ['Sense', B.mediumPlum]], { size: 20, weight: 800 }),
      ]),
      G('Skip_Link', [
        T('Skip_Label', 355, 80, 'Skip for now', { size: 13, fill: t.muted, anchor: 'end' }),
        R('Skip_Underline', 273, 84, 82, 1, { fill: t.muted }),
      ]),
    ]),
    G('Progress_Bar', [
      R('Progress_Track', 20, 104, 335, 4, { rx: 2, fill: t.border }),
      R('Progress_Fill', 20, 104, 335 * (2 / 6), 4, { rx: 2, fill: t.accent }),
    ]),
    G('Intro_Block', [
      G('Icon_Bubble', [R('Bubble', 163.5, 128, 48, 48, { rx: 15, fill: B.peach }), I('person', 175.5, 140, 24, B.darkPlum)]),
      T('Eyebrow', 187.5, 202, 'FIRST THINGS FIRST', { size: 11.5, weight: 800, fill: t.muted, ls: 1.4, anchor: 'middle' }),
      T('Title', 187.5, 236, 'What should we call you?', { size: 24, weight: 900, fill: t.text, ls: -0.5, anchor: 'middle' }),
      TM('Body', 187.5, 262, ['Your StyleSense space should feel', 'personal from the very beginning.'], 19, { size: 14, fill: t.muted, anchor: 'middle' }),
    ]),
    G('Name_Input_Field', [
      T('Field_Label', 22, 318, 'Your name', { size: 13, weight: 700, fill: t.text }),
      R('Input_Surface', 20, 328, 335, 52, { rx: 14, fill: B.white, stroke: B.darkPlum, sw: 1.5 }),
      T('Input_Value', 36, 360, 'Alex', { size: 17, weight: 500, fill: t.text }),
      R('Text_Caret', 74, 343, 1.5, 22, { fill: B.mediumPlum }),
      G('Valid_Check', [C('Check_Circle', 331, 354, 11, { fill: B.peach }), I('check', 324, 347, 14, B.darkPlum, { sw: 2.6 })]),
    ]),
    G('Style_Preference_Section', [
      T('Section_Title', 20, 420, 'What feels most like you, Alex?', { size: 17, weight: 800, fill: t.text }),
      T('Section_Hint', 20, 440, 'Pick as many as you like — no wrong answers.', { size: 12.5, fill: t.muted }),
      G('Style_Choice_Grid', styles.map(([label, note, on], i) => {
        const x = 20 + (i % 2) * (cw + 8);
        const y = 454 + Math.floor(i / 2) * 68;
        return G(`Style_Choice_${label}`, [
          R('Choice_Surface', x, y, cw, 60, { rx: 14, fill: on ? B.softLilac : B.white, stroke: on ? B.darkPlum : B.softLilac, sw: 1.5 }),
          R('Checkbox', x + 12, y + 19, 22, 22, { rx: 7, fill: on ? B.darkPlum : 'none', stroke: on ? B.darkPlum : B.softLilac, sw: 1.5 }),
          on && I('check', x + 16, y + 23, 14, B.paleYellow, { sw: 2.8 }),
          T('Choice_Label', x + 44, y + 27, label, { size: 13.5, weight: 800, fill: t.text }),
          T('Choice_Note', x + 44, y + 44, note, { size: 11, fill: t.muted }),
        ]);
      })),
    ]),
    G('Footer_Navigation', [
      R('Footer_Hairline', 20, 712, 335, 1, { fill: t.border }),
      G('Back_Button', [I('arrowLeft', 20, 743, 18, t.muted), T('Back_Label', 44, 757, 'Back', { size: 14, weight: 700, fill: t.muted })]),
      T('Step_Counter', 168, 757, '2 of 4', { size: 12, fill: t.muted, anchor: 'middle' }),
      btn('Continue_Button', 225, 730, 130, 44, 'Continue', { t, icon: 'arrowRight', size: 14 }),
    ]),
    homeIndicator(t),
  ]];
}

// ═════════════════════════════════════════════════════════════════════════════
// 02 — Home dashboard
// ═════════════════════════════════════════════════════════════════════════════
function s02() {
  const t = LIGHT;
  const tw3 = 95;
  const qa = [['Add Clothes', 'camera', B.softLilac], ['Plan Day', 'calendar', B.peach], ['Pack Trip', 'suitcase', B.softLilac], ['Community', 'people', B.peach]];
  const stats = [['36', 'Clean'], ['12', 'Needs Wash'], ['82%', 'Re-wear rate']];
  return ['Screen_02_Home_Dashboard', t, [
    R('Background', 0, 0, 375, 812, { fill: t.bg }),
    statusBar(t),
    G('Header_Bar', [
      T('Greeting', 20, 78, 'Good morning,', { size: 14, fill: t.muted }),
      T('User_Name', 20, 106, 'Alex', { size: 28, weight: 900, fill: t.text, ls: -0.6 }),
      G('Notifications_Button', [
        C('Button_Circle', 297, 88, 20, { fill: t.surface, stroke: t.border }), I('bell', 287, 78, 20, t.text),
        C('Unread_Dot', 310, 74, 5, { fill: B.peach, stroke: B.darkPlum, sw: 1.2 }),
      ]),
      G('Avatar', [C('Avatar_Circle', 343, 88, 20, { fill: B.softLilac }), T('Avatar_Initials', 343, 93, 'AR', { size: 13, weight: 800, fill: B.darkPlum, anchor: 'middle' })]),
    ]),
    G('Weather_Card_OpenWeatherMap', [
      R('Card_Surface', 20, 124, 335, 108, { rx: 20, fill: B.darkPlum, shadow: true }),
      C('Decor_Orb', 318, 180, 48, { fill: B.mediumPlum, opacity: 0.55 }),
      I('cloudSun', 290, 154, 54, B.peach, { sw: 1.7 }),
      T('Location', 36, 150, 'Makati City, PH', { size: 12, weight: 600, fill: B.softLilac }),
      T('Temperature', 36, 194, '29°C', { size: 40, weight: 900, fill: B.paleYellow, ls: -1 }),
      T('Condition', 140, 176, 'Humid · Feels 33°C', { size: 12.5, weight: 600, fill: B.softCream }),
      T('Wind_Humidity', 140, 194, 'Wind 12 km/h · RH 78%', { size: 11.5, fill: B.softLilac }),
      G('Source_Tag', [R('Tag_Surface', 36, 206, 124, 18, { rx: 9, fill: B.mediumPlum }), T('Tag_Label', 98, 219, 'via OpenWeatherMap', { size: 10, weight: 700, fill: B.paleYellow, anchor: 'middle' })]),
    ]),
    sec('Section_Label_Todays_Pick', 20, 260, "TODAY'S HYBRID PICK", t),
    T('See_All_Link', 355, 260, 'See all', { size: 12.5, weight: 700, fill: t.text, anchor: 'end' }),
    card('Todays_Outfit_Card', 20, 272, 335, 168, t, [
      G('Garment_Tiles', [
        tile('Tile_Top', 36, 288, tw3, 84, 'tee', B.white),
        tile('Tile_Bottom', 36 + tw3 + 8, 288, tw3, 84, 'pants', B.mediumPlum),
        tile('Tile_Shoes', 36 + (tw3 + 8) * 2, 288, tw3, 84, 'shoe', B.white),
      ]),
      G('Hybrid_Score_Badge', [R('Badge_Surface', 251, 294, 80, 22, { rx: 11, fill: B.peach }), T('Badge_Label', 291, 309, 'Hybrid 87%', { size: 11, weight: 800, fill: B.darkPlum, anchor: 'middle' })]),
      T('Outfit_Name', 36, 398, 'Casual · White Tee & Chinos', { size: 14.5, weight: 800, fill: t.text }),
      T('Outfit_Meta', 36, 418, 'Content 88% · Collab 85% · 29°C ready', { size: 11.5, fill: t.muted }),
      G('Open_Button', [C('Circle', 323, 406, 15, { fill: B.darkPlum }), I('arrowRight', 315.5, 398.5, 15, B.paleYellow, { sw: 2.4 })]),
    ]),
    sec('Section_Label_Quick_Actions', 20, 468, 'QUICK ACTIONS', t),
    G('Quick_Actions_Grid', qa.map(([label, icon, bg], i) => {
      const x = 20 + i * 86;
      const cx = x + 38;
      return card(`Quick_Action_${label}`, x, 480, 76, 84, t, [
        C('Icon_Circle', cx, 510, 18, { fill: bg }), I(icon, cx - 9, 501, 18, B.darkPlum),
        T('Action_Label', cx, 548, label, { size: 10.5, weight: 700, fill: t.text, anchor: 'middle' }),
      ]);
    })),
    card('Wardrobe_Health_Card', 20, 580, 335, 128, t, [
      T('Card_Title', 36, 606, 'Wardrobe Health', { size: 14.5, weight: 800, fill: t.text }),
      T('Item_Count', 339, 606, '48 items', { size: 12, fill: t.muted, anchor: 'end' }),
      G('Stat_Boxes', stats.map(([v, l], i) => {
        const x = 36 + i * 103;
        return G(`Stat_${l}`, [
          R('Stat_Surface', x, 618, 95, 48, { rx: 12, fill: t.bg, stroke: t.border }),
          T('Stat_Value', x + 12, 640, v, { size: 18, weight: 900, fill: t.text }),
          T('Stat_Label', x + 12, 657, l, { size: 10.5, fill: t.muted }),
        ]);
      })),
      G('Sustainability_Meter', [
        I('leaf', 36, 680, 14, B.mediumPlum),
        T('Meter_Label', 56, 691, 'Sustainability score', { size: 11.5, weight: 600, fill: t.text }),
        R('Meter_Track', 190, 684, 112, 8, { rx: 4, fill: B.softLilac }),
        R('Meter_Fill', 190, 684, 92, 8, { rx: 4, fill: B.darkPlum }),
        T('Meter_Value', 339, 692, '82%', { size: 11.5, weight: 800, fill: t.text, anchor: 'end' }),
      ]),
    ]),
    bottomNav(t, 'Home'),
    homeIndicator(t),
  ]];
}

// ═════════════════════════════════════════════════════════════════════════════
// 03 — Wardrobe manager + unified Filter By
// ═════════════════════════════════════════════════════════════════════════════
function s03() {
  const t = LIGHT;
  const px = 36;
  const maxW = 303;
  const po = { t, size: 11, h: 28, px: 12, gap: 6 };
  let cy = 250;
  const panelKids = [];
  const section = (id, label, items) => {
    panelKids.push(sec(`${id}_Label`, px, cy + 11, label, t));
    cy += 20;
    const f = flow(`${id}_Options`, items, px, cy, maxW, po);
    panelKids.push(f.svg);
    cy += f.h + 14;
  };
  section('Category', 'CATEGORY', ['TOP', 'BOTTOM', 'SHOES', 'OUTERWEAR', 'ACCESSORIES'].map((l) => ({ label: l, active: l === 'TOP' })));
  section('Occasion', 'OCCASION', ['Academic', 'Office', 'Formal', 'Casual', 'Workout'].map((l) => ({ label: l, active: false })));
  section('Laundry_Status', 'LAUNDRY STATUS', ['CLEAN', 'NEEDS_WASHING'].map((l) => ({ label: l, active: l === 'CLEAN' })));
  panelKids.push(G('Favorites_Only_Row', [
    R('Row_Divider', px, cy - 4, maxW, 1, { fill: t.border }),
    I('heart', px, cy + 8, 16, t.text),
    T('Row_Label', px + 24, cy + 21, 'Favorites Only', { size: 13, weight: 700, fill: t.text }),
    toggle('Favorites_Switch', 293, cy + 2, false, t),
  ]));
  cy += 34;
  const panelH = cy + 12 - 236;
  const cardsY = 236 + panelH + 14;
  const cw = (335 - 8) / 2;
  const garments = [
    ['White Cotton Tee', 'tee', B.white, 'TOP · White · Academic', true],
    ['Lilac Knit Polo', 'knit', B.softLilac, 'TOP · Lilac · Office', false],
  ];
  return ['Screen_03_Wardrobe', t, [
    R('Background', 0, 0, 375, 812, { fill: t.bg }),
    statusBar(t),
    G('Header_Bar', [
      T('Screen_Title', 20, 92, 'Wardrobe', { size: 28, weight: 900, fill: t.text, ls: -0.6 }),
      T('Item_Count', 20, 114, '48 items · 36 clean', { size: 13, fill: t.muted }),
      G('Search_Button', [C('Button_Circle', 335, 86, 20, { fill: t.surface, stroke: t.border }), I('search', 326, 77, 18, t.text)]),
    ]),
    G('Capture_Actions', [
      btn('Take_Photo_Camera_Button', 20, 130, 164, 46, 'Take Photo (Camera)', { t, icon: 'camera', size: 12, iconSize: 15, rx: 14 }),
      btn('Upload_From_Gallery_Button', 191, 130, 164, 46, 'Upload from Gallery', { t, variant: 'secondary', icon: 'image', size: 12, iconSize: 15, rx: 14 }),
    ]),
    G('Filter_Bar', [
      G('Filter_By_Dropdown_Button', [
        R('Button_Surface', 20, 188, 150, 38, { rx: 19, fill: B.darkPlum }),
        I('options', 34, 199, 16, B.paleYellow, { sw: 2.4 }),
        T('Button_Label', 56, 212, 'Filter By (2)', { size: 13.5, weight: 800, fill: B.paleYellow }),
        I('chevronUp', 146, 199, 16, B.paleYellow, { sw: 2.4 }),
      ]),
      T('Reset_Link', 184, 212, 'Reset', { size: 12.5, weight: 600, fill: t.muted }),
      T('Sort_Label', 355, 212, 'Sort: Recent', { size: 12.5, weight: 600, fill: t.text, anchor: 'end' }),
    ]),
    card('Filter_By_Dropdown_Panel', 20, 236, 335, panelH, t, panelKids),
    G('Garment_Grid', garments.map(([name, type, color, meta, fav], i) => {
      const x = 20 + i * (cw + 8);
      const y = cardsY;
      return card(`Garment_Card_${i + 1}`, x, y, cw, 152, t, [
        tile('Garment_Image', x + 8, y + 8, cw - 16, 98, type, color, { scale: 0.86 }),
        G('Favorite_Button', [C('Button_Circle', x + cw - 22, y + 22, 12, { fill: B.white, stroke: t.border }), I('heart', x + cw - 29, y + 15, 14, B.darkPlum, { fill: fav ? B.darkPlum : undefined })]),
        G('Laundry_Badge_Clean', [R('Badge_Surface', x + 14, y + 82, 48, 18, { rx: 9, fill: B.softLilac }), T('Badge_Label', x + 38, y + 95, 'CLEAN', { size: 9.5, weight: 800, fill: B.darkPlum, anchor: 'middle' })]),
        T('Garment_Name', x + 12, y + 126, name, { size: 13.5, weight: 800, fill: t.text }),
        T('Garment_Meta', x + 12, y + 143, meta, { size: 11, fill: t.muted }),
      ]);
    })),
    bottomNav(t, 'Wardrobe'),
    homeIndicator(t),
  ]];
}

// ═════════════════════════════════════════════════════════════════════════════
// 04 — Add Clothes: ResNet-50 classification + CIELAB K-Means (K=2)
// ═════════════════════════════════════════════════════════════════════════════
function s04() {
  const t = LIGHT;
  const probs = [['TOP', 96.4, B.darkPlum], ['OUTERWEAR', 2.8, B.mediumPlum], ['ACCESSORIES', 0.8, B.mediumPlum]];
  const swatches = [
    ['Medium Plum', B.mediumPlum, '#4B1D6F · L* 22.1  a* 37.4  b* −38.9', '68%'],
    ['Soft Cream', B.softCream, '#FDF3D2 · L* 96.0  a* 0.2  b* 14.9', '32%'],
  ];
  const corner = (x, y, dx, dy) => `M${x} ${y + dy * 14} V${y} H${x + dx * 14}`;
  return ['Screen_04_Add_Clothes_CNN_KMeans', t, [
    R('Background', 0, 0, 375, 812, { fill: t.bg }),
    statusBar(t),
    backHeader(t, 'Add Clothes', G('AI_Tagging_Badge', [R('Badge_Surface', 271, 65, 84, 24, { rx: 12, fill: B.peach }), I('sparkles', 279, 70, 14, B.darkPlum), T('Badge_Label', 297, 81, 'AI Tagging', { size: 11, weight: 800, fill: B.darkPlum })])),
    G('Photo_Preview_Card', [
      R('Card_Surface', 20, 108, 335, 236, { rx: 22, fill: B.softCream, stroke: t.border, shadow: true }),
      G('ResNet50_Detection_Chip', [R('Chip_Surface', 110, 122, 140, 22, { rx: 11, fill: B.darkPlum }), I('cpu', 118, 126, 14, B.paleYellow), T('Chip_Label', 137, 137, 'ResNet-50 · 96.4%', { size: 11, weight: 800, fill: B.paleYellow })]),
      G('Detection_Bounding_Box', [
        R('Box_Dashed', 110, 152, 155, 138, { rx: 10, stroke: B.darkPlum, sw: 1.2, dash: '6 5' }),
        P('Corner_TL', corner(110, 152, 1, 1), { stroke: B.darkPlum, sw: 3 }),
        P('Corner_TR', corner(265, 152, -1, 1), { stroke: B.darkPlum, sw: 3 }),
        P('Corner_BL', corner(110, 290, 1, -1), { stroke: B.darkPlum, sw: 3 }),
        P('Corner_BR', corner(265, 290, -1, -1), { stroke: B.darkPlum, sw: 3 }),
      ]),
      garment('Captured_Garment_Hoodie', 'hoodie', 125.5, 157, 124, B.mediumPlum, { line: B.darkPlum }),
      R('Hoodie_Cream_Band', 160.2, 247, 54.6, 8, { rx: 2, fill: B.softCream }),
      btn('Retake_Camera_Button', 34, 300, 150, 32, 'Retake (Camera)', { t, variant: 'secondary', icon: 'camera', size: 11.5, iconSize: 14 }),
      btn('Upload_From_Gallery_Button', 191, 300, 150, 32, 'Upload from Gallery', { t, variant: 'secondary', icon: 'image', size: 11.5, iconSize: 14 }),
    ]),
    G('Moderation_Passed_Strip', [
      R('Strip_Surface', 20, 356, 335, 42, { rx: 14, fill: B.softLilac }),
      I('shield', 32, 366, 22, B.darkPlum),
      T('Strip_Title', 62, 374, 'Moderation passed', { size: 12.5, weight: 800, fill: B.darkPlum }),
      T('Strip_Detail', 62, 390, 'is_safe_garment: true · garment detected', { size: 11, fill: B.mediumPlum }),
      C('Check_Circle', 335, 377, 11, { fill: B.darkPlum }), I('check', 328, 370, 14, B.paleYellow, { sw: 2.8 }),
    ]),
    card('CNN_Classification_Card', 20, 410, 335, 122, t, [
      sec('Card_Label', 36, 434, 'CNN CLASSIFICATION · RESNET-50', t),
      T('Input_Spec', 339, 434, '224×224', { size: 10.5, fill: t.muted, anchor: 'end' }),
      T('Predicted_Category', 36, 462, [['TOP', B.darkPlum, 900], ['  · Hoodie', B.mediumPlum, 600]], { size: 22 }),
      G('Softmax_Probabilities', probs.map(([label, p, col], i) => {
        const y = 476 + i * 18;
        return G(`Probability_${label}`, [
          T('Class_Label', 36, y + 8, label, { size: 10.5, weight: 700, fill: t.text }),
          R('Bar_Track', 124, y, 170, 7, { rx: 3.5, fill: B.softLilac }),
          R('Bar_Fill', 124, y, Math.max(4, 170 * p / 100), 7, { rx: 3.5, fill: col }),
          T('Class_Percent', 339, y + 8, `${p}%`, { size: 11, weight: 800, fill: t.text, anchor: 'end' }),
        ]);
      })),
    ]),
    card('CIELAB_KMeans_Color_Card', 20, 544, 335, 144, t, [
      sec('Card_Label', 36, 568, 'COLOR EXTRACTION · CIELAB K-MEANS', t),
      G('K_Value_Chip', [R('Chip_Surface', 293, 556, 46, 18, { rx: 9, fill: B.peach }), T('Chip_Label', 316, 569, 'K = 2', { size: 10, weight: 800, fill: B.darkPlum, anchor: 'middle' })]),
      G('Cluster_Swatches', swatches.map(([name, hex, lab, pct], i) => {
        const y = 584 + i * 40;
        return G(`Cluster_${i + 1}_${name}`, [
          C('Swatch', 54, y + 16, 15, { fill: hex, stroke: B.softLilac, sw: 1.5 }),
          T('Color_Name', 80, y + 13, name, { size: 13, weight: 800, fill: t.text }),
          T('LAB_Values', 80, y + 29, lab, { size: 10.5, fill: t.muted }),
          T('Cluster_Share', 339, y + 21, pct, { size: 15, weight: 900, fill: t.text, anchor: 'end' }),
        ]);
      })),
      G('Cluster_Proportion_Bar', [
        R('Share_Cluster_1', 36, 668, 303 * 0.68 - 2, 8, { rx: 4, fill: B.mediumPlum }),
        R('Share_Cluster_2', 36 + 303 * 0.68, 668, 303 * 0.32, 8, { rx: 4, fill: B.softCream, stroke: B.softLilac }),
      ]),
    ]),
    btn('Save_To_Wardrobe_Button', 20, 704, 335, 52, 'Save to Wardrobe', { t, icon: 'check', size: 15, rx: 16 }),
    T('Helper_Text', 187.5, 778, 'Auto-tagged by AI · every field stays editable', { size: 11, fill: t.muted, anchor: 'middle' }),
    homeIndicator(t),
  ]];
}

// ═════════════════════════════════════════════════════════════════════════════
// 05 — Hybrid outfit recommender
// ═════════════════════════════════════════════════════════════════════════════
function s05() {
  const t = LIGHT;
  const occ = ['Academic', 'Office', 'Formal', 'Casual', 'Workout'];
  let ox = 20;
  const occPills = occ.map((l, i) => { const s = pill(`Occasion_${l}`, ox, 164, l, { t, size: 11, h: 28, px: 10, active: i === 0 }); ox += pillW(l, { size: 11, px: 10 }) + 6; return s; });
  const r = 32;
  const circ = 2 * Math.PI * r;
  const tileW = (303 - 24) / 4;
  const tiles = [['Top', 'knit', B.softLilac], ['Bottom', 'pants', B.darkPlum], ['Shoes', 'shoe', B.white], ['Accessory', 'bag', B.peach]];
  const actW = (303 - 18) / 4;
  const actions = [['Like', 'heart', 'secondary'], ['Dislike', 'x', 'secondary'], ['Save', 'bookmark', 'secondary'], ['Wear', 'check', 'primary']];
  const bar = (id, y, label, weight, val, col) => G(id, [
    T('Score_Label', 124, y, [[label, B.darkPlum, 700], [`  ×${weight}`, B.mediumPlum, 600]], { size: 11.5 }),
    T('Score_Value', 339, y, `${val}%`, { size: 11.5, weight: 900, fill: t.text, anchor: 'end' }),
    R('Bar_Track', 124, y + 6, 215, 7, { rx: 3.5, fill: B.softLilac }),
    R('Bar_Fill', 124, y + 6, 215 * val / 100, 7, { rx: 3.5, fill: col }),
  ]);
  const mini = (i, x, rank, pct, occLabel, items) => card(`Alternative_Outfit_Card_${rank}`, x, 644, 163.5, 72, t, [
    tile('Mini_Tile_1', x + 10, 660, 40, 40, items[0][0], items[0][1], { rx: 10 }),
    tile('Mini_Tile_2', x + 54, 660, 40, 40, items[1][0], items[1][1], { rx: 10 }),
    T('Rank', x + 104, 672, `#${rank}`, { size: 11, weight: 800, fill: t.muted }),
    T('Hybrid_Score', x + 104, 693, `${pct}%`, { size: 18, weight: 900, fill: t.text }),
    T('Occasion', x + 104, 707, occLabel, { size: 10.5, fill: t.muted }),
  ]);
  return ['Screen_05_Hybrid_Outfit_Recommender', t, [
    R('Background', 0, 0, 375, 812, { fill: t.bg }),
    statusBar(t),
    G('Header_Bar', [
      T('Screen_Title', 20, 86, 'Outfit Recommendations', { size: 22, weight: 900, fill: t.text, ls: -0.5 }),
      T('Subtitle', 20, 106, 'Top-3 Hybrid picks for today', { size: 12.5, fill: t.muted }),
      G('Refresh_Button', [C('Button_Circle', 337, 88, 18, { fill: t.surface, stroke: t.border }), I('sparkles', 329, 80, 16, t.text)]),
    ]),
    G('Weather_Badge_OpenWeatherMap', [
      R('Badge_Surface', 20, 120, 335, 34, { rx: 17, fill: B.darkPlum }),
      I('sun', 32, 128, 18, B.peach),
      T('Weather_Label', 58, 141.5, [['Makati · 29°C', B.paleYellow, 800], ['  Humid · 12 km/h', B.softLilac, 500]], { size: 12.5 }),
      T('Source_Label', 343, 141, 'OpenWeatherMap', { size: 10, weight: 700, fill: B.peach, anchor: 'end' }),
    ]),
    G('Occasion_Filter_Pills', occPills),
    card('No_New_Clothes_Mode_Card', 20, 204, 335, 58, t, [
      C('Icon_Circle', 50, 233, 16, { fill: B.peach }), I('leaf', 42, 225, 16, B.darkPlum),
      T('Toggle_Title', 76, 229, 'No New Clothes Mode', { size: 14, weight: 800, fill: t.text }),
      T('Toggle_Subtitle', 76, 246, 'Re-wear only what you already own', { size: 11, fill: t.muted }),
      toggle('No_New_Clothes_Switch', 293, 219, true, t),
    ]),
    card('Top_Pick_Outfit_Card_1', 20, 274, 335, 340, t, [
      G('Top_Pick_Badge', [R('Badge_Surface', 36, 290, 206, 24, { rx: 12, fill: B.peach }), T('Badge_Label', 139, 306, 'TOP PICK · BEST HYBRID MATCH', { size: 10, weight: 800, fill: B.darkPlum, ls: 0.4, anchor: 'middle' })]),
      T('Rank_Label', 339, 306, '#1 of 3', { size: 11.5, weight: 700, fill: t.muted, anchor: 'end' }),
      T('Outfit_Name', 36, 338, 'Academic Look · Lilac Knit & Chinos', { size: 14, weight: 800, fill: t.text }),
      G('Garment_Tiles', tiles.map(([n, type, col], i) => tile(`Tile_${n}`, 36 + i * (tileW + 8), 350, tileW, 68, type, col))),
      G('Hybrid_Score_Ring', [
        C('Ring_Track', 72, 466, r, { stroke: B.softLilac, sw: 7 }),
        C('Ring_Progress_87', 72, 466, r, { stroke: B.darkPlum, sw: 7, cap: 'round', dash: `${(circ * 0.87).toFixed(2)} ${circ.toFixed(2)}`, transform: 'rotate(-90 72 466)' }),
        T('Ring_Value', 72, 471, '87%', { size: 18, weight: 900, fill: t.text, anchor: 'middle' }),
        T('Ring_Caption', 72, 486, 'HYBRID', { size: 8, weight: 800, fill: t.muted, ls: 1, anchor: 'middle' }),
      ]),
      G('Score_Breakdown', [
        bar('Content_Based_Score', 446, 'Content-Based', '0.55', 88, B.darkPlum),
        bar('Collaborative_Score', 480, 'Collaborative', '0.45', 85, B.mediumPlum),
      ]),
      G('Formula_Strip', [
        R('Strip_Surface', 36, 508, 303, 26, { rx: 8, fill: t.bg, stroke: t.border }),
        T('Formula', 187.5, 525, 'Hybrid = 0.55 × 88 + 0.45 × 85 = 86.65 → 87%', { size: 10.5, weight: 700, fill: t.text, anchor: 'middle' }),
      ]),
      G('Explainability_Reasons', [
        G('Reason_Weather', [I('sun', 36, 541, 14, B.mediumPlum), T('Reason_Text', 56, 552, 'Breathable knit for 29°C Makati humidity', { size: 11.5, fill: t.text })]),
        G('Reason_Collaborative', [I('people', 36, 559, 14, B.mediumPlum), T('Reason_Text', 56, 570, 'Loved by 214 users with similar taste', { size: 11.5, fill: t.text })]),
      ]),
      G('Feedback_Actions', actions.map(([label, icon, v], i) =>
        btn(`${label}_Button`, 36 + i * (actW + 6), 580, actW, 30, label, { t, variant: v, icon, size: 11.5, iconSize: 14 }))),
    ]),
    sec('Section_Label_More_Picks', 20, 634, 'MORE PICKS', t),
    T('Swipe_Hint', 355, 634, 'Swipe →', { size: 11.5, weight: 600, fill: t.muted, anchor: 'end' }),
    mini(0, 20, 2, 84, 'Office · Clean', [['tee', B.white], ['pants', B.mediumPlum]]),
    mini(1, 191.5, 3, 81, 'Casual · Clean', [['jacket', B.peach], ['pants', B.softLilac]]),
    bottomNav(t, 'Outfit'),
    homeIndicator(t),
  ]];
}

// ═════════════════════════════════════════════════════════════════════════════
// 06 — Outfit planner + packing assistant
// ═════════════════════════════════════════════════════════════════════════════
function s06() {
  const t = LIGHT;
  const days = [['M', 13, true], ['T', 14, true], ['W', 15, true], ['T', 16, false], ['F', 17, true], ['S', 18, false], ['S', 19, false]];
  const dw = 43;
  const checklist = [
    ['White Cotton Tee', 'TOP', true], ['Lilac Knit Polo', 'TOP', true], ['Plum Chinos', 'BOTTOM', true],
    ['White Sneakers', 'SHOES', true], ['Peach Windbreaker', 'OUTERWEAR', false],
  ];
  return ['Screen_06_Outfit_Planner_and_Packing', t, [
    R('Background', 0, 0, 375, 812, { fill: t.bg }),
    statusBar(t),
    G('Header_Bar', [
      T('Screen_Title', 20, 90, 'Planner', { size: 28, weight: 900, fill: t.text, ls: -0.6 }),
      T('Subtitle', 20, 112, 'Plan your week & pack smarter', { size: 13, fill: t.muted }),
      G('Add_Plan_Button', [C('Button_Circle', 335, 86, 20, { fill: B.darkPlum }), I('plus', 326, 77, 18, B.paleYellow, { sw: 2.6 })]),
    ]),
    G('Segmented_Control', [
      R('Track', 20, 126, 335, 38, { rx: 19, fill: B.white, stroke: t.border }),
      G('Segment_Plan_Day_Active', [R('Segment_Surface', 23, 129, 164, 32, { rx: 16, fill: B.darkPlum }), I('calendar', 64, 137, 16, B.paleYellow), T('Segment_Label', 86, 150, 'Plan Day', { size: 13, weight: 800, fill: B.paleYellow })]),
      G('Segment_Pack_Trip', [I('suitcase', 233, 137, 16, t.muted), T('Segment_Label', 255, 150, 'Pack Trip', { size: 13, weight: 700, fill: t.muted })]),
    ]),
    sec('Section_Label_Weekly_Calendar', 20, 190, 'WEEKLY CALENDAR', t),
    T('Week_Range', 355, 190, 'Oct 13 – 19', { size: 12, weight: 700, fill: t.text, anchor: 'end' }),
    G('Weekly_Calendar_Strip', days.map(([d, n, planned], i) => {
      const x = 20 + i * (dw + 5.33);
      const sel = n === 15;
      return G(`Day_${n}`, [
        R('Day_Surface', x, 200, dw, 66, { rx: 14, fill: sel ? B.darkPlum : B.white, stroke: sel ? B.darkPlum : t.border }),
        T('Weekday', x + dw / 2, 220, d, { size: 11, weight: 700, fill: sel ? B.softLilac : t.muted, anchor: 'middle' }),
        T('Date', x + dw / 2, 243, String(n), { size: 17, weight: 900, fill: sel ? B.paleYellow : t.text, anchor: 'middle' }),
        planned && C('Planned_Dot', x + dw / 2, 255, 3, { fill: sel ? B.paleYellow : B.peach, stroke: sel ? undefined : B.darkPlum, sw: 0.8 }),
      ]);
    })),
    card('Planned_Outfit_Card', 20, 276, 335, 96, t, [
      tile('Tile_Top', 36, 298, 52, 52, 'knit', B.softLilac, { rx: 10 }),
      tile('Tile_Bottom', 94, 298, 52, 52, 'pants', B.darkPlum, { rx: 10 }),
      tile('Tile_Shoes', 152, 298, 52, 52, 'shoe', B.white, { rx: 10 }),
      T('Plan_Date', 218, 304, 'WED · OCT 15', { size: 10, weight: 800, fill: t.muted, ls: 1 }),
      T('Plan_Title', 218, 322, 'Academic Look', { size: 14, weight: 800, fill: t.text }),
      T('Plan_Items', 218, 339, 'Lilac Knit · Plum Chinos', { size: 11.5, fill: t.muted }),
      G('Hybrid_Tag', [R('Tag_Surface', 218, 346, 74, 18, { rx: 9, fill: B.peach }), T('Tag_Label', 255, 359, 'Hybrid 87%', { size: 10, weight: 800, fill: B.darkPlum, anchor: 'middle' })]),
    ]),
    G('Replace_Plan_Confirmation_Dialog', [
      R('Dialog_Surface', 20, 382, 335, 62, { rx: 16, fill: B.darkPlum, shadow: true }),
      I('alert', 32, 392, 20, B.peach),
      T('Dialog_Message', 60, 404, 'This date already has a planned outfit.', { size: 11.5, weight: 700, fill: B.softCream }),
      T('Dialog_Question', 60, 429, 'Replace it?', { size: 12.5, weight: 800, fill: B.paleYellow }),
      btn('Cancel_Button', 206, 413, 62, 24, 'Cancel', { t, variant: 'ghostDark', size: 11 }),
      btn('Replace_Button', 274, 413, 68, 24, 'Replace', { t, variant: 'primary', size: 11, rx: 12 }),
    ]),
    sec('Section_Label_Pack_Trip', 20, 470, 'PACK TRIP ASSISTANT', t),
    T('Clean_Only_Note', 355, 470, 'CLEAN items only', { size: 11.5, weight: 700, fill: t.text, anchor: 'end' }),
    G('Trip_Summary_Card', [
      R('Card_Surface', 20, 480, 335, 78, { rx: 18, fill: B.softCream, stroke: t.border, shadow: true }),
      C('Icon_Circle', 50, 519, 18, { fill: B.darkPlum }), I('suitcase', 41, 510, 18, B.paleYellow),
      T('Destination', 78, 510, 'Baguio City', { size: 15, weight: 800, fill: t.text }),
      T('Trip_Details', 78, 527, '3 days · Casual', { size: 11.5, fill: t.muted }),
      G('Destination_Weather_Chip', [R('Chip_Surface', 78, 536, 112, 16, { rx: 8, fill: B.darkPlum }), T('Chip_Label', 134, 548, 'Rain 18°C · 9 km/h', { size: 9.5, weight: 700, fill: B.paleYellow, anchor: 'middle' })]),
      G('Packing_Mode_Toggle', [
        R('Toggle_Track', 247, 505, 96, 28, { rx: 14, fill: B.white, stroke: t.border }),
        G('Mode_Light_Active', [R('Mode_Surface', 249, 507, 46, 24, { rx: 12, fill: B.darkPlum }), T('Mode_Label', 272, 523, 'Light', { size: 10.5, weight: 800, fill: B.paleYellow, anchor: 'middle' })]),
        T('Mode_Heavy', 319, 523, 'Heavy', { size: 10.5, weight: 700, fill: t.muted, anchor: 'middle' }),
      ]),
    ]),
    card('Packing_Checklist_Card', 20, 566, 335, 152, t, [
      T('Checklist_Title', 36, 590, 'Packing Checklist', { size: 13.5, weight: 800, fill: t.text }),
      T('Checklist_Progress_Label', 339, 590, '4 / 5 packed', { size: 11, weight: 700, fill: t.muted, anchor: 'end' }),
      R('Progress_Track', 36, 598, 303, 5, { rx: 2.5, fill: B.softLilac }),
      R('Progress_Fill', 36, 598, 303 * 0.8, 5, { rx: 2.5, fill: B.darkPlum }),
      G('Checklist_Items', checklist.map(([name, cat, done], i) => {
        const y = 612 + i * 20;
        const w = tw(cat, 9, 800) + 12;
        return G(`Checklist_Item_${name}`, [
          R('Checkbox', 36, y, 14, 14, { rx: 4, fill: done ? B.darkPlum : 'none', stroke: B.darkPlum, sw: 1.3 }),
          done && I('check', 38, y + 2, 10, B.paleYellow, { sw: 3 }),
          T('Item_Name', 58, y + 11, name, { size: 12, weight: 600, fill: t.text, opacity: done ? 0.6 : 1 }),
          G('Category_Tag', [R('Tag_Surface', 339 - w, y, w, 14, { rx: 7, fill: B.softLilac }), T('Tag_Label', 339 - w / 2, y + 10, cat, { size: 9, weight: 800, fill: B.darkPlum, anchor: 'middle' })]),
        ]);
      })),
    ]),
    bottomNav(t, 'Home'),
    homeIndicator(t),
  ]];
}

// ═════════════════════════════════════════════════════════════════════════════
// 07 — Community feed (dark mode)
// ═════════════════════════════════════════════════════════════════════════════
function s07() {
  const t = DARK;
  const shield = (x, y) => G('AI_Moderation_Shield_Badge', [
    R('Badge_Surface', x, y, 108, 24, { rx: 12, fill: B.mediumPlum, stroke: B.paleYellow }),
    I('shield', x + 8, y + 5, 14, B.paleYellow),
    T('Badge_Label', x + 27, y + 16, 'AI Moderated', { size: 10.5, weight: 800, fill: B.paleYellow }),
  ]);
  const stars = (x, y, filled) => G('Star_Rating_1_to_5', [1, 2, 3, 4, 5].map((n) =>
    I('star', x + (n - 1) * 20, y, 16, n <= filled ? B.paleYellow : B.softLilac, { id: `Star_${n}`, fill: n <= filled ? B.paleYellow : undefined, sw: 1.6 })));
  const post = (n, y, h, user, handle, initials, avatarBg, outfit, caption, rating, likes, saves) => card(`Shared_Outfit_Card_${n}`, 20, y, 335, h, t, [
    G('Author_Row', [
      C('Avatar', 48, y + 30, 16, { fill: avatarBg }),
      T('Avatar_Initials', 48, y + 35, initials, { size: 11, weight: 800, fill: B.darkPlum, anchor: 'middle' }),
      T('Author_Name', 72, y + 26, user, { size: 13.5, weight: 800, fill: t.text }),
      T('Author_Meta', 72, y + 42, handle, { size: 11, fill: t.muted }),
    ]),
    shield(231, y + 16),
    G('Outfit_Image_Area', [
      R('Image_Surface', 36, y + 58, 303, 148, { rx: 14, fill: B.darkTile }),
      garment('Garment_Top', outfit[0][0], 50, y + 70, 112, outfit[0][1]),
      garment('Garment_Bottom', outfit[1][0], 160, y + 74, 104, outfit[1][1]),
      garment('Garment_Shoes', 'shoe', 252, y + 118, 78, B.paleYellow),
      G('Hybrid_Badge', [R('Badge_Surface', 48, y + 174, 90, 22, { rx: 11, fill: B.paleYellow }), T('Badge_Label', 93, y + 189, `Hybrid ${outfit[2]}%`, { size: 10.5, weight: 800, fill: B.darkPlum, anchor: 'middle' })]),
    ]),
    TM('Caption', 36, y + 228, caption, 17, { size: 12.5, fill: t.text }),
    R('Divider', 36, y + 256, 303, 1, { fill: t.border }),
    G('Rating_Row', [
      T('Rate_Label', 36, y + 281, 'Rate', { size: 11, weight: 700, fill: t.muted }),
      stars(68, y + 268, rating),
      T('Rating_Summary', 172, y + 281, '4.6 · 38 ratings', { size: 11, weight: 600, fill: t.muted }),
    ]),
    G('Engagement_Actions', [
      G('Like_Button', [I('heart', 36, y + 296, 18, B.peach, { fill: B.peach }), T('Like_Count', 60, y + 310, String(likes), { size: 12, weight: 700, fill: t.text })]),
      G('Save_Button', [I('bookmark', 104, y + 296, 18, t.text), T('Save_Count', 128, y + 310, String(saves), { size: 12, weight: 700, fill: t.text })]),
      G('Share_Button', [I('share', 168, y + 296, 18, t.text)]),
      T('Your_Rating', 339, y + 310, `You rated ${rating} / 5`, { size: 11, weight: 800, fill: B.paleYellow, anchor: 'end' }),
    ]),
  ]);
  return ['Screen_07_Community_Feed_Dark', t, [
    R('Background', 0, 0, 375, 812, { fill: t.bg }),
    statusBar(t),
    G('Header_Bar', [
      T('Screen_Title', 20, 92, 'Community', { size: 28, weight: 900, fill: t.text, ls: -0.6 }),
      T('Subtitle', 20, 114, 'Find and share your favorite looks', { size: 13, fill: t.muted }),
      btn('Post_Look_Button', 245, 74, 110, 36, 'Post Look', { t, icon: 'plus', size: 13, iconSize: 15 }),
    ]),
    G('Feed_Mode_Pills', [
      pill('Mode_Recent', 20, 130, 'Recent', { t, active: true, size: 13, h: 32 }),
      pill('Mode_Trending', 20 + pillW('Recent', { size: 13 }) + 8, 130, 'Trending', { t, size: 13, h: 32 }),
    ]),
    post(1, 174, 330, 'Mika Santos', '@mika.styles · 2h · Academic', 'MS', B.peach,
      [['knit', B.softLilac], ['pants', B.softCream], 89],
      ['Perfect breathable combo for a humid', 'campus day in Makati. #OOTD #ReWear'], 4, 124, 31),
    post(2, 516, 330, 'Jonas Reyes', '@jonas.fits · 5h · Office', 'JR', B.softLilac,
      [['jacket', B.peach], ['pants', B.softLilac], 86],
      ['Peach overshirt for Friday meetings —', 'zero new purchases this month!'], 5, 98, 22),
    bottomNav(t, 'Community'),
    homeIndicator(t),
  ]];
}

// ═════════════════════════════════════════════════════════════════════════════
// 08 — Notifications & account settings
// ═════════════════════════════════════════════════════════════════════════════
function s08() {
  const t = LIGHT;
  const alerts = [
    ['Weather Alerts', 'Live OpenWeatherMap conditions', 'cloudSun', B.peach, true],
    ['Sustainability Tips', 'Re-wear and care nudges', 'leaf', B.softLilac, true],
    ['Outfit Reminders', 'Planned looks for tomorrow', 'shirt', B.peach, true],
    ['Laundry Reminders', 'When pieces need washing', 'droplet', B.softLilac, false],
  ];
  const notif = (n, y, icon, title, body, unread) => G(`Notification_Card_${n}`, [
    R('Card_Surface', 20, y, 335, 58, { rx: 16, fill: B.white, stroke: unread ? B.darkPlum : t.border, shadow: true }),
    R('Icon_Tile', 32, y + 11, 36, 36, { rx: 10, fill: B.darkPlum }), I(icon, 41, y + 20, 18, B.paleYellow),
    T('Notification_Title', 78, y + 25, title, { size: 12.5, weight: 800, fill: t.text }),
    T('Notification_Body', 78, y + 42, body, { size: 11, fill: t.muted }),
    unread && C('Unread_Dot', 343, y + 20, 4, { fill: B.peach, stroke: B.darkPlum, sw: 1 }),
  ]);
  return ['Screen_08_Notifications_and_Account_Settings', t, [
    R('Background', 0, 0, 375, 812, { fill: t.bg }),
    statusBar(t),
    G('Header_Bar', [
      T('Screen_Title', 20, 92, 'Account', { size: 28, weight: 900, fill: t.text, ls: -0.6 }),
      T('Subtitle', 20, 114, 'Notifications & preferences', { size: 13, fill: t.muted }),
      G('Notifications_Bell', [
        C('Button_Circle', 335, 86, 20, { fill: t.surface, stroke: t.border }), I('bell', 325, 76, 20, t.text),
        C('Unread_Count_Badge', 349, 72, 8, { fill: B.peach, stroke: B.darkPlum, sw: 1.2 }),
        T('Unread_Count', 349, 75.5, '2', { size: 9.5, weight: 800, fill: B.darkPlum, anchor: 'middle' }),
      ]),
    ]),
    card('Profile_Card', 20, 130, 335, 68, t, [
      C('Avatar', 56, 164, 20, { fill: B.softLilac }), T('Avatar_Initials', 56, 169, 'AR', { size: 13, weight: 800, fill: B.darkPlum, anchor: 'middle' }),
      T('Profile_Name', 88, 159, 'Alex Rivera', { size: 15, weight: 800, fill: t.text }),
      T('Profile_Email', 88, 177, 'alex@stylesense.app', { size: 12, fill: t.muted }),
      I('chevronRight', 321, 155, 18, t.muted),
    ]),
    sec('Section_Label_Appearance', 20, 224, 'APPEARANCE', t),
    card('Appearance_Card', 20, 234, 335, 62, t, [
      C('Icon_Circle', 52, 265, 16, { fill: B.softLilac }), I('moon', 44, 257, 16, B.darkPlum),
      T('Setting_Title', 78, 261, 'Theme', { size: 14, weight: 800, fill: t.text }),
      T('Setting_Note', 78, 278, 'Saved to AsyncStorage', { size: 11, fill: t.muted }),
      G('Light_Dark_Mode_Toggle', [
        R('Toggle_Track', 213, 249, 128, 32, { rx: 16, fill: t.bg, stroke: t.border }),
        G('Option_Light_Active', [R('Option_Surface', 215, 251, 62, 28, { rx: 14, fill: B.darkPlum }), I('sun', 224, 259, 12, B.paleYellow, { sw: 2.4 }), T('Option_Label', 241, 269, 'Light', { size: 11.5, weight: 800, fill: B.paleYellow })]),
        G('Option_Dark', [I('moon', 287, 259, 12, t.muted, { sw: 2.4 }), T('Option_Label', 304, 269, 'Dark', { size: 11.5, weight: 700, fill: t.muted })]),
      ]),
    ]),
    sec('Section_Label_Smart_Alerts', 20, 322, 'SMART ALERTS', t),
    T('Alerts_On_Count', 355, 322, '3 of 4 on', { size: 11.5, weight: 700, fill: t.muted, anchor: 'end' }),
    card('Smart_Alert_Switches_Card', 20, 332, 335, 232, t, alerts.map(([label, note, icon, bg, on], i) => {
      const y = 332 + i * 58;
      return G(`Alert_Row_${label}`, [
        i > 0 && R('Row_Divider', 78, y, 261, 1, { fill: t.border }),
        C('Icon_Circle', 52, y + 29, 16, { fill: bg }), I(icon, 44, y + 21, 16, B.darkPlum),
        T('Alert_Label', 78, y + 26, label, { size: 14, weight: 800, fill: t.text }),
        T('Alert_Note', 78, y + 43, note, { size: 11, fill: t.muted }),
        toggle(`${label.replace(/ /g, '_')}_Switch`, 293, y + 15, on, t),
      ]);
    })),
    sec('Section_Label_Recent_Alerts', 20, 588, 'RECENT ALERTS', t),
    T('Mark_All_Read', 355, 588, 'Mark All Read', { size: 12, weight: 700, fill: t.text, anchor: 'end', deco: 'underline' }),
    notif(1, 598, 'cloudSun', 'Makati Weather Alert: 29°C & Humid', 'Breathable tops prioritized · Just now', true),
    notif(2, 664, 'droplet', '3 items need washing', 'White hoodie + 2 tees · 1h ago', false),
    bottomNav(t, 'Account'),
    homeIndicator(t),
  ]];
}

// ── Emit ─────────────────────────────────────────────────────────────────────
const screens = [
  ['01_Onboarding_Name_and_Style.svg', s01],
  ['02_Home_Dashboard.svg', s02],
  ['03_Wardrobe_Manager_FilterBy.svg', s03],
  ['04_Add_Clothes_CNN_KMeans_Tagging.svg', s04],
  ['05_Hybrid_Outfit_Recommender.svg', s05],
  ['06_Outfit_Planner_and_Packing_Assistant.svg', s06],
  ['07_Community_Feed_Dark_Mode.svg', s07],
  ['08_Notifications_and_Account_Settings.svg', s08],
];

for (const [file, build] of screens) {
  ids = new Map();
  const [screenId, t, body] = build();
  ids.set(screenId, 1);
  const svg = svgDoc(screenId, t, body);
  fs.writeFileSync(path.join(OUT, file), svg, 'utf8');
  const groups = (svg.match(/<g /g) || []).length;
  const texts = (svg.match(/<text /g) || []).length;
  console.log(`${file.padEnd(46)} ${String(groups).padStart(4)} groups  ${String(texts).padStart(3)} text  ${(svg.length / 1024).toFixed(1)} KB`);
}

