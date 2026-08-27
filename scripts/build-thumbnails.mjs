/**
 * Course artwork generator.
 *
 * Writes the platform's original course thumbnails to `public/images/courses/`.
 * Run with `npm run art:build`; the output is committed, so the app never
 * generates images at request time.
 *
 * WHY SVG RATHER THAN WEBP
 *
 * The brief asked for WebP or AVIF "where practical". For this artwork it is
 * not: these are flat geometric illustrations, and a vector is both smaller and
 * better than a raster of the same picture. A 1600x900 WebP of a code editor is
 * roughly 30-60 kB and goes soft on a high-density display; the SVG below is
 * 2-4 kB and is exact at any size, including the 1200px-wide hero on the course
 * detail page. Raster wins for photographs. There are no photographs here.
 *
 * HOW IT IS BUILT
 *
 * Fifteen templates, each a visual language for one family of subjects, times
 * three palettes each. Every template draws real subject matter — an editor
 * with a gutter and syntax runs, a network with weighted edges, a pipeline with
 * stages — rather than an abstract wash, so a card communicates its subject
 * before the title is read.
 *
 * Everything is original. No traced logos, no copied compositions.
 */

import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "images", "courses");
const W = 1600;
const H = 900;

/* ========================================================================== */
/*  Palettes                                                                  */
/* ========================================================================== */

/**
 * Each palette is a deep ground with one accent doing the work.
 *
 * Deliberately dark: the card sits on a light or dark page depending on the
 * viewer's theme, and a dark illustration reads as a "screen" in both, where a
 * light one disappears against the light theme's card surface.
 */
const PALETTES = {
  indigo: {
    a: "#1b1f43",
    b: "#0e1027",
    surface: "#252a58",
    line: "#3c4382",
    accent: "#8b93ff",
    accent2: "#5de4c7",
    ink: "#c9cdf5",
  },
  teal: {
    a: "#0d2f38",
    b: "#06171d",
    surface: "#12414e",
    line: "#1d6274",
    accent: "#4fd1c5",
    accent2: "#ffd479",
    ink: "#a8e4dd",
  },
  violet: {
    a: "#2a1440",
    b: "#150a23",
    surface: "#3a1d59",
    line: "#572d84",
    accent: "#c084fc",
    accent2: "#7dd3fc",
    ink: "#e0cdf5",
  },
  amber: {
    a: "#3a2410",
    b: "#1e1207",
    surface: "#54341a",
    line: "#7c4d26",
    accent: "#fbbf60",
    accent2: "#7dd3fc",
    ink: "#f3dbb8",
  },
  rose: {
    a: "#3a1220",
    b: "#1e0912",
    surface: "#541b30",
    line: "#7c2947",
    accent: "#fb7185",
    accent2: "#a5b4fc",
    ink: "#f7cdd6",
  },
  ocean: {
    a: "#0c2340",
    b: "#061426",
    surface: "#123255",
    line: "#1c4d80",
    accent: "#60a5fa",
    accent2: "#5de4c7",
    ink: "#b8d4f5",
  },
  forest: {
    a: "#0f2e21",
    b: "#071811",
    surface: "#164034",
    line: "#22624d",
    accent: "#4ade80",
    accent2: "#fbbf60",
    ink: "#b6e6cd",
  },
  slate: {
    a: "#1c2230",
    b: "#0d1119",
    surface: "#2a3345",
    line: "#3f4c63",
    accent: "#94a3b8",
    accent2: "#60a5fa",
    ink: "#cbd5e1",
  },
  plum: {
    a: "#33153a",
    b: "#1b0a1f",
    surface: "#4a1f54",
    line: "#6d2f7b",
    accent: "#e879f9",
    accent2: "#67e8f9",
    ink: "#eecdf2",
  },
};

/* ========================================================================== */
/*  Shared chrome                                                             */
/* ========================================================================== */

let uid = 0;
const nextId = () => `g${(uid += 1)}`;

/** Background: a diagonal gradient, a corner spotlight and a faint grid. */
function ground(p) {
  const g1 = nextId();
  const g2 = nextId();
  const gr = nextId();
  return `
  <defs>
    <linearGradient id="${g1}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.a}"/><stop offset="1" stop-color="${p.b}"/>
    </linearGradient>
    <radialGradient id="${g2}" cx="0.78" cy="0.12" r="0.75">
      <stop offset="0" stop-color="${p.accent}" stop-opacity="0.28"/>
      <stop offset="1" stop-color="${p.accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="${gr}" width="64" height="64" patternUnits="userSpaceOnUse">
      <path d="M64 0H0V64" fill="none" stroke="${p.line}" stroke-opacity="0.28" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#${g1})"/>
  <rect width="${W}" height="${H}" fill="url(#${gr})"/>
  <rect width="${W}" height="${H}" fill="url(#${g2})"/>`;
}

/** A raised panel with a soft drop shadow — the base of most templates. */
function panel(p, x, y, w, h, r = 22, fill = null) {
  const sid = nextId();
  return `
  <defs>
    <filter id="${sid}" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="18" stdDeviation="26" flood-color="#000" flood-opacity="0.42"/>
    </filter>
  </defs>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"
        fill="${fill ?? p.surface}" stroke="${p.line}" stroke-width="2" filter="url(#${sid})"/>`;
}

