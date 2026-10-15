/* eslint-disable */
// StyleSense — High-Precision Layered SVG Generator for Figma
// Generates 17 standalone, Figma-ready 375x812 SVGs mirroring the real StyleSense app 1:1
// Run: node figma-layered-screens/generate-svgs.js

const fs = require('fs');
const path = require('path');

const OUT = __dirname;
const FONT = "Arial, sans-serif";

// ── Official StyleSense Brand Palette ─────────────────────────────────────────
const B = {
  darkPlum: '#24152C',
  mediumPlum: '#4B1D6F',
  softLilac: '#DECFE8',
  paleYellow: '#FBF5A7',
  peachGold: '#FDD78B',
  softCream: '#FDF3D2',
  alabaster: '#FAF7F0',
  darkCard: '#2E1B38',
  darkTile: '#3A2447',
  white: '#FFFFFF',
};

const THEMES = {
  light: {
    mode: 'light',
    bg: B.alabaster,
    surface: B.white,
    border: B.softLilac,
    text: B.darkPlum,
    muted: '#5E4B6B',
    accent: B.mediumPlum, // eyebrow, link, progressFill, logo highlight in light mode: #4B1D6F (high contrast)
    ctaFill: B.paleYellow, // button fill ONLY: #FBF5A7
    onCta: B.darkPlum,     // text/icon on CTA: #24152C
    highlightText: B.darkPlum, // NEVER pale yellow on light backgrounds
    statIconColor: B.mediumPlum, // crisp visible plum in light mode
    badge: B.softLilac,
    badgeText: B.darkPlum,
    activeCardBg: B.softLilac,
    activeCardBorder: B.mediumPlum,
    tileBg: '#F4F1EA',
    navSurface: B.white,
    navActiveIcon: B.darkPlum,
    navInactiveIcon: B.mediumPlum,
    navActivePill: B.softLilac,
  },
  dark: {
    mode: 'dark',
    bg: B.darkPlum,
    surface: B.darkCard,
    border: B.mediumPlum,
    text: B.softCream,
    muted: B.softLilac,
    accent: B.paleYellow, // eyebrow, link, progressFill, logo highlight in dark mode: #FBF5A7
    ctaFill: B.paleYellow,
    onCta: B.darkPlum,
    highlightText: B.paleYellow,
    statIconColor: B.paleYellow,
    badge: B.mediumPlum,
    badgeText: B.softCream,
    activeCardBg: B.mediumPlum,
    activeCardBorder: B.paleYellow,
    tileBg: B.darkTile,
    navSurface: B.darkPlum,
    navActiveIcon: B.paleYellow,
    navInactiveIcon: B.softLilac,
    navActivePill: B.mediumPlum,
  },
};

// ── Primitive SVG & Figma Layer Builders ─────────────────────────────────────
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

// ── Vector Icons (24x24 viewBox) ─────────────────────────────────────────────
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
  chart: 'M18 20V10 M12 20V4 M6 20v-6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5z',
  help: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01 M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  thumbDown: 'M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17',
  palette: 'M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10a2.5 2.5 0 0 0 2.5-2.5c0-.61-.23-1.2-.64-1.67-.4-.46-.64-.99-.64-1.58 0-1.38 1.12-2.5 2.5-2.5H18c3.31 0 6-2.69 6-6 0-4.96-5.37-9-12-9zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 8 6.5 8 8 8.67 8 9.5 7.33 11 6.5 11zm3-4C8.67 7 8 6.33 8 5.5S8.67 4 9.5 4s1.5.67 1.5 1.5S10.33 7 9.5 7zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 4 14.5 4s1.5.67 1.5 1.5S15.33 7 14.5 7zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 8 17.5 8s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
  google: 'M21.35 11.1h-9.17v2.73h5.27c-.23 1.2-.91 2.22-1.92 2.9v2.41h3.11c1.82-1.68 2.87-4.15 2.87-7.04 0-.68-.06-1.34-.16-2z',
  facebook: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const I = (name, x, y, size, color, o = {}) =>
  G(`Icon_${o.id || cap(name)}`, P('Vector', ICON[name], { stroke: color, sw: o.sw || 2, fill: o.fill, fo: o.fo }), {
    transform: `translate(${n2(x)} ${n2(y)}) scale(${(size / 24).toFixed(4)})`,
  });

// ── Vector Garments ──────────────────────────────────────────────────────────
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
  const line = o.line || (color === B.darkPlum ? B.softLilac : B.darkPlum);
  const sw = (1.3 * 100) / size;
  return G(id, [
    P('Silhouette', GARMENT[type], { fill: color, stroke: line, sw }),
    P('Stitch_Detail', DETAIL[type], { stroke: line, sw, opacity: 0.45 }),
  ], { transform: `translate(${n2(x)} ${n2(y)}) scale(${(size / 100).toFixed(4)})` });
};
const tile = (id, x, y, w, h, type, color, o = {}) => {
  const size = Math.min(w, h) * (o.scale || 0.8);
  return G(id, [
    R('Tile_Background', x, y, w, h, { rx: o.rx || 12, fill: o.bg || '#F4F1EA', stroke: o.stroke }),
    garment('Garment_Vector', type, x + (w - size) / 2, y + (h - size) / 2, size, color, o),
  ]);
};

// ── Shared Standard UI Bars ──────────────────────────────────────────────────
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
  const kids = [
    R('Nav_Surface', 0, 728, 375, 84, { fill: t.navSurface }),
    R('Nav_Top_Hairline', 0, 728, 375, 1, { fill: t.border }),
  ];
  tabs.forEach(([key, icon], i) => {
    const cx = 37.5 + i * 75;
    const on = key === active;
    if (key === 'Outfit') {
      kids.push(G('Tab_Outfit_AI_Center_Badge', [
        C('Badge_Circle', cx, 742, 22, { fill: B.paleYellow, stroke: B.peachGold, sw: 1.5 }),
        I('sparkles', cx - 10, 732, 20, B.darkPlum, { fill: B.darkPlum }),
        T('Tab_Label', cx, 782, 'Outfit', { size: 10, weight: 800, fill: on ? t.navActiveIcon : t.navInactiveIcon, anchor: 'middle' }),
      ]));
      return;
    }
    const col = on ? t.navActiveIcon : t.navInactiveIcon;
    kids.push(G(`Tab_${key}`, [
      on && R('Active_Indicator_Pill', cx - 18, 734, 36, 26, { rx: 13, fill: t.navActivePill }),
      I(icon, cx - 10, 737, 20, col, { fill: on ? col : undefined, fo: on ? 0.2 : undefined, sw: on ? 2.2 : 1.8 }),
      T('Tab_Label', cx, 782, key, { size: 10, weight: on ? 800 : 600, fill: col, anchor: 'middle' }),
    ]));
  });
  return G('Bottom_Navigation_Bar', kids);
};

const sec = (id, x, y, label, t, o = {}) =>
  T(id, x, y, label, { size: 11, weight: 800, fill: t.accent, ls: 1.3, anchor: o.anchor });

const card = (id, x, y, w, h, t, kids, o = {}) =>
  G(id, [R('Card_Surface', x, y, w, h, { rx: o.rx || 18, fill: o.fill || t.surface, stroke: o.stroke || t.border, shadow: o.shadow !== false }), kids]);