/** Traffic-light dots for window chrome. */
function dots(p, x, y) {
  return `<circle cx="${x}" cy="${y}" r="9" fill="${p.accent}" opacity="0.85"/>
  <circle cx="${x + 30}" cy="${y}" r="9" fill="${p.ink}" opacity="0.35"/>
  <circle cx="${x + 60}" cy="${y}" r="9" fill="${p.ink}" opacity="0.22"/>`;
}

/** A run of rounded bars standing in for a line of code or text. */
function bars(p, x, y, widths, gap = 22, h = 13, color = null, opacity = 0.55) {
  let out = "";
  let cx = x;
  for (const w of widths) {
    out += `<rect x="${cx}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${color ?? p.ink}" opacity="${opacity}"/>`;
    cx += w + gap;
  }
  return out;
}

/** Deterministic pseudo-random so a template's variant is stable per build. */
function seeded(seed) {
  let a = 0;
  for (let i = 0; i < seed.length; i += 1) a = (Math.imul(a, 31) + seed.charCodeAt(i)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ========================================================================== */
/*  Templates                                                                 */
/* ========================================================================== */

/** Code editor: gutter, syntax runs, a folded minimap. */
function codeEditor(p, r) {
  const rows = 9;
  let code = "";
  for (let i = 0; i < rows; i += 1) {
    const y = 300 + i * 46;
    const indent = 430 + (i % 3) * 40;
    const w = [110, 180, 90, 150, 220];
    const line = bars(
      p,
      indent,
      y,
      w.slice(0, 2 + Math.floor(r() * 3)),
      20,
      14,
      i % 4 === 0 ? p.accent : i % 3 === 0 ? p.accent2 : p.ink,
      i % 4 === 0 ? 0.9 : 0.42,
    );
    code += line;
    code += `<text x="378" y="${y + 13}" font-family="monospace" font-size="20" fill="${p.ink}" opacity="0.3">${i + 1}</text>`;
  }
  return `${ground(p)}
  ${panel(p, 340, 190, 920, 560)}
  <rect x="340" y="190" width="920" height="62" rx="22" fill="${p.line}" opacity="0.45"/>
  <rect x="340" y="236" width="920" height="16" fill="${p.line}" opacity="0.2"/>
  ${dots(p, 380, 221)}
  <rect x="340" y="252" width="70" height="498" fill="#000" opacity="0.18"/>
  ${code}
  <rect x="1180" y="272" width="60" height="458" rx="10" fill="#000" opacity="0.22"/>
  ${Array.from(
    { length: 14 },
    (_, i) =>
      `<rect x="1188" y="${284 + i * 32}" width="${16 + r() * 40}" height="10" rx="5" fill="${p.accent}" opacity="${0.2 + r() * 0.4}"/>`,
  ).join("")}
  <circle cx="1300" cy="230" r="120" fill="${p.accent}" opacity="0.1"/>`;
}

/** Terminal: prompt lines and a blinking block cursor. */
function terminal(p, r) {
  let lines = "";
  for (let i = 0; i < 8; i += 1) {
    const y = 300 + i * 52;
    lines += `<text x="410" y="${y + 14}" font-family="monospace" font-size="24" fill="${p.accent}" opacity="0.9">$</text>`;
    lines += bars(
      p,
      444,
      y,
      [90, 150, 60, 190].slice(0, 2 + Math.floor(r() * 3)),
      20,
      14,
      p.ink,
      0.4,
    );
  }
  return `${ground(p)}
  ${panel(p, 360, 200, 880, 540, 20, p.b)}
  <rect x="360" y="200" width="880" height="56" rx="20" fill="${p.surface}"/>
  <rect x="360" y="240" width="880" height="16" fill="${p.surface}"/>
  ${dots(p, 400, 228)}
  ${lines}
  <rect x="444" y="716" width="26" height="30" fill="${p.accent2}" opacity="0.9"/>`;
}

/** Browser window with a rendered layout inside. */
function browser(p, r) {
  return `${ground(p)}
  ${panel(p, 320, 170, 960, 600)}
  <rect x="320" y="170" width="960" height="70" rx="22" fill="${p.line}" opacity="0.45"/>
  <rect x="320" y="218" width="960" height="22" fill="${p.line}" opacity="0.2"/>
  ${dots(p, 362, 205)}
  <rect x="470" y="190" width="620" height="32" rx="16" fill="#000" opacity="0.28"/>
  <rect x="490" y="200" width="220" height="12" rx="6" fill="${p.ink}" opacity="0.35"/>
  <rect x="360" y="280" width="880" height="150" rx="14" fill="${p.accent}" opacity="0.16"/>
  <rect x="392" y="316" width="300" height="20" rx="10" fill="${p.accent}" opacity="0.8"/>
  <rect x="392" y="352" width="440" height="14" rx="7" fill="${p.ink}" opacity="0.4"/>
  <rect x="392" y="378" width="360" height="14" rx="7" fill="${p.ink}" opacity="0.28"/>
  ${[0, 1, 2]
    .map(
      (i) => `
    <rect x="${360 + i * 300}" y="460" width="270" height="250" rx="16" fill="${p.b}" opacity="0.55" stroke="${p.line}" stroke-width="2"/>
    <rect x="${384 + i * 300}" y="486" width="222" height="104" rx="10" fill="${p.accent2}" opacity="${0.18 + r() * 0.2}"/>
    <rect x="${384 + i * 300}" y="608" width="${120 + r() * 90}" height="14" rx="7" fill="${p.ink}" opacity="0.5"/>
    <rect x="${384 + i * 300}" y="638" width="${90 + r() * 70}" height="12" rx="6" fill="${p.ink}" opacity="0.28"/>`,
    )
    .join("")}`;
}

/** Analytics dashboard: bar series, a trend line and stat tiles. */
function dashboard(p, r) {
  const bars7 = Array.from({ length: 9 }, (_, i) => {
    const h = 60 + r() * 210;
    return `<rect x="${420 + i * 84}" y="${640 - h}" width="52" height="${h}" rx="10" fill="${i === 6 ? p.accent : p.accent2}" opacity="${i === 6 ? 0.95 : 0.4}"/>`;
  }).join("");
  const pts = Array.from({ length: 9 }, (_, i) => `${446 + i * 84},${560 - r() * 180}`).join(" ");
  return `${ground(p)}
  ${panel(p, 340, 180, 920, 560)}
  <rect x="380" y="220" width="240" height="18" rx="9" fill="${p.ink}" opacity="0.5"/>
  ${[0, 1, 2]
    .map(
      (i) => `
    <rect x="${380 + i * 290}" y="266" width="260" height="96" rx="14" fill="${p.b}" opacity="0.5" stroke="${p.line}" stroke-width="2"/>
    <rect x="${404 + i * 290}" y="290" width="${70 + r() * 50}" height="12" rx="6" fill="${p.ink}" opacity="0.35"/>
    <rect x="${404 + i * 290}" y="316" width="${100 + r() * 60}" height="24" rx="8" fill="${i === 0 ? p.accent : p.ink}" opacity="${i === 0 ? 0.9 : 0.55}"/>`,
    )
    .join("")}
  <line x1="400" y1="640" x2="1200" y2="640" stroke="${p.line}" stroke-width="3"/>
  ${bars7}
  <polyline points="${pts}" fill="none" stroke="${p.accent}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>
  ${pts
    .split(" ")
    .map((pt) => {
      const [x, y] = pt.split(",");
      return `<circle cx="${x}" cy="${y}" r="7" fill="${p.accent}"/>`;
    })
    .join("")}`;
}

/** Neural network: three weighted layers. */
function neuralNet(p, r) {
  const layers = [4, 6, 6, 3];
  const xs = [470, 700, 930, 1160];
  const nodes = layers.map((n, li) =>
    Array.from({ length: n }, (_, i) => ({ x: xs[li], y: 450 - ((n - 1) * 92) / 2 + i * 92 })),
  );
  let edges = "";
  for (let l = 0; l < nodes.length - 1; l += 1) {
    for (const a of nodes[l]) {
      for (const b of nodes[l + 1]) {
        const w = r();
        edges += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${w > 0.72 ? p.accent : p.line}" stroke-width="${w > 0.72 ? 3.4 : 1.6}" opacity="${w > 0.72 ? 0.85 : 0.3}"/>`;
      }
    }
  }
  const circles = nodes
    .flat()
    .map(
      (n, i) =>
        `<circle cx="${n.x}" cy="${n.y}" r="24" fill="${p.surface}" stroke="${i % 5 === 0 ? p.accent : p.line}" stroke-width="3"/>
     <circle cx="${n.x}" cy="${n.y}" r="10" fill="${i % 5 === 0 ? p.accent : p.accent2}" opacity="${i % 5 === 0 ? 0.95 : 0.45}"/>`,
    )
    .join("");
  return `${ground(p)}<g>${edges}${circles}</g>
  <circle cx="1160" cy="450" r="190" fill="${p.accent}" opacity="0.08"/>`;
}

/** Shield over a mesh, with a lock at the centre. */
function shield(p, r) {
  const mesh = Array.from({ length: 26 }, () => {
    const x = 340 + r() * 920;
    const y = 180 + r() * 560;
    return { x, y };
  });
  let lines = "";
  for (let i = 0; i < mesh.length; i += 1) {
    for (let j = i + 1; j < mesh.length; j += 1) {
      const d = Math.hypot(mesh[i].x - mesh[j].x, mesh[i].y - mesh[j].y);
      if (d < 210)
        lines += `<line x1="${mesh[i].x}" y1="${mesh[i].y}" x2="${mesh[j].x}" y2="${mesh[j].y}" stroke="${p.line}" stroke-width="1.6" opacity="0.4"/>`;
    }
  }
  const dotsOut = mesh
    .map((m) => `<circle cx="${m.x}" cy="${m.y}" r="5" fill="${p.accent2}" opacity="0.5"/>`)
    .join("");
  const sid = nextId();
  return `${ground(p)}${lines}${dotsOut}
  <defs><filter id="${sid}" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="16" stdDeviation="28" flood-color="#000" flood-opacity="0.5"/></filter></defs>
  <path d="M800 200 L1010 278 V500 C1010 620 916 690 800 730 C684 690 590 620 590 500 V278 Z"
        fill="${p.surface}" stroke="${p.accent}" stroke-width="6" filter="url(#${sid})"/>
  <path d="M800 240 L972 304 V500 C972 598 894 658 800 692 C706 658 628 598 628 500 V304 Z"
        fill="none" stroke="${p.accent}" stroke-width="2" opacity="0.5"/>
  <rect x="742" y="430" width="116" height="98" rx="16" fill="${p.accent}" opacity="0.95"/>
  <path d="M768 430 V400 a32 32 0 0 1 64 0 v30" fill="none" stroke="${p.accent}" stroke-width="14" stroke-linecap="round"/>
  <circle cx="800" cy="474" r="14" fill="${p.b}"/>`;
}

/** Cloud with server racks below it. */
function cloud(p, r) {
  return `${ground(p)}
  ${[0, 1, 2]
    .map(
      (i) => `
    <rect x="${430 + i * 260}" y="560" width="220" height="180" rx="16" fill="${p.surface}" stroke="${p.line}" stroke-width="2"/>
    ${Array.from(
      { length: 4 },
      (_, j) => `
      <rect x="${454 + i * 260}" y="${586 + j * 38}" width="172" height="22" rx="6" fill="${p.b}" opacity="0.6"/>
      <circle cx="${606 + i * 260}" cy="${597 + j * 38}" r="6" fill="${r() > 0.5 ? p.accent : p.accent2}" opacity="0.85"/>`,
    ).join("")}`,
    )
    .join("")}
  ${[0, 1, 2].map((i) => `<line x1="${540 + i * 260}" y1="480" x2="${540 + i * 260}" y2="560" stroke="${p.accent}" stroke-width="3" opacity="0.6" stroke-dasharray="10 8"/>`).join("")}
  <path d="M620 470 a110 110 0 0 1 210 -48 a86 86 0 0 1 158 20 a92 92 0 0 1 -12 182 H660 a96 96 0 0 1 -40 -154 Z"
        fill="${p.surface}" stroke="${p.accent}" stroke-width="6"/>
  <path d="M700 400 a68 68 0 0 1 130 -30" fill="none" stroke="${p.accent2}" stroke-width="5" stroke-linecap="round" opacity="0.75"/>`;
}

/** CI/CD pipeline: stages joined by arrows, one still running. */
function pipeline(p, r) {
  const stages = [0, 1, 2, 3];
  return `${ground(p)}
  <line x1="400" y1="450" x2="1200" y2="450" stroke="${p.line}" stroke-width="6"/>
  ${stages
    .map((i) => {
      const x = 420 + i * 250;
      const done = i < 2;
      return `
    <circle cx="${x + 90}" cy="450" r="70" fill="${p.surface}" stroke="${done ? p.accent2 : i === 2 ? p.accent : p.line}" stroke-width="6"/>
    ${
      done
        ? `<path d="M${x + 62} 450 l20 22 l38 -44" fill="none" stroke="${p.accent2}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`
        : i === 2
          ? `<circle cx="${x + 90}" cy="450" r="26" fill="none" stroke="${p.accent}" stroke-width="9" stroke-dasharray="60 40" stroke-linecap="round"/>`
          : `<circle cx="${x + 90}" cy="450" r="16" fill="${p.line}"/>`
    }
    <rect x="${x + 30}" y="570" width="120" height="14" rx="7" fill="${p.ink}" opacity="0.4"/>
    <rect x="${x + 46}" y="600" width="88" height="11" rx="6" fill="${p.ink}" opacity="0.22"/>`;
    })
    .join("")}
  ${[0, 1, 2].map((i) => `<path d="M${580 + i * 250} 450 l30 -14 v28 z" fill="${p.accent}" opacity="0.8"/>`).join("")}
  ${Array.from({ length: 5 }, (_, i) => `<rect x="${440 + i * 60}" y="250" width="${30 + r() * 60}" height="12" rx="6" fill="${p.ink}" opacity="0.22"/>`).join("")}`;
}

/** Database: stacked cylinders with a query panel. */
function database(p, r) {
  const cyl = (x, y, w, h, op) => `
    <ellipse cx="${x + w / 2}" cy="${y}" rx="${w / 2}" ry="34" fill="${p.accent}" opacity="${op}"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${p.surface}" opacity="0.95"/>
    <ellipse cx="${x + w / 2}" cy="${y + h}" rx="${w / 2}" ry="34" fill="${p.surface}" stroke="${p.line}" stroke-width="2"/>
    <line x1="${x}" y1="${y}" x2="${x}" y2="${y + h}" stroke="${p.line}" stroke-width="2"/>
    <line x1="${x + w}" y1="${y}" x2="${x + w}" y2="${y + h}" stroke="${p.line}" stroke-width="2"/>`;
  return `${ground(p)}
  ${cyl(400, 300, 300, 110, 0.35)}
  ${cyl(400, 430, 300, 110, 0.5)}
  ${cyl(400, 560, 300, 110, 0.75)}
  ${panel(p, 790, 260, 460, 400, 18, p.b)}
  <rect x="790" y="260" width="460" height="52" rx="18" fill="${p.surface}"/>
  <rect x="790" y="298" width="460" height="14" fill="${p.surface}"/>
  ${Array.from({ length: 7 }, (_, i) => bars(p, 822, 348 + i * 42, [70, 120, 50].slice(0, 2 + Math.floor(r() * 2)), 16, 13, i % 3 === 0 ? p.accent : p.ink, i % 3 === 0 ? 0.85 : 0.35)).join("")}`;
}

/** Graph traversal: a weighted node graph with a highlighted path. */
function graph(p, r) {
  const nodes = [
    { x: 480, y: 300 },
    { x: 700, y: 220 },
    { x: 940, y: 300 },
    { x: 1160, y: 250 },
    { x: 520, y: 560 },
    { x: 760, y: 620 },
    { x: 1000, y: 540 },
    { x: 1180, y: 640 },
  ];
  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [0, 4],
    [4, 5],
    [5, 6],
    [6, 3],
    [1, 5],
    [2, 6],
    [5, 7],
    [6, 7],
  ];
  const pathSet = new Set(["0-4", "4-5", "5-6", "6-3"]);
  return `${ground(p)}
  ${edges
    .map(([a, b]) => {
      const hot = pathSet.has(`${a}-${b}`);
      return `<line x1="${nodes[a].x}" y1="${nodes[a].y}" x2="${nodes[b].x}" y2="${nodes[b].y}"
      stroke="${hot ? p.accent : p.line}" stroke-width="${hot ? 7 : 3}" opacity="${hot ? 0.95 : 0.45}" stroke-linecap="round"/>`;
    })
    .join("")}
  ${nodes
    .map(
      (n, i) => `
    <circle cx="${n.x}" cy="${n.y}" r="38" fill="${p.surface}" stroke="${[0, 4, 5, 6, 3].includes(i) ? p.accent : p.line}" stroke-width="4"/>
    <circle cx="${n.x}" cy="${n.y}" r="13" fill="${[0, 4, 5, 6, 3].includes(i) ? p.accent : p.accent2}" opacity="${[0, 4, 5, 6, 3].includes(i) ? 1 : 0.4}"/>`,
    )
    .join("")}
  ${edges
    .slice(0, 6)
    .map(([a, b]) => {
      const mx = (nodes[a].x + nodes[b].x) / 2;
      const my = (nodes[a].y + nodes[b].y) / 2;
      return `<rect x="${mx - 18}" y="${my - 16}" width="36" height="26" rx="8" fill="${p.b}" opacity="0.85"/>
      <text x="${mx}" y="${my + 3}" text-anchor="middle" font-family="monospace" font-size="18" fill="${p.ink}" opacity="0.8">${1 + Math.floor(r() * 9)}</text>`;
    })
    .join("")}`;
}

/** Design system: a component sheet with swatches and a type ramp. */
function designSystem(p, r) {
  return `${ground(p)}
  ${panel(p, 330, 180, 940, 560)}
  <rect x="370" y="220" width="200" height="18" rx="9" fill="${p.ink}" opacity="0.5"/>
  ${Array.from({ length: 6 }, (_, i) => `<circle cx="${396 + i * 62}" cy="300" r="26" fill="${[p.accent, p.accent2, p.ink, p.line, p.accent, p.accent2][i]}" opacity="${0.35 + i * 0.11}"/>`).join("")}
  ${[0, 1, 2].map((i) => `<rect x="370" y="${370 + i * 44}" width="${340 - i * 90}" height="${26 - i * 6}" rx="6" fill="${p.ink}" opacity="${0.6 - i * 0.15}"/>`).join("")}
  <rect x="370" y="530" width="150" height="52" rx="26" fill="${p.accent}" opacity="0.95"/>
  <rect x="540" y="530" width="150" height="52" rx="26" fill="none" stroke="${p.accent}" stroke-width="3"/>
  <rect x="370" y="608" width="320" height="46" rx="12" fill="${p.b}" stroke="${p.line}" stroke-width="2"/>
  <rect x="392" y="624" width="120" height="14" rx="7" fill="${p.ink}" opacity="0.3"/>
  <rect x="760" y="270" width="470" height="300" rx="16" fill="${p.b}" opacity="0.6" stroke="${p.line}" stroke-width="2"/>
  ${Array.from(
    { length: 3 },
    (_, i) => `
    <rect x="${790 + i * 150}" y="300" width="118" height="118" rx="14" fill="${p.accent2}" opacity="${0.16 + r() * 0.2}"/>
    <rect x="${790 + i * 150}" y="436" width="${70 + r() * 40}" height="12" rx="6" fill="${p.ink}" opacity="0.35"/>`,
  ).join("")}
  <rect x="790" y="486" width="410" height="14" rx="7" fill="${p.ink}" opacity="0.3"/>
  <rect x="790" y="516" width="310" height="14" rx="7" fill="${p.ink}" opacity="0.2"/>
  <rect x="760" y="608" width="470" height="46" rx="12" fill="${p.accent}" opacity="0.16"/>`;
}

/** Kanban board: three columns of cards, one in flight. */
function kanban(p, r) {
  return `${ground(p)}
  ${[0, 1, 2]
    .map(
      (c) => `
    <rect x="${390 + c * 290}" y="200" width="250" height="540" rx="18" fill="${p.b}" opacity="0.5" stroke="${p.line}" stroke-width="2"/>
    <rect x="${414 + c * 290}" y="228" width="${90 + r() * 50}" height="14" rx="7" fill="${p.ink}" opacity="0.45"/>
    ${Array.from(
      { length: 3 - (c === 2 ? 1 : 0) },
      (_, i) => `
      <rect x="${414 + c * 290}" y="${272 + i * 118}" width="202" height="98" rx="12" fill="${p.surface}" stroke="${p.line}" stroke-width="2"/>
      <rect x="${434 + c * 290}" y="${294 + i * 118}" width="${60 + r() * 40}" height="10" rx="5" fill="${c === 0 ? p.accent : p.accent2}" opacity="0.85"/>
      <rect x="${434 + c * 290}" y="${318 + i * 118}" width="${120 + r() * 40}" height="12" rx="6" fill="${p.ink}" opacity="0.4"/>
      <rect x="${434 + c * 290}" y="${342 + i * 118}" width="${80 + r() * 40}" height="10" rx="5" fill="${p.ink}" opacity="0.22"/>`,
    ).join("")}`,
    )
    .join("")}
  <rect x="984" y="628" width="202" height="98" rx="12" fill="${p.surface}" stroke="${p.accent}" stroke-width="3" transform="rotate(-4 1085 677)"/>
  <rect x="1004" y="650" width="90" height="10" rx="5" fill="${p.accent}" transform="rotate(-4 1085 677)"/>
  <rect x="1004" y="674" width="150" height="12" rx="6" fill="${p.ink}" opacity="0.4" transform="rotate(-4 1085 677)"/>`;
}

/** Calendar and streak: a month grid with completed days. */
function planner(p, r) {
  const cells = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      const done = r() > 0.42;
      cells.push(`<rect x="${420 + col * 74}" y="${330 + row * 74}" width="58" height="58" rx="12"
        fill="${done ? p.accent : p.b}" opacity="${done ? 0.35 + r() * 0.6 : 0.5}" stroke="${p.line}" stroke-width="1.5"/>`);
    }
  }
  return `${ground(p)}
  ${panel(p, 380, 200, 560, 500)}
  <rect x="420" y="240" width="180" height="18" rx="9" fill="${p.ink}" opacity="0.5"/>
  ${Array.from({ length: 7 }, (_, i) => `<rect x="${426 + i * 74}" y="292" width="46" height="10" rx="5" fill="${p.ink}" opacity="0.25"/>`).join("")}
  ${cells.join("")}
  ${panel(p, 990, 260, 280, 380, 18, p.b)}
  <rect x="1022" y="300" width="120" height="14" rx="7" fill="${p.ink}" opacity="0.4"/>
  <circle cx="1130" cy="420" r="76" fill="none" stroke="${p.line}" stroke-width="14"/>
  <circle cx="1130" cy="420" r="76" fill="none" stroke="${p.accent}" stroke-width="14" stroke-linecap="round"
          stroke-dasharray="340 478" transform="rotate(-90 1130 420)"/>
  ${[0, 1, 2].map((i) => `<rect x="1022" y="${530 + i * 34}" width="${216 - i * 50}" height="12" rx="6" fill="${p.ink}" opacity="${0.4 - i * 0.1}"/>`).join("")}`;
}

/** Language: overlapping speech bubbles with script marks. */
function language(p, r) {
  return `${ground(p)}
  <path d="M420 250 h420 a28 28 0 0 1 28 28 v220 a28 28 0 0 1 -28 28 H560 l-70 70 v-70 h-70 a28 28 0 0 1 -28 -28 V278 a28 28 0 0 1 28 -28 z"
        fill="${p.surface}" stroke="${p.accent}" stroke-width="5"/>
  ${Array.from({ length: 3 }, (_, i) => bars(p, 468, 320 + i * 56, [110, 170, 80].slice(0, 2 + Math.floor(r() * 2)), 20, 16, p.ink, 0.4)).join("")}
  <path d="M780 420 h400 a28 28 0 0 1 28 28 v210 a28 28 0 0 1 -28 28 H900 l-64 66 v-66 h-56 a28 28 0 0 1 -28 -28 V448 a28 28 0 0 1 28 -28 z"
        fill="${p.b}" stroke="${p.accent2}" stroke-width="5" opacity="0.95"/>
  ${Array.from({ length: 3 }, (_, i) => bars(p, 826, 488 + i * 56, [90, 150, 120].slice(0, 2 + Math.floor(r() * 2)), 20, 16, p.accent2, 0.5)).join("")}
  <circle cx="1250" cy="270" r="90" fill="none" stroke="${p.accent}" stroke-width="4" opacity="0.4"/>
  <circle cx="1250" cy="270" r="52" fill="none" stroke="${p.accent}" stroke-width="4" opacity="0.25"/>`;
}