const btn = (id, x, y, w, h, label, o = {}) => {
  const t = o.t;
  const v = o.variant || 'primary';
  const size = o.size || 13;
  const sty = {
    primary: { fill: t.ctaFill, stroke: 'none', txt: t.onCta },
    secondary: { fill: t.surface, stroke: t.border, txt: t.text },
    soft: { fill: t.badge, stroke: 'none', txt: t.badgeText },
    ghostDark: { fill: 'none', stroke: B.softLilac, txt: B.softCream },
  }[v];
  const isz = o.iconSize || size + 2;
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
  const t = o.t;
  const size = o.size || 12;
  const h = o.h || 30;
  const w = pillW(label, o);
  const on = o.active;
  const fill = on ? (t.mode === 'dark' ? B.paleYellow : B.softLilac) : t.surface;
  const txtColor = on ? B.darkPlum : t.text;
  const stroke = on ? (t.mode === 'dark' ? B.paleYellow : B.softLilac) : t.border;
  return G(id, [
    R('Pill_Surface', x, y, w, h, { rx: h / 2, fill, stroke }),
    T('Pill_Label', x + w / 2, y + h / 2 + size * 0.36, label, { size, weight: 700, fill: txtColor, anchor: 'middle' }),
  ]);
};

const toggle = (id, x, y, on, t) => G(id, [
  R('Switch_Track', x, y, 44, 26, { rx: 13, fill: on ? B.paleYellow : t.border }),
  C('Switch_Thumb', on ? x + 31 : x + 13, y + 13, 10, { fill: on ? B.darkPlum : (t.mode === 'dark' ? B.softCream : B.white) }),
]);