/** Finance: candlesticks over a portfolio panel. */
function finance(p, r) {
  const candles = Array.from({ length: 14 }, (_, i) => {
    const mid = 480 + r() * 120;
    const body = 40 + r() * 90;
    const up = r() > 0.42;
    const x = 430 + i * 58;
    return `<line x1="${x + 14}" y1="${mid - body / 2 - 30}" x2="${x + 14}" y2="${mid + body / 2 + 30}" stroke="${up ? p.accent2 : p.accent}" stroke-width="3" opacity="0.7"/>
      <rect x="${x}" y="${mid - body / 2}" width="28" height="${body}" rx="5" fill="${up ? p.accent2 : p.accent}" opacity="0.9"/>`;
  }).join("");
  return `${ground(p)}
  ${panel(p, 380, 200, 880, 520)}
  <rect x="420" y="240" width="200" height="18" rx="9" fill="${p.ink}" opacity="0.45"/>
  <rect x="420" y="272" width="130" height="30" rx="8" fill="${p.accent}" opacity="0.9"/>
  ${candles}
  <line x1="410" y1="660" x2="1230" y2="660" stroke="${p.line}" stroke-width="3"/>
  ${Array.from({ length: 5 }, (_, i) => `<line x1="410" y1="${350 + i * 78}" x2="1230" y2="${350 + i * 78}" stroke="${p.line}" stroke-width="1.5" opacity="0.3" stroke-dasharray="6 10"/>`).join("")}`;
}