const svgDoc = (screenId, t, body) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="375" height="812" viewBox="0 0 375 812" fill="none">
<title>${screenId}</title>
<defs>
<filter id="Card_Shadow" x="-10%" y="-10%" width="120%" height="135%" color-interpolation-filters="sRGB">
<feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="${B.darkPlum}" flood-opacity="${t.mode === 'dark' ? 0.35 : 0.05}"/>
</filter>
<linearGradient id="Welcome_Grad" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="#DECFE8"/>
<stop offset="100%" stop-color="#FDF3D2"/>
</linearGradient>
<clipPath id="Screen_Clip"><rect width="375" height="812"/></clipPath>
</defs>
<g id="${screenId}" clip-path="url(#Screen_Clip)">
${flat(body)}
</g>
</svg>
`;

// ═════════════════════════════════════════════════════════════════════════════
// ONBOARDING HEADER & FOOTER HELPERS
// ═════════════════════════════════════════════════════════════════════════════
const onboardingHeader = (t, showSkip = true) => G('Header_Bar', [
  G('Brand_Logo', [
    R('Brand_Mark', 20, 56, 32, 32, { rx: 10, fill: B.peachGold }),
    T('Brand_Mark_Letter', 36, 78, 'S', { size: 17, weight: 900, fill: B.darkPlum, anchor: 'middle' }),
    T('Brand_Wordmark', 60, 78, [['Style', t.text, 800], ['Sense', t.accent, 800]], { size: 20 }),
  ]),
  showSkip && T('Skip_Link', 355, 77, 'Skip for now', { size: 13, weight: 600, fill: t.muted, anchor: 'end' }),
]);

const onboardingProgress = (t, stepNum, totalSteps = 6) => G('Progress_Bar', [
  R('Track', 20, 100, 335, 4, { rx: 2, fill: t.border }),
  R('Fill', 20, 100, (335 * stepNum) / totalSteps, 4, { rx: 2, fill: t.accent }),
]);

const onboardingFooter = (t, stepText, canContinue = true, btnText = 'Continue') => G('Footer_Bar', [
  R('Footer_Divider', 20, 712, 335, 1, { fill: t.border }),
  stepText
    ? G('Back_Action', [
        I('arrowLeft', 20, 742, 18, t.muted),
        T('Back_Label', 44, 756, 'Back', { size: 14, weight: 700, fill: t.muted }),
      ])
    : G('Empty_Back', []),
  stepText && T('Step_Counter', 187.5, 756, stepText, { size: 12.5, weight: 600, fill: t.muted, anchor: 'middle' }),
  btn('Continue_Button', 225, 730, 130, 44, btnText, { t, icon: 'arrowRight', size: 13.5, rx: 22 }),
]);

// ═════════════════════════════════════════════════════════════════════════════
// 00a — Onboarding Welcome (Light)
// ═════════════════════════════════════════════════════════════════════════════
function buildOnboardingWelcomeLight() {
  const t = THEMES.light;
  return [
    R('Background', 0, 0, 375, 812, { fill: t.bg }),
    statusBar(t),
    onboardingHeader(t, false),
    onboardingProgress(t, 1, 6),
    // Hero Visual
    G('Hero_Card_Wrap', [
      R('Visual_Surface', 20, 134, 335, 230, { rx: 28, fill: 'url(#Welcome_Grad)', shadow: true }),
      garment('Hero_Garment_Tee', 'tee', 115, 166, 145, B.white, { line: B.darkPlum }),
      C('Sparkle_Badge', 246, 172, 18, { fill: B.white, stroke: B.softLilac }),
      I('sparkles', 237, 163, 18, B.darkPlum),
    ]),
    G('Intro_Content', [
      T('Eyebrow', 187.5, 412, 'WELCOME TO STYLESENSE', { size: 11.5, weight: 800, fill: t.accent, ls: 1.4, anchor: 'middle' }),
      T('Hero_Title', 187.5, 448, "Let's make getting dressed", { size: 24, weight: 900, fill: t.text, ls: -0.6, anchor: 'middle' }),
      T('Hero_Title_2', 187.5, 474, 'feel easy.', { size: 24, weight: 900, fill: t.text, ls: -0.6, anchor: 'middle' }),
      TM('Hero_Body', 187.5, 514, [
        'A little about your style helps us turn your',
        'wardrobe into outfits you’ll actually want to wear.',
      ], 19, { size: 13.5, fill: t.muted, anchor: 'middle' }),
    ]),
    btn('Get_Started_CTA', 20, 726, 335, 50, "Let's get started", { t, icon: 'arrowRight', size: 14.5, rx: 25 }),
    homeIndicator(t),
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// 00b — Onboarding Step 1: Name (Light)
// ═════════════════════════════════════════════════════════════════════════════
function buildOnboardingStep1NameLight() {
  const t = THEMES.light;
  return [
    R('Background', 0, 0, 375, 812, { fill: t.bg }),
    statusBar(t),
    onboardingHeader(t, true),
    onboardingProgress(t, 2, 6),
    G('Intro_Block', [
      C('Icon_Circle', 187.5, 154, 24, { fill: B.peachGold }),
      I('person', 175.5, 142, 24, B.darkPlum),
      T('Eyebrow', 187.5, 206, 'FIRST THINGS FIRST', { size: 11.5, weight: 800, fill: t.accent, ls: 1.4, anchor: 'middle' }),
      T('Title', 187.5, 240, 'What should we call you?', { size: 24, weight: 900, fill: t.text, ls: -0.5, anchor: 'middle' }),
      TM('Body', 187.5, 266, [
        'Your StyleSense space should feel personal',
        'from the very beginning.',
      ], 19, { size: 13.5, fill: t.muted, anchor: 'middle' }),
    ]),
    G('Name_Field_Wrap', [
      T('Input_Label', 20, 342, 'Your name', { size: 13, weight: 700, fill: t.text }),
      R('Input_Surface', 20, 354, 335, 52, { rx: 14, fill: t.surface, stroke: B.darkPlum, sw: 1.5 }),
      T('Input_Value', 36, 386, 'Alex', { size: 16.5, weight: 500, fill: t.text }),
      R('Caret', 76, 369, 1.5, 22, { fill: B.mediumPlum }),
      C('Check_Bubble', 331, 380, 11, { fill: B.peachGold }),
      I('check', 324, 373, 14, B.darkPlum, { sw: 2.6 }),
    ]),
    onboardingFooter(t, '1 of 4', true, 'Continue'),
    homeIndicator(t),
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// 00c — Onboarding Step 2: Style (Light)
// ═════════════════════════════════════════════════════════════════════════════
function buildOnboardingStep2StyleLight() {
  const t = THEMES.light;
  const styles = [
    { label: 'Easy & casual', note: 'Relaxed, everyday pieces', active: true },
    { label: 'Clean & minimal', note: 'Simple, considered outfits', active: true },
    { label: 'Streetwear', note: 'Statement layers and sneakers', active: false },
    { label: 'Classic', note: 'Timeless shapes and polish', active: true },
    { label: 'Creative', note: 'Colour, texture, and play', active: false },
    { label: 'Soft & romantic', note: 'Feminine details and flow', active: false },
  ];

  return [
    R('Background', 0, 0, 375, 812, { fill: t.bg }),
    statusBar(t),
    onboardingHeader(t, true),
    onboardingProgress(t, 3, 6),
    G('Intro_Block', [
      T('Eyebrow', 20, 134, 'YOUR STYLE, YOUR WAY', { size: 11.5, weight: 800, fill: t.accent, ls: 1.4 }),
      T('Title', 20, 160, 'What feels most like you, Alex?', { size: 21, weight: 900, fill: t.text, ls: -0.4 }),
      T('Subtitle', 20, 180, 'Pick as many as you like. There are no wrong answers.', { size: 12.5, fill: t.muted }),
    ]),
    G('Styles_List', styles.map((st, i) => {
      const y = 200 + i * 56;
      return G(`Style_Choice_${i + 1}`, [
        R('Choice_Surface', 20, y, 335, 48, {
          rx: 14,
          fill: st.active ? t.activeCardBg : t.surface,
          stroke: st.active ? t.activeCardBorder : t.border,
          sw: st.active ? 1.5 : 1,
        }),
        R('Checkbox', 34, y + 14, 20, 20, {
          rx: 6,
          fill: st.active ? t.activeCardBorder : 'none',
          stroke: st.active ? t.activeCardBorder : t.border,
          sw: 1.5,
        }),
        st.active && I('check', 37, y + 17, 14, B.white, { sw: 2.8 }),
        T('Style_Label', 66, y + 26, st.label, { size: 13.5, weight: 800, fill: t.text }),
        T('Style_Note', 66, y + 40, st.note, { size: 11, fill: t.muted }),
      ]);
    })),
    onboardingFooter(t, '2 of 4', true, 'Continue'),
    homeIndicator(t),
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// 00d — Onboarding Step 3: Colours (Light)
// ═════════════════════════════════════════════════════════════════════════════
function buildOnboardingStep3ColoursLight() {
  const t = THEMES.light;
  const colours = [
    { label: 'Neutrals', note: 'Black, white, beige', active: true, swatches: [B.darkPlum, B.white, '#E8DCB8'] },
    { label: 'Earth tones', note: 'Olive, rust, brown', active: true, swatches: ['#5E6D4E', '#B75D38', '#6A4E38'] },
    { label: 'Soft pastels', note: 'Powder blue, blush, lilac', active: false, swatches: ['#B4D3E5', '#F5C9C9', B.softLilac] },
    { label: 'Bold colour', note: 'Bright, confident accents', active: false, swatches: ['#D9383A', '#2B6CB0', '#D69E2E'] },
  ];

  return [
    R('Background', 0, 0, 375, 812, { fill: t.bg }),
    statusBar(t),
    onboardingHeader(t, true),
    onboardingProgress(t, 4, 6),
    G('Intro_Block', [
      T('Eyebrow', 20, 138, 'A LITTLE COLOUR CONTEXT', { size: 11.5, weight: 800, fill: t.accent, ls: 1.4 }),
      T('Title', 20, 166, 'What colours do you reach for?', { size: 21, weight: 900, fill: t.text, ls: -0.4 }),
      T('Subtitle', 20, 188, 'We’ll use this to make recommendations feel like home.', { size: 12.5, fill: t.muted }),
    ]),
    G('Colours_List', colours.map((c, i) => {
      const y = 214 + i * 82;
      return G(`Colour_Choice_${i + 1}`, [
        R('Choice_Surface', 20, y, 335, 72, {
          rx: 16,
          fill: c.active ? t.activeCardBg : t.surface,
          stroke: c.active ? t.activeCardBorder : t.border,
          sw: c.active ? 1.5 : 1,
        }),
        R('Checkbox', 34, y + 26, 20, 20, {
          rx: 6,
          fill: c.active ? t.activeCardBorder : 'none',
          stroke: c.active ? t.activeCardBorder : t.border,
          sw: 1.5,
        }),
        c.active && I('check', 37, y + 29, 14, B.white, { sw: 2.8 }),
        T('Colour_Label', 66, y + 34, c.label, { size: 14, weight: 800, fill: t.text }),
        T('Colour_Note', 66, y + 52, c.note, { size: 11.5, fill: t.muted }),
        G('Swatches_Pill', c.swatches.map((hex, si) =>
          C(`Swatch_${si + 1}`, 275 + si * 18, y + 36, 7, { fill: hex, stroke: B.softLilac, sw: 1 }))),
      ]);
    })),
    onboardingFooter(t, '3 of 4', true, 'Continue'),
    homeIndicator(t),
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// 00e — Onboarding Step 4: Occasions (Light)
// ═════════════════════════════════════════════════════════════════════════════
function buildOnboardingStep4OccasionsLight() {
  const t = THEMES.light;
  const occasions = [
    { label: 'Everyday dressing', note: 'Make getting dressed easier and repeatable', icon: 'shirt', active: true },
    { label: 'Work & school', note: 'Look put-together on repeat without overthinking', icon: 'calendar', active: false },
    { label: 'Weekends & going out', note: 'Fresh, expressive styling ideas for your free time', icon: 'sparkles', active: false },
  ];

  return [
    R('Background', 0, 0, 375, 812, { fill: t.bg }),
    statusBar(t),
    onboardingHeader(t, true),
    onboardingProgress(t, 5, 6),
    G('Intro_Block', [
      T('Eyebrow', 20, 142, 'ONE LAST THING', { size: 11.5, weight: 800, fill: t.accent, ls: 1.4 }),
      T('Title', 20, 170, 'Where do you need the most help?', { size: 21, weight: 900, fill: t.text, ls: -0.4 }),
      T('Subtitle', 20, 192, 'We’ll start your feed with ideas that fit your real routine.', { size: 12.5, fill: t.muted }),
    ]),
    G('Occasions_List', occasions.map((occ, i) => {
      const y = 224 + i * 104;
      return G(`Occasion_Choice_${i + 1}`, [
        R('Choice_Surface', 20, y, 335, 92, {
          rx: 18,
          fill: occ.active ? t.activeCardBg : t.surface,
          stroke: occ.active ? t.activeCardBorder : t.border,
          sw: occ.active ? 1.5 : 1,
        }),
        C('Icon_Circle', 52, y + 46, 20, { fill: occ.active ? B.white : t.tileBg }),
        I(occ.icon, 42, y + 36, 20, t.text),
        T('Occasion_Label', 84, y + 38, occ.label, { size: 15, weight: 800, fill: t.text }),
        TM('Occasion_Note', 84, y + 56, [occ.note], 16, { size: 12, fill: t.muted }),
        R('Radio', 320, y + 36, 20, 20, { rx: 10, fill: 'none', stroke: occ.active ? t.activeCardBorder : t.border, sw: 1.5 }),
        occ.active && C('Radio_Dot', 330, y + 46, 6, { fill: t.activeCardBorder }),
      ]);
    })),
    onboardingFooter(t, '4 of 4', true, 'Finish Setup'),
    homeIndicator(t),
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// 00f & 00g — Sign In Screen (Light & Dark)
// Mirrors LoginScreen.tsx 1:1
// ═════════════════════════════════════════════════════════════════════════════
function buildSignInScreen(t) {
  return [
    R('Background', 0, 0, 375, 812, { fill: t.bg }),
    statusBar(t),
    G('Header_Greeting', [
      C('Logo_Badge', 187.5, 110, 32, { fill: B.peachGold }),
      I('shirt', 171.5, 94, 32, t.mode === 'dark' ? B.paleYellow : B.darkPlum),
      T('Welcome_Title', 187.5, 172, 'Welcome Back', { size: 26, weight: 900, fill: t.text, ls: -0.5, anchor: 'middle' }),
      T('Welcome_Sub', 187.5, 194, 'Sign in to your digital closet', { size: 13.5, fill: t.muted, anchor: 'middle' }),
    ]),
    card('Auth_Form_Card', 20, 222, 335, 412, t, [
      // Social login buttons
      G('Social_Buttons_Row', [
        G('Google_Btn', [
          R('G_Surface', 36, 242, 145, 44, { rx: 12, fill: t.surface, stroke: t.border }),
          I('google', 68, 254, 18, '#EA4335', { fill: '#EA4335' }),
          T('G_Label', 94, 269, 'Google', { size: 13, weight: 700, fill: t.text }),
        ]),
        G('Facebook_Btn', [
          R('FB_Surface', 194, 242, 145, 44, { rx: 12, fill: t.surface, stroke: t.border }),
          I('facebook', 222, 254, 18, '#1877F2', { fill: '#1877F2' }),
          T('FB_Label', 248, 269, 'Facebook', { size: 13, weight: 700, fill: t.text }),
        ]),
      ]),
      // OR divider
      G('Divider_Row', [
        R('Line_L', 36, 312, 126, 1, { fill: t.border }),
        T('OR_Text', 187.5, 316, 'OR', { size: 11, weight: 700, fill: t.muted, anchor: 'middle' }),
        R('Line_R', 213, 312, 126, 1, { fill: t.border }),
      ]),
      // Email field
      G('Field_Email', [
        T('Email_Label', 36, 342, 'Email', { size: 12.5, weight: 700, fill: t.text }),
        R('Email_Input', 36, 352, 303, 46, { rx: 12, fill: t.tileBg, stroke: t.border }),
        T('Email_Value', 50, 380, 'alex@stylesense.app', { size: 14, fill: t.text }),
      ]),
      // Password field
      G('Field_Password', [
        T('Pass_Label', 36, 420, 'Password', { size: 12.5, weight: 700, fill: t.text }),
        R('Pass_Input', 36, 430, 303, 46, { rx: 12, fill: t.tileBg, stroke: t.border }),
        T('Pass_Mask', 50, 460, '••••••••••••', { size: 16, fill: t.text }),
      ]),
      // Sign In CTA button (Pale Yellow solid background with Dark Plum text)
      G('Submit_Action', [
        R('CTA_Surface', 36, 502, 303, 48, { rx: 14, fill: t.ctaFill }),
        T('CTA_Label', 187.5, 532, 'Sign In', { size: 14.5, weight: 800, fill: t.onCta, anchor: 'middle' }),
      ]),
      // Forgot password link
      T('Forgot_Link', 187.5, 584, 'Forgot password?', { size: 12, weight: 600, fill: t.muted, anchor: 'middle' }),
    ]),
    G('Footer_Signup_Prompt', [
      T('Signup_Prompt', 187.5, 680, [
        ["Don't have an account?  ", t.muted, 400],
        ['Sign Up', t.accent, 800],
      ], { size: 13.5, anchor: 'middle' }),
    ]),
    homeIndicator(t),
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. HOME SCREEN (01_Home_Light & 02_Home_Dark)
// Mirrors HomeScreen.tsx (GreetingHeader, WeatherCard, QuickShortcuts,
// WardrobeSummary with Medium Plum / Pale Yellow icons, SustainabilityTip,
// WardrobeAnalyticsPreview, BottomNav)
// ═════════════════════════════════════════════════════════════════════════════
function buildHomeScreen(t) {
  const qa = [
    ['Add Clothes', 'camera'],
    ['Generate Outfit', 'sparkles'],
    ['Plan Day', 'calendar'],
    ['Pack Trip', 'suitcase'],
  ];

  return [
    R('Background', 0, 0, 375, 812, { fill: t.bg }),
    statusBar(t),
    G('Header_Bar', [
      T('Greeting', 20, 76, 'Good morning,', { size: 14, fill: t.muted }),
      T('User_Name', 20, 102, 'Jdyy ✨', { size: 26, weight: 900, fill: t.text, ls: -0.5 }),
      G('Notifications_Button', [
        C('Button_Circle', 335, 86, 20, { fill: t.surface, stroke: t.border }),
        I('bell', 325, 76, 20, t.text),
      ]),
    ]),
    G('Weather_Card_OpenWeatherMap', [
      R('Card_Surface', 20, 118, 335, 116, { rx: 20, fill: t.mode === 'dark' ? B.darkCard : B.darkPlum, stroke: t.border, shadow: true }),
      I('cloudSun', 290, 148, 52, B.peachGold, { sw: 1.8 }),
      T('Location_Pill', 36, 144, 'Makati City · Live', { size: 12, weight: 700, fill: B.softLilac }),
      T('Temperature', 36, 188, '27°C', { size: 40, weight: 900, fill: B.paleYellow, ls: -1 }),
      T('Condition', 138, 172, 'Mainly Clear · Feels 31°C', { size: 13, weight: 600, fill: B.softCream }),
      T('Metrics', 138, 190, 'Humidity 76% · Wind 8 km/h', { size: 11.5, fill: B.softLilac }),
      G('Layer_Pill', [
        R('Pill_Bg', 36, 202, 160, 20, { rx: 10, fill: B.mediumPlum }),
        T('Pill_Label', 116, 216, 'Light layers you can adjust', { size: 10.5, weight: 700, fill: B.paleYellow, anchor: 'middle' }),
      ]),
    ]),
    sec('Section_Quick_Shortcuts', 20, 258, 'QUICK ACTIONS', t),
    G('Quick_Actions_Grid', qa.map(([label, icon], i) => {
      const x = 20 + i * 86;
      const cx = x + 38;
      return card(`Quick_Action_${label}`, x, 268, 77, 82, t, [
        C('Icon_Circle', cx, 298, 18, { fill: t.badge }),
        I(icon, cx - 9, 289, 18, t.mode === 'dark' ? B.softCream : B.darkPlum),
        T('Action_Label', cx, 336, label, { size: 9.5, weight: 700, fill: t.text, anchor: 'middle' }),
      ]);
    })),
    card('Wardrobe_Summary_Card', 20, 366, 335, 126, t, [
      T('Summary_Title', 36, 392, 'Wardrobe Summary', { size: 14.5, weight: 800, fill: t.text }),
      T('View_All_Link', 339, 392, 'View All >', { size: 12.5, weight: 700, fill: t.statIconColor, anchor: 'end' }),
      G('Summary_Stats_Row', [
        G('Stat_Items', [
          R('Tile_1', 36, 404, 96, 68, { rx: 14, fill: t.tileBg, stroke: t.border }),
          I('shirt', 48, 416, 18, t.statIconColor),
          T('Stat_Val_1', 48, 452, '13', { size: 20, weight: 900, fill: t.text }),
          T('Stat_Lbl_1', 48, 464, 'ITEMS', { size: 9.5, weight: 700, fill: t.muted }),
        ]),
        G('Stat_Favorites', [
          R('Tile_2', 139, 404, 96, 68, { rx: 14, fill: t.tileBg, stroke: t.border }),
          I('heart', 151, 416, 18, t.statIconColor),
          T('Stat_Val_2', 151, 452, '1', { size: 20, weight: 900, fill: t.text }),
          T('Stat_Lbl_2', 151, 464, 'FAVORITES', { size: 9.5, weight: 700, fill: t.muted }),
        ]),
        G('Stat_To_Wash', [
          R('Tile_3', 242, 404, 96, 68, { rx: 14, fill: t.tileBg, stroke: t.border }),
          I('droplet', 254, 416, 18, t.statIconColor),
          T('Stat_Val_3', 254, 452, '4', { size: 20, weight: 900, fill: t.text }),
          T('Stat_Lbl_3', 254, 464, 'TO WASH', { size: 9.5, weight: 700, fill: t.muted }),
        ]),
      ]),
    ]),
    card('Sustainability_Tip_Card', 20, 506, 335, 78, t, [
      C('Tip_Icon_Circle', 48, 545, 18, { fill: B.peachGold }),
      I('leaf', 39, 536, 18, B.darkPlum),
      T('Tip_Title', 76, 536, 'Sustainable Styling', { size: 13.5, weight: 800, fill: t.text }),
      TM('Tip_Body', 76, 552, ['Re-wearing your clean pieces reduces personal', 'wardrobe footprint by 24% this week.'], 15, { size: 11, fill: t.muted }),
    ]),
    card('Wardrobe_Analytics_Preview_Card', 20, 598, 335, 114, t, [
      T('Analytics_Title', 36, 622, 'Wardrobe Analytics', { size: 14, weight: 800, fill: t.text }),
      T('Analytics_Badge', 339, 622, 'Optimal Health', { size: 11.5, weight: 700, fill: t.statIconColor, anchor: 'end' }),
      G('Metric_Row_1', [
        T('M_Label_1', 36, 648, 'Garment Utilization Rate', { size: 11.5, weight: 600, fill: t.text }),
        T('M_Val_1', 339, 648, '84%', { size: 12, weight: 900, fill: t.text, anchor: 'end' }),
        R('Track_1', 36, 654, 303, 5, { rx: 2.5, fill: t.border }),
        R('Fill_1', 36, 654, 303 * 0.84, 5, { rx: 2.5, fill: t.statIconColor }),
      ]),
      G('Metric_Row_2', [
        T('M_Label_2', 36, 680, 'Clean Rotation Ratio', { size: 11.5, weight: 600, fill: t.text }),
        T('M_Val_2', 339, 680, '69%', { size: 12, weight: 900, fill: t.text, anchor: 'end' }),
        R('Track_2', 36, 686, 303, 5, { rx: 2.5, fill: t.border }),
        R('Fill_2', 36, 686, 303 * 0.69, 5, { rx: 2.5, fill: B.peachGold }),
      ]),
    ]),
    bottomNav(t, 'Home'),
    homeIndicator(t),
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. WARDROBE SCREEN (03_Wardrobe_Light & 04_Wardrobe_Dark)
// Mirrors WardrobeScreen.tsx (Title, "+ Add Clothes" button, "Filter By (0)"
// dropdown button, active filter chips row, 2-column garment grid)
// ═════════════════════════════════════════════════════════════════════════════
function buildWardrobeScreen(t) {
  const cw = (335 - 12) / 2;
  const items = [
    { title: 'White Jeans', cat: 'BOTTOM · Casual', type: 'pants', color: B.white, wash: false, fav: true },
    { title: 'Black SHOES', cat: 'SHOES · Workout', type: 'shoe', color: B.darkPlum, wash: false, fav: false },
    { title: 'Corduroy Jacket', cat: 'OUTERWEAR · Academic', type: 'jacket', color: B.peachGold, wash: false, fav: false },
    { title: 'Black Smartwatch', cat: 'ACCESSORIES · Office', type: 'bag', color: B.darkPlum, wash: true, fav: true },
  ];

  return [
    R('Background', 0, 0, 375, 812, { fill: t.bg }),
    statusBar(t),
    G('Header_Bar', [
      T('Screen_Title', 20, 88, 'Wardrobe', { size: 28, weight: 900, fill: t.text, ls: -0.6 }),
      T('Subtitle', 20, 110, '13 items · 9 clean', { size: 13, fill: t.muted }),
      btn('Add_Clothes_Header_Button', 225, 74, 130, 38, '+ Add Clothes', { t, size: 12.5, rx: 19 }),
    ]),
    G('Filter_Controls_Row', [
      G('Filter_By_Dropdown_Button', [
        R('Btn_Surface', 20, 126, 128, 36, { rx: 18, fill: t.surface, stroke: t.border }),
        I('options', 32, 136, 16, t.text),
        T('Btn_Label', 54, 149, 'Filter By (2)', { size: 12.5, weight: 700, fill: t.text }),
        I('chevronDown', 124, 136, 14, t.text),
      ]),
      G('Sort_Menu', [
        T('Sort_Label', 355, 148, 'Sort: Recent ▼', { size: 12, weight: 600, fill: t.muted, anchor: 'end' }),
      ]),
    ]),
    G('Active_Filter_Chips_Row', [
      G('Chip_1', [
        R('Chip_Surface_1', 20, 172, 112, 32, { rx: 16, fill: t.badge, stroke: t.border }),
        T('Chip_Text_1', 32, 192, 'Cat: BOTTOM', { size: 11, weight: 700, fill: t.badgeText }),
        I('x', 114, 180, 14, t.badgeText),
      ]),
      G('Chip_2', [
        R('Chip_Surface_2', 138, 172, 118, 32, { rx: 16, fill: t.badge, stroke: t.border }),
        T('Chip_Text_2', 150, 192, 'Occ: Academic', { size: 11, weight: 700, fill: t.badgeText }),
        I('x', 238, 180, 14, t.badgeText),
      ]),
    ]),
    G('Garment_Grid', items.map((it, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 20 + col * (cw + 12);
      const y = 216 + row * 242;
      return card(`Garment_Card_${i + 1}`, x, y, cw, 230, t, [
        tile('Garment_Thumbnail', x + 8, y + 8, cw - 16, 140, it.type, it.color, { rx: 12, bg: t.tileBg }),
        G('Fav_Heart', [
          C('Heart_Circle', x + cw - 24, y + 24, 14, { fill: t.surface, stroke: t.border }),
          I('heart', x + cw - 31, y + 17, 14, it.fav ? '#E5484D' : t.muted, { fill: it.fav ? '#E5484D' : undefined }),
        ]),
        it.wash && G('Needs_Wash_Badge', [
          R('Badge_Surface', x + 12, y + 120, 84, 20, { rx: 10, fill: B.peachGold }),
          T('Badge_Text', x + 54, y + 134, 'NEEDS WASH', { size: 9, weight: 800, fill: B.darkPlum, anchor: 'middle' }),
        ]),
        T('Garment_Title', x + 12, y + 172, it.title, { size: 14, weight: 800, fill: t.text }),
        T('Garment_Cat', x + 12, y + 190, it.cat, { size: 11, fill: t.muted }),
        G('Wear_Count_Pill', [
          T('Wear_Count', x + 12, y + 212, 'Worn 6 times', { size: 10.5, weight: 600, fill: t.statIconColor }),
        ]),
      ]);
    })),
    bottomNav(t, 'Wardrobe'),
    homeIndicator(t),
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. OUTFIT RECOMMENDATION SCREEN (05_Outfit_Light & 06_Outfit_Dark)
// Mirrors OutfitScreen.tsx (Title, Weather banner, No New Clothes Mode card,
// Top-3 Curated Outfits, Choice #1 pill + 94% Hybrid Match highlight text,
// OutfitRecommendationStatsBar, OutfitPreviewCard with ample badge padding)
// ═════════════════════════════════════════════════════════════════════════════
function buildOutfitScreen(t) {
  const occ = ['Academic', 'Office', 'Formal', 'Casual', 'Workout'];
  let ox = 20;
  const occPills = occ.map((l, i) => {
    const s = pill(`Occasion_${l}`, ox, 154, l, { t, size: 11, h: 28, px: 11, active: i === 0 });
    ox += pillW(l, { size: 11, px: 11 }) + 6;
    return s;
  });

  const tileW = (303 - 24) / 4;
  const tiles = [
    ['Top', 'knit', B.softLilac],
    ['Bottom', 'pants', B.darkPlum],
    ['Shoes', 'shoe', B.white],
    ['Accessory', 'bag', B.peachGold],
  ];

  const actW = (303 - 18) / 4;
  const actions = [
    ['Like', 'heart', 'secondary'],
    ['Dislike', 'thumbDown', 'secondary'],
    ['Save', 'bookmark', 'secondary'],
    ['Wear', 'check', 'primary'],
  ];

  return [
    R('Background', 0, 0, 375, 812, { fill: t.bg }),
    statusBar(t),
    G('Header_Bar', [
      T('Screen_Title', 20, 84, 'Outfit Recommendations', { size: 21, weight: 900, fill: t.text, ls: -0.5 }),
      T('Subtitle', 20, 104, 'Hybrid Content & Collaborative Filtering', { size: 12, fill: t.muted }),
      G('Refresh_Pill', [
        C('Pill_Circle', 337, 86, 18, { fill: t.surface, stroke: t.border }),
        I('sparkles', 329, 78, 16, t.text),
      ]),
    ]),
    G('Weather_Banner', [
      R('Banner_Surface', 20, 114, 335, 32, { rx: 16, fill: t.mode === 'dark' ? B.darkCard : B.darkPlum, stroke: t.border }),
      I('cloudSun', 30, 121, 18, B.peachGold),
      T('Weather_Text', 56, 134, [['Makati · 27°C', B.paleYellow, 800], ['  Mainly Clear · Feels 31°C', B.softLilac, 500]], { size: 11.5 }),
    ]),
    G('Occasion_Filters', occPills),
    card('No_New_Clothes_Card', 20, 192, 335, 50, t, [
      C('Icon_Circle', 44, 217, 14, { fill: B.peachGold }),
      I('leaf', 37, 210, 14, B.darkPlum),
      T('Mode_Title', 68, 215, 'No New Clothes Mode', { size: 13, weight: 800, fill: t.text }),
      T('Mode_Subtitle', 68, 230, 'Re-wear only pieces you own', { size: 10.5, fill: t.muted }),
      toggle('No_New_Clothes_Switch', 295, 204, true, t),
    ]),
    G('Top3_Choice_Header', [
      sec('Top3_Label', 20, 260, 'TOP-3 CURATED OUTFITS', t),
      G('Choice_Row', [
        R('Choice_Pill', 20, 270, 78, 26, { rx: 13, fill: t.mode === 'dark' ? B.darkTile : B.softLilac }),
        T('Choice_Text', 59, 287, 'Choice #1', { size: 11, weight: 800, fill: t.text, anchor: 'middle' }),
        T('Match_Highlight', 108, 287, '94% Hybrid Match', { size: 12, weight: 800, fill: t.highlightText }),
      ]),
    ]),
    card('Hybrid_Stats_Bar_Card', 20, 306, 335, 78, t, [
      I('chart', 34, 320, 16, t.highlightText),
      T('Stats_Bar_Title', 56, 332, 'Top-3 Outfit  ·  Hybrid Recommendation Breakdown', { size: 11, weight: 800, fill: t.highlightText }),
      G('Breakdown_Metrics', [
        G('Col_1', [
          T('Score_Big', 36, 362, '94%', { size: 22, weight: 900, fill: t.highlightText }),
          T('Score_Lbl', 36, 375, 'HYBRID SCORE', { size: 8.5, weight: 800, fill: t.muted }),
        ]),
        G('Col_2', [
          T('Val_2', 120, 362, '96%', { size: 15, weight: 800, fill: t.text }),
          T('Lbl_2', 120, 375, 'Content', { size: 9, weight: 600, fill: t.muted }),
        ]),
        G('Col_3', [
          T('Val_3', 190, 362, '91%', { size: 15, weight: 800, fill: t.text }),
          T('Lbl_3', 190, 375, 'Collab', { size: 9, weight: 600, fill: t.muted }),
        ]),
        G('Col_4', [
          T('Val_4', 260, 362, '100%', { size: 15, weight: 800, fill: t.text }),
          T('Lbl_4', 260, 375, 'Reuse', { size: 9, weight: 600, fill: t.muted }),
        ]),
      ]),
    ]),
    card('Outfit_Preview_Card', 20, 394, 335, 318, t, [
      G('Badge_Pill', [
        R('Pill_Surface', 36, 406, 178, 24, { rx: 12, fill: B.peachGold }),
        T('Pill_Text', 125, 422, 'Top Pick · Best Hybrid Match', { size: 10, weight: 800, fill: B.darkPlum, anchor: 'middle' }),
      ]),
      G('Context_Badges', [
        R('Ctx_Badge', 248, 406, 91, 24, { rx: 12, fill: t.tileBg, stroke: t.border }),
        T('Ctx_Text', 293, 422, '27°C · Casual', { size: 10, weight: 700, fill: t.text, anchor: 'middle' }),
      ]),
      T('Outfit_Name', 36, 448, 'Lilac Knit Polo & White Jeans', { size: 14, weight: 800, fill: t.text }),
      T('Outfit_Sub', 36, 465, 'Optimal breathability for 27°C Makati weather', { size: 11, fill: t.muted }),
      G('Garment_Tiles', tiles.map(([n, type, col], i) =>
        tile(`Tile_${n}`, 36 + i * (tileW + 8), 476, tileW, 68, type, col, { rx: 10, bg: t.tileBg }))),
      G('Score_Bars', [
        T('Formula_Lbl', 36, 564, 'Hybrid Score: 0.55 × 96% + 0.45 × 91% = 94%', { size: 10.5, weight: 700, fill: t.statIconColor }),
        R('F_Track', 36, 572, 303, 6, { rx: 3, fill: t.border }),
        R('F_Fill', 36, 572, 303 * 0.94, 6, { rx: 3, fill: t.statIconColor }),
      ]),
      G('Action_Buttons_Row', actions.map(([label, icon, v], i) =>
        btn(`${label}_Btn`, 36 + i * (actW + 6), 594, actW, 32, label, { t, variant: v, icon, size: 11, iconSize: 13 }))),
      G('Wear_Notice', [
        T('Notice_Text', 187.5, 642, 'Worn today? Tap Wear to update laundry status', { size: 10.5, fill: t.muted, anchor: 'middle' }),
      ]),
    ]),
    bottomNav(t, 'Outfit'),
    homeIndicator(t),
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. COMMUNITY SCREEN (07_Community_Light & 08_Community_Dark)
// Mirrors CommunityScreen.tsx (Title, "+ Post Look" button, "Recent" / "Trending"
// mode selector pills, shared outfit cards with 5-star rating, AI Moderation Shield)
// ═════════════════════════════════════════════════════════════════════════════
function buildCommunityScreen(t) {
  const shield = (x, y) => G('AI_Moderation_Shield_Badge', [
    R('Badge_Surface', x, y, 102, 22, { rx: 11, fill: t.mode === 'dark' ? B.mediumPlum : B.softLilac, stroke: t.border }),
    I('shield', x + 8, y + 4, 13, t.mode === 'dark' ? B.paleYellow : B.darkPlum),
    T('Badge_Label', x + 26, y + 15, 'AI Moderated', { size: 10, weight: 800, fill: t.mode === 'dark' ? B.paleYellow : B.darkPlum }),
  ]);

  const stars = (x, y, filled) => G('Star_Rating', [1, 2, 3, 4, 5].map((n) =>
    I('star', x + (n - 1) * 18, y, 14, n <= filled ? B.peachGold : t.muted, { fill: n <= filled ? B.peachGold : undefined, sw: 1.5 })));

  const post = (id, y, user, handle, initial, outfitName, caption, rating, likes, saves) =>
    card(`Post_Card_${id}`, 20, y, 335, 252, t, [
      G('Author_Header', [
        C('Avatar', 44, y + 26, 16, { fill: B.peachGold }),
        T('Avatar_Init', 44, y + 31, initial, { size: 11, weight: 800, fill: B.darkPlum, anchor: 'middle' }),
        T('User_Name', 68, y + 23, user, { size: 13.5, weight: 800, fill: t.text }),
        T('User_Handle', 68, y + 38, handle, { size: 11, fill: t.muted }),
      ]),
      shield(233, y + 14),
      T('Outfit_Title', 36, y + 68, outfitName, { size: 13.5, weight: 800, fill: t.text }),
      TM('Caption', 36, y + 84, caption, 15, { size: 11.5, fill: t.muted }),
      G('Garments_Preview_Row', [
        tile('Garment_1', 36, y + 116, 70, 58, 'knit', B.softLilac, { rx: 10, bg: t.tileBg }),
        tile('Garment_2', 114, y + 116, 70, 58, 'pants', B.white, { rx: 10, bg: t.tileBg }),
        tile('Garment_3', 192, y + 116, 70, 58, 'shoe', B.darkPlum, { rx: 10, bg: t.tileBg }),
        tile('Garment_4', 270, y + 116, 68, 58, 'jacket', B.peachGold, { rx: 10, bg: t.tileBg }),
      ]),
      R('Divider', 36, y + 188, 303, 1, { fill: t.border }),
      G('Rating_Row', [
        T('Rate_Label', 36, y + 208, 'Community Rating:', { size: 11, weight: 600, fill: t.muted }),
        stars(142, y + 196, rating),
        T('Rate_Score', 242, y + 208, '4.8 (32)', { size: 11, weight: 700, fill: t.text }),
      ]),
      G('Actions_Footer', [
        G('Like_Btn', [
          I('heart', 36, y + 222, 16, '#E5484D', { fill: '#E5484D' }),
          T('Like_Count', 58, y + 235, String(likes), { size: 12, weight: 700, fill: t.text }),
        ]),
        G('Save_Btn', [
          I('bookmark', 106, y + 222, 16, t.text),
          T('Save_Count', 128, y + 235, String(saves), { size: 12, weight: 700, fill: t.text }),
        ]),
        G('Share_Btn', [
          I('share', 176, y + 222, 16, t.text),
        ]),
      ]),
    ]);

  return [
    R('Background', 0, 0, 375, 812, { fill: t.bg }),
    statusBar(t),
    G('Header_Bar', [
      T('Screen_Title', 20, 88, 'Community', { size: 28, weight: 900, fill: t.text, ls: -0.6 }),
      T('Subtitle', 20, 110, 'Find and share your favorite looks', { size: 13, fill: t.muted }),
      btn('Post_Look_Header_Button', 245, 74, 110, 38, 'Post Look', { t, icon: 'plus', size: 12.5, iconSize: 14, rx: 19 }),
    ]),
    G('Mode_Pills_Row', [
      pill('Pill_Recent', 20, 126, 'Recent', { t, active: true, size: 12.5, h: 32 }),
      pill('Pill_Trending', 20 + pillW('Recent', { size: 12.5 }) + 8, 126, 'Trending', { t, active: false, size: 12.5, h: 32 }),
    ]),
    post('1', 172, 'Sophia Reyes', '@sophia.fits · 2h · Academic', 'S', 'Casual Academic Layers', ['Light lilac knit paired with relaxed denim.', 'Comfortable for campus walking all day!'], 5, 48, 14),
    post('2', 438, 'Marco Tan', '@marco.style · 6h · Office', 'M', 'Smart Casual Office Rotation', ['Earth tones with peach outerwear layer.', 'Re-wearing wardrobe staples sustainably.'], 4, 32, 9),
    bottomNav(t, 'Community'),
    homeIndicator(t),
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. ACCOUNT / SETTINGS SCREEN (09_Account_Light & 10_Account_Dark)
// Mirrors ProfileScreen.tsx & SettingsScreen.tsx (Profile card, Stats row:
// 13 Items, 1 Fav, 24 Wears, Appearance Theme toggle, Alert Preferences
// 4 switches, Language selector, Sign Out button)
// ═════════════════════════════════════════════════════════════════════════════
function buildAccountScreen(t) {
  const alerts = [
    ['Weather Alerts', 'Live conditions for your outfit', 'cloudSun', true],
    ['Sustainability Tips', 'Re-wear and care nudges', 'leaf', true],
    ['Outfit Reminders', 'Planned looks for tomorrow', 'shirt', true],
    ['Laundry Reminders', 'When pieces need washing', 'droplet', false],
  ];

  return [
    R('Background', 0, 0, 375, 812, { fill: t.bg }),
    statusBar(t),
    G('Header_Bar', [
      T('Screen_Title', 20, 88, 'Account', { size: 28, weight: 900, fill: t.text, ls: -0.6 }),
      T('Subtitle', 20, 110, 'Profile, settings & alert preferences', { size: 13, fill: t.muted }),
      G('Notifications_Bell', [
        C('Button_Circle', 335, 86, 20, { fill: t.surface, stroke: t.border }),
        I('bell', 325, 76, 20, t.text),
      ]),
    ]),
    card('Profile_Card', 20, 126, 335, 142, t, [
      C('Avatar_Circle', 56, 160, 24, { fill: B.peachGold }),
      T('Avatar_Initial', 56, 167, 'J', { size: 18, weight: 800, fill: B.darkPlum, anchor: 'middle' }),
      T('Profile_Name', 92, 154, 'Jdyy', { size: 16, weight: 800, fill: t.text }),
      T('Profile_Email', 92, 171, 'jdyy@stylesense.app', { size: 11.5, fill: t.muted }),
      T('Member_Since', 92, 186, 'Member since 2026', { size: 10.5, fill: t.muted }),
      btn('Edit_Profile_Btn', 242, 146, 96, 30, 'Edit Profile', { t, variant: 'secondary', size: 11, rx: 15 }),
      G('Profile_Stats_Row', [
        R('Stats_Surface', 36, 198, 303, 56, { rx: 14, fill: t.tileBg, stroke: t.border }),
        G('Stat_1', [
          T('S1_Val', 86, 224, '13', { size: 17, weight: 900, fill: t.text, anchor: 'middle' }),
          T('S1_Lbl', 86, 240, 'Items', { size: 10.5, fill: t.muted, anchor: 'middle' }),
        ]),
        R('S_Div_1', 137, 208, 1, 36, { fill: t.border }),
        G('Stat_2', [
          T('S2_Val', 188, 224, '1', { size: 17, weight: 900, fill: t.text, anchor: 'middle' }),
          T('S2_Lbl', 188, 240, 'Favorites', { size: 10.5, fill: t.muted, anchor: 'middle' }),
        ]),
        R('S_Div_2', 239, 208, 1, 36, { fill: t.border }),
        G('Stat_3', [
          T('S3_Val', 289, 224, '24', { size: 17, weight: 900, fill: t.text, anchor: 'middle' }),
          T('S3_Lbl', 289, 240, 'Wears', { size: 10.5, fill: t.muted, anchor: 'middle' }),
        ]),
      ]),
    ]),
    sec('Section_Appearance', 20, 290, 'APPEARANCE', t),
    card('Appearance_Card', 20, 300, 335, 54, t, [
      I('moon', 36, 317, 18, t.text),
      T('Theme_Title', 62, 326, 'Theme', { size: 13.5, weight: 800, fill: t.text }),
      T('Theme_Sub', 62, 342, 'Light and Dark mode switching', { size: 10.5, fill: t.muted }),
      G('Theme_Selector', [
        R('Track', 223, 311, 116, 32, { rx: 16, fill: t.tileBg, stroke: t.border }),
        t.mode === 'light'
          ? G('Light_Active', [
              R('Pill_Light', 225, 313, 56, 28, { rx: 14, fill: B.darkPlum }),
              T('Lbl_L', 253, 331, 'Light', { size: 11, weight: 800, fill: B.paleYellow, anchor: 'middle' }),
              T('Lbl_D', 309, 331, 'Dark', { size: 11, weight: 600, fill: t.muted, anchor: 'middle' }),
            ])
          : G('Dark_Active', [
              T('Lbl_L', 253, 331, 'Light', { size: 11, weight: 600, fill: t.muted, anchor: 'middle' }),
              R('Pill_Dark', 281, 313, 56, 28, { rx: 14, fill: B.paleYellow }),
              T('Lbl_D', 309, 331, 'Dark', { size: 11, weight: 800, fill: B.darkPlum, anchor: 'middle' }),
            ]),
      ]),
    ]),
    sec('Section_Alert_Prefs', 20, 376, 'ALERT PREFERENCES', t),
    T('Alert_Count', 355, 376, '3 of 4 active', { size: 11.5, weight: 700, fill: t.muted, anchor: 'end' }),
    card('Alert_Prefs_Card', 20, 386, 335, 216, t, alerts.map(([label, note, icon, on], i) => {
      const y = 386 + i * 54;
      return G(`Alert_Row_${label}`, [
        i > 0 && R(`Divider_${i}`, 62, y, 277, 1, { fill: t.border }),
        I(icon, 36, y + 17, 18, t.text),
        T('Alert_Label', 62, y + 25, label, { size: 13, weight: 800, fill: t.text }),
        T('Alert_Note', 62, y + 41, note, { size: 10.5, fill: t.muted }),
        toggle(`Switch_${label}`, 295, y + 14, on, t),
      ]);
    })),
    card('Settings_Menu_Card', 20, 616, 335, 88, t, [
      G('Language_Row', [
        I('settings', 36, 627, 18, t.text),
        T('Lang_Label', 62, 638, 'Language', { size: 13, weight: 800, fill: t.text }),
        T('Lang_Val', 320, 638, 'English (US)', { size: 12, fill: t.muted, anchor: 'end' }),
        I('chevronRight', 326, 627, 16, t.muted),
      ]),
      R('Menu_Div', 62, 658, 277, 1, { fill: t.border }),
      G('Sign_Out_Row', [
        I('logout', 36, 669, 18, '#E5484D'),
        T('SignOut_Label', 62, 680, 'Sign Out', { size: 13, weight: 800, fill: '#E5484D' }),
      ]),
    ]),
    bottomNav(t, 'Account'),
    homeIndicator(t),
  ];
}

// ── Complete Screen Catalog (17 Standalone Screens) ──────────────────────────
const screens = [
  // Onboarding Flow (Intro + Steps 1-4)
  ['00a_Onboarding_Welcome_Light.svg', THEMES.light, buildOnboardingWelcomeLight],
  ['00b_Onboarding_Step1_Name_Light.svg', THEMES.light, buildOnboardingStep1NameLight],
  ['00c_Onboarding_Step2_Style_Light.svg', THEMES.light, buildOnboardingStep2StyleLight],
  ['00d_Onboarding_Step3_Colours_Light.svg', THEMES.light, buildOnboardingStep3ColoursLight],
  ['00e_Onboarding_Step4_Occasions_Light.svg', THEMES.light, buildOnboardingStep4OccasionsLight],
  // Auth Screens (Sign In Light & Dark)
  ['00f_Sign_In_Light.svg', THEMES.light, buildSignInScreen],
  ['00g_Sign_In_Dark.svg', THEMES.dark, buildSignInScreen],
  // 5 Main Tabs (Light & Dark)
  ['01_Home_Light.svg', THEMES.light, buildHomeScreen],
  ['02_Home_Dark.svg', THEMES.dark, buildHomeScreen],
  ['03_Wardrobe_Light.svg', THEMES.light, buildWardrobeScreen],
  ['04_Wardrobe_Dark.svg', THEMES.dark, buildWardrobeScreen],
  ['05_Outfit_Light.svg', THEMES.light, buildOutfitScreen],
  ['06_Outfit_Dark.svg', THEMES.dark, buildOutfitScreen],
  ['07_Community_Light.svg', THEMES.light, buildCommunityScreen],
  ['08_Community_Dark.svg', THEMES.dark, buildCommunityScreen],
  ['09_Account_Light.svg', THEMES.light, buildAccountScreen],
  ['10_Account_Dark.svg', THEMES.dark, buildAccountScreen],
];

console.log(`Generating ${screens.length} standalone, Figma-ready 375x812 SVGs...`);

for (const [file, theme, builder] of screens) {
  ids = new Map();
  const screenId = file.replace(/\.svg$/, '');
  ids.set(screenId, 1);
  const body = builder(theme);
  const svg = svgDoc(screenId, theme, body);
  fs.writeFileSync(path.join(OUT, file), svg, 'utf8');
  const groups = (svg.match(/<g /g) || []).length;
  const texts = (svg.match(/<text /g) || []).length;
  console.log(`${file.padEnd(38)} ${String(groups).padStart(4)} groups  ${String(texts).padStart(3)} text  ${(svg.length / 1024).toFixed(1)} KB`);
}

console.log(`Done! All ${screens.length} SVGs successfully generated in figma-layered-screens/.`);