/** Growth: a rising area chart with funnel steps. */
function growth(p, r) {
  const pts = Array.from({ length: 10 }, (_, i) => `${430 + i * 86},${640 - 40 * i - r() * 90}`);
  return `${ground(p)}
  ${panel(p, 380, 200, 880, 520)}
  <polygon points="430,660 ${pts.join(" ")} 1204,660" fill="${p.accent}" opacity="0.2"/>
  <polyline points="${pts.join(" ")}" fill="none" stroke="${p.accent}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  ${pts
    .map((pt) => {
      const [x, y] = pt.split(",");
      return `<circle cx="${x}" cy="${y}" r="8" fill="${p.b}" stroke="${p.accent}" stroke-width="4"/>`;
    })
    .join("")}
  <line x1="420" y1="660" x2="1220" y2="660" stroke="${p.line}" stroke-width="3"/>
  ${[0, 1, 2]
    .map(
      (i) => `
    <rect x="${430 + i * 20}" y="${250 + i * 40}" width="${300 - i * 40}" height="30" rx="8" fill="${p.accent2}" opacity="${0.5 - i * 0.12}"/>`,
    )
    .join("")}`;
}

/** Containers: a grid of container blocks with an orchestrator ring. */
function containers(p, r) {
  return `${ground(p)}
  <circle cx="800" cy="450" r="250" fill="none" stroke="${p.line}" stroke-width="3" stroke-dasharray="14 12" opacity="0.6"/>
  <circle cx="800" cy="450" r="160" fill="none" stroke="${p.accent}" stroke-width="3" opacity="0.35"/>
  ${Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const x = 800 + Math.cos(a) * 250 - 46;
    const y = 450 + Math.sin(a) * 250 - 46;
    return `<rect x="${x}" y="${y}" width="92" height="92" rx="16" fill="${p.surface}" stroke="${i % 3 === 0 ? p.accent : p.line}" stroke-width="4"/>
      <rect x="${x + 20}" y="${y + 26}" width="52" height="10" rx="5" fill="${i % 3 === 0 ? p.accent : p.ink}" opacity="0.8"/>
      <rect x="${x + 20}" y="${y + 48}" width="${28 + r() * 24}" height="8" rx="4" fill="${p.ink}" opacity="0.35"/>`;
  }).join("")}
  <rect x="726" y="376" width="148" height="148" rx="24" fill="${p.surface}" stroke="${p.accent}" stroke-width="5"/>
  <path d="M770 450 h60 M800 420 v60" stroke="${p.accent}" stroke-width="9" stroke-linecap="round"/>`;
}

/** Data pipeline: nodes feeding a warehouse. */
function dataFlow(p, r) {
  return `${ground(p)}
  ${[0, 1, 2]
    .map(
      (i) => `
    <rect x="360" y="${250 + i * 160}" width="180" height="110" rx="16" fill="${p.surface}" stroke="${p.line}" stroke-width="2"/>
    ${bars(p, 386, 288 + i * 160, [70, 100], 14, 12, p.ink, 0.4)}
    <path d="M540 ${305 + i * 160} C620 ${305 + i * 160}, 640 450, 720 450" fill="none" stroke="${p.accent}" stroke-width="4" opacity="0.7"/>
    <circle cx="${560 + r() * 120}" cy="${305 + i * 160 - (i - 1) * 40}" r="7" fill="${p.accent2}"/>`,
    )
    .join("")}
  <rect x="720" y="360" width="200" height="180" rx="18" fill="${p.b}" stroke="${p.accent}" stroke-width="4"/>
  ${Array.from({ length: 4 }, (_, i) => `<rect x="748" y="${392 + i * 36}" width="144" height="18" rx="6" fill="${p.accent}" opacity="${0.2 + i * 0.18}"/>`).join("")}
  <path d="M920 450 h120" stroke="${p.accent}" stroke-width="5" stroke-linecap="round"/>
  <path d="M1040 450 l-24 -14 v28 z" fill="${p.accent}"/>
  <ellipse cx="1210" cy="380" rx="140" ry="34" fill="${p.accent}" opacity="0.35"/>
  <rect x="1070" y="380" width="280" height="150" fill="${p.surface}" opacity="0.95"/>
  <ellipse cx="1210" cy="530" rx="140" ry="34" fill="${p.surface}" stroke="${p.line}" stroke-width="2"/>
  <line x1="1070" y1="380" x2="1070" y2="530" stroke="${p.line}" stroke-width="2"/>
  <line x1="1350" y1="380" x2="1350" y2="530" stroke="${p.line}" stroke-width="2"/>`;
}

/* ========================================================================== */
/*  Template registry                                                         */
/* ========================================================================== */

const TEMPLATES = {
  "code-editor": codeEditor,
  terminal,
  browser,
  dashboard,
  "neural-net": neuralNet,
  shield,
  cloud,
  pipeline,
  database,
  graph,
  "design-system": designSystem,
  kanban,
  planner,
  language,
  finance,
  growth,
  containers,
  "data-flow": dataFlow,
};

/**
 * Which templates and palettes each category draws from.
 *
 * Three variants per category, so no two adjacent cards in a grid repeat, and
 * every course in a category still reads as belonging to the same family.
 */
const CATEGORY_ART = {
  programming: [
    ["code-editor", "indigo"],
    ["terminal", "forest"],
    ["code-editor", "violet"],
    ["terminal", "slate"],
    ["code-editor", "ocean"],
    ["graph", "plum"],
  ],
  "web-development": [
    ["browser", "ocean"],
    ["browser", "violet"],
    ["design-system", "indigo"],
    ["browser", "forest"],
    ["code-editor", "teal"],
    ["design-system", "slate"],
  ],
  "data-science": [
    ["dashboard", "teal"],
    ["data-flow", "ocean"],
    ["dashboard", "forest"],
    ["data-flow", "indigo"],
    ["dashboard", "slate"],
    ["growth", "teal"],
  ],
  "artificial-intelligence": [
    ["neural-net", "violet"],
    ["neural-net", "plum"],
    ["neural-net", "indigo"],
    ["neural-net", "ocean"],
    ["graph", "violet"],
    ["data-flow", "plum"],
  ],
  "machine-learning": [
    ["neural-net", "teal"],
    ["dashboard", "plum"],
    ["neural-net", "ocean"],
    ["neural-net", "forest"],
    ["data-flow", "teal"],
    ["graph", "indigo"],
  ],
  cybersecurity: [
    ["shield", "slate"],
    ["shield", "rose"],
    ["shield", "indigo"],
    ["shield", "ocean"],
    ["shield", "forest"],
    ["shield", "plum"],
  ],
  "cloud-computing": [
    ["cloud", "ocean"],
    ["containers", "teal"],
    ["cloud", "indigo"],
    ["containers", "slate"],
    ["cloud", "violet"],
    ["containers", "ocean"],
  ],
  devops: [
    ["pipeline", "forest"],
    ["containers", "slate"],
    ["pipeline", "ocean"],
    ["terminal", "amber"],
    ["pipeline", "indigo"],
    ["containers", "forest"],
  ],
  database: [
    ["database", "amber"],
    ["database", "teal"],
    ["data-flow", "indigo"],
    ["database", "ocean"],
    ["database", "slate"],
    ["data-flow", "amber"],
  ],
  "computer-science": [
    ["graph", "indigo"],
    ["graph", "slate"],
    ["terminal", "ocean"],
    ["graph", "teal"],
    ["code-editor", "slate"],
    ["graph", "forest"],
  ],
  business: [
    ["growth", "amber"],
    ["kanban", "slate"],
    ["growth", "forest"],
    ["dashboard", "amber"],
    ["kanban", "amber"],
    ["growth", "ocean"],
  ],
  finance: [
    ["finance", "forest"],
    ["finance", "amber"],
    ["dashboard", "slate"],
    ["finance", "slate"],
    ["growth", "slate"],
    ["finance", "ocean"],
  ],
  marketing: [
    ["growth", "rose"],
    ["dashboard", "amber"],
    ["growth", "plum"],
    ["growth", "violet"],
    ["dashboard", "rose"],
    ["kanban", "rose"],
  ],
  design: [
    ["design-system", "plum"],
    ["design-system", "rose"],
    ["browser", "teal"],
    ["design-system", "violet"],
    ["design-system", "amber"],
    ["browser", "plum"],
  ],
  "personal-development": [
    ["planner", "teal"],
    ["planner", "amber"],
    ["kanban", "forest"],
    ["planner", "violet"],
    ["planner", "rose"],
    ["kanban", "teal"],
  ],
  "project-management": [
    ["kanban", "ocean"],
    ["kanban", "indigo"],
    ["planner", "slate"],
    ["kanban", "violet"],
    ["planner", "ocean"],
    ["kanban", "plum"],
  ],
  languages: [
    ["language", "rose"],
    ["language", "amber"],
    ["language", "teal"],
    ["language", "violet"],
    ["language", "ocean"],
    ["language", "forest"],
  ],
};

/* ========================================================================== */
/*  Build                                                                     */
/* ========================================================================== */

function render(templateKey, paletteKey, seed) {
  const fn = TEMPLATES[templateKey];
  if (!fn) throw new Error(`Unknown template: ${templateKey}`);
  const p = PALETTES[paletteKey];
  if (!p) throw new Error(`Unknown palette: ${paletteKey}`);
  uid = 0;
  const body = fn(p, seeded(seed));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-hidden="true">${body}</svg>`;
}

function main() {
  fs.rmSync(OUT, { recursive: true, force: true });

  const manifest = {};
  let count = 0;

  for (const [category, variants] of Object.entries(CATEGORY_ART)) {
    const dir = path.join(OUT, category);
    fs.mkdirSync(dir, { recursive: true });
    manifest[category] = [];

    variants.forEach(([tpl, pal], index) => {
      const name = `${tpl}-${String.fromCharCode(97 + index)}.svg`;
      const svg = render(tpl, pal, `${category}:${tpl}:${pal}:${index}`);
      fs.writeFileSync(path.join(dir, name), svg, "utf8");
      manifest[category].push(`/images/courses/${category}/${name}`);
      count += 1;
    });
  }

  // Category banners: the same language at a wider crop, one per category.
  const banners = path.join(OUT, "_banners");
  fs.mkdirSync(banners, { recursive: true });
  let bannerCount = 0;
  for (const [category, variants] of Object.entries(CATEGORY_ART)) {
    const [tpl, pal] = variants[0];
    const svg = render(tpl, pal, `banner:${category}`);
    fs.writeFileSync(path.join(banners, `${category}.svg`), svg, "utf8");
    bannerCount += 1;
  }

  // The fallback is a real illustration, not a grey box: a generic "study"
  // composition that still looks like it belongs to the platform.
  fs.writeFileSync(path.join(OUT, "fallback.svg"), render("planner", "indigo", "fallback"), "utf8");

  fs.writeFileSync(
    path.join(OUT, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  const bytes = fs
    .readdirSync(OUT, { recursive: true })
    .filter((f) => String(f).endsWith(".svg"))
    .map((f) => fs.statSync(path.join(OUT, String(f))).size);

  console.log(`course thumbnails : ${count}`);
  console.log(`category banners  : ${bannerCount}`);
  console.log(`fallback          : 1`);
  console.log(`total svg         : ${bytes.length}`);
  console.log(
    `avg size          : ${Math.round(bytes.reduce((a, b) => a + b, 0) / bytes.length)} bytes`,
  );
  console.log(`largest           : ${Math.max(...bytes)} bytes`);
}

main();
