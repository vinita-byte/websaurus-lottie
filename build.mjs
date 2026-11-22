// WebSaurus Lottie generator.
// Converts the V2 character art (W2 brand) into hand-rigged Lottie JSON files.
// Run: node build.mjs  → writes lottie/*.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'lottie');
const FR = 60;

// ---------- palette (V2 / W2 brand) ----------
const C = {
  red: '#D40016', ox: '#6E0A12', ink: '#171615', graph: '#2B2826',
  pocket: '#45403C', paper: '#F4F4F2', yellow: '#FFD23F',
};
const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1].map((v) => +v.toFixed(4));
};

// ---------- keyframes ----------
const EASE = {
  io: { o: [0.42, 0], i: [0.58, 1] },
  out: { o: [0.16, 1], i: [0.3, 1] },
  in: { o: [0.7, 0], i: [0.84, 0] },
  back: { o: [0.34, 1.56], i: [0.64, 1] },
  lin: { o: [0, 0], i: [1, 1] },
};
const isKeys = (v) => Array.isArray(v) && Array.isArray(v[0]);
function kf(keys) {
  return {
    a: 1,
    k: keys.map(([t, v, e = 'io'], idx) => {
      const s = Array.isArray(v) ? v : [v];
      const o = { t, s };
      if (idx < keys.length - 1) {
        if (e === 'hold') o.h = 1;
        else {
          const E = EASE[e], n = s.length;
          o.o = { x: Array(n).fill(E.o[0]), y: Array(n).fill(E.o[1]) };
          o.i = { x: Array(n).fill(E.i[0]), y: Array(n).fill(E.i[1]) };
        }
      }
      return o;
    }),
  };
}
const prop = (v) => (v && v.a === 1 ? v : { a: 0, k: v });

// ---------- SVG path → Lottie bezier ----------
function parsePath(d) {
  const toks = d.match(/[MLCZ]|-?\d*\.?\d+/g);
  let i = 0, cmd, cur = null;
  const subs = [];
  const num = () => parseFloat(toks[i++]);
  const push = (p) => { cur.v.push(p); cur.i.push([0, 0]); cur.o.push([0, 0]); };
  while (i < toks.length) {
    if (/[A-Z]/.test(toks[i])) cmd = toks[i++];
    if (cmd === 'M') { cur = { i: [], o: [], v: [], c: false }; subs.push(cur); push([num(), num()]); cmd = 'L'; }
    else if (cmd === 'L') push([num(), num()]);
    else if (cmd === 'C') {
      const c1 = [num(), num()], c2 = [num(), num()], p = [num(), num()];
      const k = cur.v.length - 1;
      cur.o[k] = [c1[0] - cur.v[k][0], c1[1] - cur.v[k][1]];
      push(p);
      cur.i[cur.v.length - 1] = [c2[0] - p[0], c2[1] - p[1]];
    } else if (cmd === 'Z') {
      cur.c = true;
      const f = cur.v[0], l = cur.v[cur.v.length - 1];
      if (cur.v.length > 1 && Math.abs(f[0] - l[0]) < 1e-6 && Math.abs(f[1] - l[1]) < 1e-6) {
        cur.i[0] = cur.i.pop(); cur.v.pop(); cur.o.pop();
      }
    }
  }
  return subs;
}

// ---------- shape primitives ----------
function style(items, s = {}) {
  const it = [...items];
  const stroke = s.stroke === undefined ? C.ink : s.stroke;
  if (stroke !== 'none') it.push({ ty: 'st', nm: 'Stroke', c: prop(hex(stroke)), o: prop(100), w: prop(s.sw ?? 7), lc: 2, lj: 2, ml: 4 });
  if (s.fill && s.fill !== 'none') it.push({ ty: 'fl', nm: 'Fill', c: prop(hex(s.fill)), o: prop(s.fo ?? 100), r: 1 });
  it.push(tr({}));
  return { ty: 'gr', nm: s.nm || 'part', it };
}
const P = (d, s = {}) => style(parsePath(d).map((k) => ({ ty: 'sh', ks: prop(k) })), s);
const Ci = (cx, cy, r, s = {}) => style([{ ty: 'el', p: prop([cx, cy]), s: prop([r * 2, r * 2]) }], s);
const El = (cx, cy, rx, ry, s = {}) => style([{ ty: 'el', p: prop([cx, cy]), s: prop([rx * 2, ry * 2]) }], s);
const Re = (x, y, w, h, r, s = {}) => style([{ ty: 'rc', p: prop([x + w / 2, y + h / 2]), s: prop([w, h]), r: prop(r) }], s);
// shape whose path morphs: keys [[t, d, ease], ...]
function Morph(keys, s = {}) {
  const k = keys.map(([t, d, e = 'io'], idx) => {
    const o = { t, s: [parsePath(d)[0]] };
    if (idx < keys.length - 1) { const E = EASE[e]; o.o = { x: E.o[0], y: E.o[1] }; o.i = { x: E.i[0], y: E.i[1] }; }
    return o;
  });
  return style([{ ty: 'sh', ks: { a: 1, k } }], s);
}

function tr({ a = [0, 0], p, s = [100, 100], r = 0, o = 100 }) {
  return { ty: 'tr', nm: 'Transform', a: prop(a), p: prop(p ?? a), s: prop(s), r: prop(r), o: prop(o), sk: prop(0), sa: prop(0) };
}
// spec: { p: [dx,dy] | [[t,[dx,dy],e]...], s, r, o }  (p is an offset from the anchor)
function T(a, spec = {}) {
  const t = { a };
  if (spec.p) t.p = isKeys(spec.p) ? kf(spec.p.map(([f, [dx, dy], e]) => [f, [a[0] + dx, a[1] + dy], e])) : [a[0] + spec.p[0], a[1] + spec.p[1]];
  if (spec.s) t.s = isKeys(spec.s) ? kf(spec.s) : spec.s;
  if (spec.r !== undefined) t.r = Array.isArray(spec.r) ? kf(spec.r) : spec.r;
  if (spec.o !== undefined) t.o = Array.isArray(spec.o) ? kf(spec.o) : spec.o;
  return tr(t);
}
// children are listed bottom → top (SVG order); Lottie wants top first.
const G = (nm, children, a = [0, 0], spec = {}) => ({ ty: 'gr', nm, it: [...children.slice().reverse(), T(a, spec)] });

// ---------- the character ----------
const SMUG_MOUTH = 'M370 146 C340 156 300 164 262 166 C254 166 248 162 246 156';
const MOODS = {
  smug: {
    mouth: () => [
      P(SMUG_MOUTH, { sw: 6 }),
      P('M346 152 L340 164 L334 154 Z', { fill: C.paper, sw: 3 }),
      P('M322 158 L316 170 L310 160 Z', { fill: C.paper, sw: 3 }),
      P('M298 162 L292 173 L286 163 Z', { fill: C.paper, sw: 3 }),
    ],
    eyeL: [[256, 120], () => [Ci(256, 120, 8, { fill: C.ink, stroke: 'none' }), Ci(259, 116, 2.5, { fill: C.paper, stroke: 'none' })]],
    eyeR: [[315, 114], () => [Ci(315, 114, 7, { fill: C.ink, stroke: 'none' }), Ci(318, 110, 2, { fill: C.paper, stroke: 'none' })]],
    browL: [[248, 76], () => [P('M226 76 C240 70 258 72 270 80')]],
    browR: [[310, 84], () => [P('M290 84 L330 84')]],
    mouthA: [370, 146],
  },
  shocked: {
    mouth: () => [
      El(326, 160, 20, 15, { fill: C.ink, sw: 6 }),
      P('M318 147 L322 156 L328 147 Z', { fill: C.paper, stroke: 'none' }),
    ],
    eyeL: [[248, 116], () => [Ci(248, 116, 5, { fill: C.ink, stroke: 'none' })]],
    eyeR: [[308, 110], () => [Ci(308, 110, 4.5, { fill: C.ink, stroke: 'none' })]],
    browL: [[248, 66], () => [P('M226 72 C238 62 256 62 268 70')]],
    browR: [[310, 62], () => [P('M290 66 C302 58 318 58 330 66')]],
    mouthA: [326, 152],
  },
  thinking: {
    mouth: () => [P('M370 150 C346 154 316 158 286 158 C278 158 272 162 268 158', { sw: 6 })],
    eyeL: [[242, 105], () => [Ci(242, 105, 7, { fill: C.ink, stroke: 'none' })]],
    eyeR: [[302, 99], () => [Ci(302, 99, 6, { fill: C.ink, stroke: 'none' })]],
    browL: [[247, 81], () => [P('M226 84 L268 78')]],
    browR: [[310, 77], () => [P('M290 80 C304 74 318 74 330 80')]],
    mouthA: [370, 150],
  },
  cackling: {
    mouth: () => [
      P('M370 140 C352 178 292 192 256 164 C298 162 338 154 370 140 Z', { fill: C.ink, sw: 6 }),
      P('M300 172 C312 166 330 166 338 174 C326 182 310 182 300 172 Z', { fill: C.ox, stroke: 'none' }),
      P('M348 150 L344 160 L338 152 Z', { fill: C.paper, stroke: 'none' }),
      P('M324 156 L320 166 L314 158 Z', { fill: C.paper, stroke: 'none' }),
    ],
    eyeL: [[248, 116], () => [P('M234 122 C240 108 256 108 262 122', { sw: 6 })]],
    eyeR: [[308, 110], () => [P('M296 116 C302 103 314 103 320 116', { sw: 6 })]],
    browL: [[248, 78], () => [P('M226 80 C240 74 258 74 270 82')]],
    browR: [[310, 75], () => [P('M290 78 C304 72 318 72 330 78')]],
    mouthA: [314, 160],
  },
};

// Talking mouth: an ink shape under the smug line that opens and closes (amount 0..1).
const lerp = (a, b, t) => +(a + (b - a) * t).toFixed(2);
const lerpPath = (a, b, t) => {
  const nb = b.match(/-?\d*\.?\d+/g).map(Number); let i = 0;
  return a.replace(/-?\d*\.?\d+/g, (n) => String(lerp(+n, nb[i++], t)));
};
const TALK_CLOSED = 'M370 146 C340 156 300 164 262 166 C300 164 340 156 370 146 Z';
const TALK_OPEN = 'M370 146 C340 156 300 164 262 166 C290 192 352 184 370 146 Z';
const TONGUE_CLOSED = 'M300 164 C310 163 324 161 332 160 C324 161 310 163 300 164 Z';
const TONGUE_OPEN = 'M298 174 C310 168 326 168 336 172 C326 181 308 181 298 174 Z';
const talkPath = (t) => lerpPath(TALK_CLOSED, TALK_OPEN, t);
const tonguePath = (t) => lerpPath(TONGUE_CLOSED, TONGUE_OPEN, t);

/**
 * Head, drawn in the source SVG coordinates.
 * cfg.moods: { smug: {o, mouth, eyes, eyeL, eyeR, browL, browR} } transform specs per mood
 * cfg.talk:  [[t, amount], ...] mouth open keys (smug only)
 * cfg.headStroke: outline colour of the head shape
 */
function head(cfg = {}) {
  const moods = cfg.moods || { smug: {} };
  const layer = (part) => Object.entries(moods).map(([m, fx]) => {
    const M = MOODS[m];
    let g;
    if (part === 'mouth') {
      const kids = M.mouth();
      if (m === 'smug' && cfg.talk) kids.unshift(
        Morph(cfg.talk.map(([t, a, e]) => [t, talkPath(a), e]), { fill: C.ink, stroke: 'none', nm: 'talk mouth' }),
        Morph(cfg.talk.map(([t, a, e]) => [t, tonguePath(a), e]), { fill: C.ox, stroke: 'none', nm: 'tongue' }),
      );
      g = G(`${m} mouth`, kids, M.mouthA, fx.mouth);
    } else if (part === 'eyes') {
      const [la, lk] = M.eyeL, [ra, rk] = M.eyeR;
      g = G(`${m} eyes`, [G('eye L', lk(), la, fx.eyeL), G('eye R', rk(), ra, fx.eyeR)], [280, 112], fx.eyes);
    } else {
      const [la, lk] = M.browL, [ra, rk] = M.browR;
      g = G(`${m} brows`, [G('brow L', lk(), la, fx.browL), G('brow R', rk(), ra, fx.browR)], [280, 74], fx.brows);
    }
    return G(m, [g], [0, 0], { o: fx.o ?? 100 });
  });
  return [
    G('skin', [
      P('M166 170 C146 120 166 70 232 64 L318 68 C354 70 374 92 374 126 C374 152 360 168 336 172 L232 198 C200 204 176 194 166 170 Z',
        { fill: C.red, stroke: cfg.headStroke ?? C.ink, sw: cfg.headSw ?? 7 }),
      Ci(196, 98, 9, { fill: C.ox, stroke: 'none' }),
      Ci(216, 80, 5, { fill: C.ox, stroke: 'none' }),
      Ci(186, 126, 5, { fill: C.ox, stroke: 'none' }),
      El(358, 94, 4, 3, { fill: C.ink, stroke: 'none' }),
    ]),
    ...layer('mouth'),
    G('glasses', [
      P('M222 116 L188 122', { sw: 6 }),
      Ci(248, 116, 27, { fill: C.paper, sw: 8 }),
      Ci(308, 110, 25, { fill: C.paper, sw: 8 }),
      P('M275 112 L283 110', { sw: 7 }),
    ]),
    ...layer('eyes'),
    ...layer('brows'),
  ];
}

// Full body rig. fx = transform specs per part.
function body(fx = {}, headCfg = {}) {
  return G('root', [
    G('shadow', [El(205, 420, 160, 12, { fill: C.ink, fo: 12, stroke: 'none' })], [205, 420], fx.shadow),
    G('character', [
      G('tail', [
        P('M150 300 C105 318 62 356 20 400 C72 396 124 380 158 356 Z', { fill: C.red }),
        Ci(70, 380, 6, { fill: C.ox, stroke: 'none' }),
        Ci(98, 364, 4, { fill: C.ox, stroke: 'none' }),
      ], [156, 330], fx.tail),
      G('leg back', [
        P('M142 330 C128 372 136 404 160 412 L200 412 C204 396 194 360 184 340 Z', { fill: C.red }),
        P('M200 412 L213 412 L203 401 Z', { fill: C.paper, sw: 3 }),
      ], [170, 340], fx.legBack),
      G('leg front', [
        P('M214 340 C212 378 220 406 242 414 L288 414 C294 400 280 362 266 340 Z', { fill: C.red }),
        P('M288 414 L302 414 L290 402 Z', { fill: C.paper, sw: 3 }),
      ], [240, 340], fx.legFront),
      G('torso', [
        P('M152 196 C118 232 110 300 128 346 C148 386 252 392 276 350 C294 312 288 240 264 202 Z', { fill: C.graph }),
        P('M172 320 C192 314 228 314 248 320 L244 346 C224 352 194 352 176 346 Z', { stroke: C.pocket, sw: 4 }),
        // "W2" chest mark, drawn as strokes so no font is needed
        P('M189 283 L195 299 L201 287 L207 299 L213 283', { stroke: C.paper, sw: 6 }),
        P('M218 287 C218 280 231 279 231 287 C231 292 223 295 218 299 L232 299', { stroke: C.paper, sw: 6 }),
        G('strings', [
          P('M198 214 L194 262', { stroke: C.paper, sw: 4 }),
          P('M232 212 L236 258', { stroke: C.paper, sw: 4 }),
          Ci(194, 266, 5, { fill: C.paper, stroke: 'none' }),
          Ci(236, 262, 5, { fill: C.paper, stroke: 'none' }),
        ], [215, 212], fx.strings),
        P('M140 170 C130 210 170 232 215 230 C255 228 282 210 280 182 Z', { fill: C.graph }),
        G('head', head(headCfg), [232, 194], fx.head),
        G('arm highlighter', [
          P('M246 238 C266 232 284 238 290 252 C286 264 266 266 248 260 Z', { fill: C.graph }),
          G('highlighter', [
            Re(293, 198, 15, 44, 4, { fill: C.yellow, sw: 5 }),
            Re(293, 188, 15, 14, 4, { fill: C.ink, sw: 5 }),
          ], [300, 236], { r: 28, ...fx.highlighter }),
          Ci(296, 252, 10, { fill: C.red }),
          P('M304 246 L313 244 L306 252 Z', { fill: C.paper, sw: 3 }),
          P('M305 256 L314 258 L304 261 Z', { fill: C.paper, sw: 3 }),
        ], [250, 250], fx.arm1),
        G('arm free', [
          P('M240 266 C258 262 276 268 280 280 C276 290 258 290 242 286 Z', { fill: C.graph }),
          Ci(286, 280, 9, { fill: C.red }),
        ], [244, 276], fx.arm2),
      ], [205, 386], fx.torso),
    ], [205, 414], fx.character),
  ]);
}

// ---------- composition ----------
function shapeLayer(nm, shapes, { a = [0, 0], p = [0, 0], s = [100, 100] }, op) {
  return {
    ddd: 0, ty: 4, nm, sr: 1, ao: 0, bm: 0, ip: 0, op, st: 0,
    ks: { o: prop(100), r: prop(0), p: prop([...p, 0]), a: prop([...a, 0]), s: prop([...s, 100]) },
    shapes: shapes.slice().reverse(),
  };
}
function comp(nm, op, layersBottomUp, w = 512, h = 512) {
  const layers = layersBottomUp.slice().reverse().map((l, i) => ({ ...l, ind: i + 1 }));
  return { v: '5.12.2', fr: FR, ip: 0, op, w, h, nm, ddd: 0, assets: [], layers, markers: [] };
}
const BODY_VIEW = { a: [200, 250], p: [256, 270], s: [108, 108] };
const HEAD_VIEW = { a: [260, 132], p: [256, 262], s: [190, 190] };

const blink = (...starts) => {
  const k = [[0, [100, 100]]];
  for (const t of starts) k.push([t, [100, 100]], [t + 5, [100, 8]], [t + 11, [100, 100]]);
  return k;
};
const out = {};

// 1. Idle: breathing, tail sway, glance, blink, smug brow, highlighter twirl
{
  const op = 240;
  const b = blink(140, 214);
  out['websaurus-idle'] = comp('WebSaurus idle', op, [shapeLayer('WebSaurus', [body({
    shadow: { s: [[0, [100, 100]], [120, [96, 100]], [240, [100, 100]]] },
    tail: { r: [[0, -2], [120, 5], [240, -2]] },
    torso: { s: [[0, [100, 100]], [120, [99, 101.6]], [240, [100, 100]]] },
    strings: { r: [[0, 0], [120, 2], [240, 0]] },
    head: { r: [[0, 0], [120, -2.5], [240, 0]], p: [[0, [0, 0]], [120, [0, -2]], [240, [0, 0]]] },
    arm1: { r: [[0, 0], [60, -7], [120, 0], [180, -7], [240, 0]] },
    highlighter: { r: [[0, 28], [96, 28], [108, 14], [120, 38], [134, 28]] },
    arm2: { r: [[0, 0], [120, 6], [240, 0]] },
  }, {
    moods: {
      smug: {
        eyes: { p: [[0, [0, 0]], [30, [0, 0]], [40, [-5, 1]], [75, [-5, 1]], [85, [0, 0]]] },
        eyeL: { s: b }, eyeR: { s: b },
        browL: { p: [[0, [0, 0]], [160, [0, 0]], [168, [0, -7], 'back'], [190, [0, -7]], [200, [0, 0]]] },
      },
    },
  })], BODY_VIEW, op)]);
}

// 2. Hype: anticipation, jump, cackle in the air, squash landing, smug brow
{
  const op = 120;
  out['websaurus-hype'] = comp('WebSaurus hype jump', op, [shapeLayer('WebSaurus', [body({
    shadow: {
      s: [[0, [100, 100]], [12, [106, 100]], [36, [55, 55], 'in'], [58, [110, 100]], [82, [100, 100]], [120, [100, 100]]],
      o: [[0, 100], [12, 100], [36, 45, 'in'], [58, 100], [120, 100]],
    },
    character: {
      p: [[0, [0, 0]], [12, [0, 0], 'out'], [36, [0, -46], 'in'], [58, [0, 0]], [120, [0, 0]]],
      s: [[0, [100, 100]], [12, [110, 90]], [20, [94, 108]], [36, [100, 100]], [54, [98, 103]], [58, [112, 88]], [70, [97, 103]], [82, [100, 100]], [120, [100, 100]]],
      r: [[0, 0], [12, 0], [36, -4], [58, 0], [120, 0]],
    },
    tail: { r: [[0, 0], [12, 6], [30, -14], [46, 8], [60, -6], [76, 3], [90, 0], [120, 0]] },
    head: { r: [[0, 0], [12, 4], [30, -6], [58, 3], [70, -2], [84, 0], [120, 0]] },
    arm1: { r: [[0, 0], [12, 10], [24, -35], [32, -10], [40, -35], [48, -10], [58, 15], [72, -5], [86, 0], [120, 0]] },
    arm2: { r: [[0, 0], [12, 8], [24, -30], [34, -5], [42, -30], [52, -5], [60, 12], [74, -4], [86, 0], [120, 0]] },
    strings: { r: [[0, 0], [14, -8], [36, 10], [58, -6], [76, 0], [120, 0]] },
  }, {
    moods: {
      smug: {
        o: [[0, 100, 'hold'], [14, 0, 'hold'], [84, 100, 'hold'], [120, 100]],
        browL: { p: [[0, [0, 0]], [90, [0, 0]], [98, [0, -7], 'back'], [110, [0, -7]], [118, [0, 0]]] },
      },
      cackling: { o: [[0, 0, 'hold'], [14, 100, 'hold'], [84, 0, 'hold'], [120, 0]] },
    },
  })], BODY_VIEW, op)]);
}

// Head-only loops
const headComp = (name, op, cfg, headFx, extras = [], view = HEAD_VIEW, bg) => {
  const layers = [];
  if (bg) layers.push(shapeLayer('background', [El(256, 256, 256, 256, { fill: bg, stroke: 'none' })], {}, op));
  layers.push(shapeLayer('WebSaurus head', [G('head', [...head(cfg), ...extras], [260, 196], headFx)], view, op));
  return comp(name, op, layers);
};

// 3. Smug: the hot take face
const smugSpec = () => {
  const b = blink(115);
  return [{
    moods: {
      smug: {
        mouth: { r: [[0, 0], [36, -3], [64, -3], [74, 0], [180, 0]] },
        eyes: { p: [[0, [0, 0]], [90, [0, 0]], [100, [4, 2]], [140, [4, 2]], [150, [0, 0]], [180, [0, 0]]] },
        eyeL: { s: b }, eyeR: { s: b },
        browL: { p: [[0, [0, 0]], [30, [0, 0]], [38, [0, -8], 'back'], [46, [0, -2]], [54, [0, -8], 'back'], [66, [0, 0]], [180, [0, 0]]] },
      },
    },
  }, { r: [[0, 0], [90, -3], [180, 0]], p: [[0, [0, 0]], [90, [0, -3]], [180, [0, 0]]] }];
};
out['websaurus-smug'] = headComp('WebSaurus smug', 180, ...smugSpec());

// 4. Shocked: the "wait, what?" face
{
  const brow = { p: [[0, [0, 0]], [6, [0, -8], 'out'], [30, [0, -5]], [100, [0, -5]], [120, [0, 0]]] };
  const pupil = { s: [[0, [100, 100]], [6, [60, 60]], [20, [85, 85]], [24, [70, 70]], [28, [85, 85]], [100, [85, 85]], [120, [100, 100]]] };
  const tremble = [[0, 0], [20, 0]];
  for (let i = 0; i < 9; i++) tremble.push([24 + i * 4, (i % 2 ? -1 : 1) * 1.5 * (1 - i / 10)]);
  tremble.push([60, 0], [120, 0]);
  const burst = G('burst', [
    P('M262 46 L254 30', { sw: 6 }),
    P('M300 40 L300 22', { sw: 6 }),
    P('M338 46 L346 30', { sw: 6 }),
  ], [300, 52], {
    o: [[0, 0], [6, 100], [40, 100], [56, 0], [120, 0]],
    s: [[0, [60, 60]], [8, [112, 112], 'out'], [18, [100, 100]], [120, [100, 100]]],
  });
  out['websaurus-shocked'] = headComp('WebSaurus shocked', 120, {
    moods: {
      shocked: {
        mouth: { s: [[0, [100, 100]], [6, [114, 120], 'out'], [20, [105, 110]], [100, [105, 110]], [120, [100, 100]]] },
        eyeL: pupil, eyeR: pupil, browL: brow, browR: brow,
      },
    },
  }, {
    p: [[0, [0, 0]], [6, [0, -16], 'out'], [18, [0, 0]], [120, [0, 0]]],
    s: [[0, [100, 100]], [6, [96, 106]], [18, [103, 97]], [28, [100, 100]], [120, [100, 100]]],
    r: tremble,
  }, [burst]);
}

// 5. Thinking: the upgrade face, with thought dots
{
  const dot = (cx, cy, r, start) => G(`dot ${start}`, [Ci(cx, cy, r, { fill: C.paper, sw: 5 })], [cx, cy], {
    s: [[0, [0, 0]], [start, [0, 0], 'back'], [start + 14, [100, 100]], [140, [100, 100]], [152, [0, 0]], [180, [0, 0]]],
  });
  const b = blink(120);
  out['websaurus-thinking'] = headComp('WebSaurus thinking', 180, {
    moods: {
      thinking: {
        mouth: { p: [[0, [0, 0]], [90, [-4, 1]], [180, [0, 0]]] },
        eyes: { p: [[0, [0, 0]], [30, [-4, -2]], [80, [-4, -2]], [100, [5, -3]], [150, [5, -3]], [170, [0, 0]], [180, [0, 0]]] },
        eyeL: { s: b }, eyeR: { s: b },
        browR: { p: [[0, [0, 0]], [90, [0, -5]], [180, [0, 0]]] },
      },
    },
  }, { r: [[0, 0], [90, 4], [180, 0]] }, [dot(340, 52, 4, 20), dot(352, 36, 6, 40), dot(366, 16, 9, 60)]);
}

// 6. Cackling: the useful chaos face
{
  const r = [], p = [], ms = [];
  for (let i = 0; i <= 12; i++) {
    const t = i * 10;
    const fade = i >= 10 ? (12 - i) / 3 : 1;
    r.push([t, i === 0 || i === 12 ? 0 : (i % 2 ? -4 : 3) * fade]);
  }
  for (let i = 0; i <= 24; i++) {
    const t = i * 5;
    p.push([t, [0, i % 2 && i < 23 ? -7 : 0]]);
    ms.push([t, i % 2 && i < 23 ? [104, 112] : [100, 100]]);
  }
  out['websaurus-cackling'] = headComp('WebSaurus cackling', 120, {
    moods: { cackling: { mouth: { s: ms }, eyes: { p: p.map(([t, [x, y]]) => [t, [x, y * -0.25]]) } } },
  }, { r, p });
}

// 7. Talk: mouth flaps for voiceover and explainer videos
{
  const open = [[0, 0], [7, 1], [13, 0.3], [20, 0.9], [28, 0.15], [36, 0.8], [42, 0.35], [50, 1], [58, 0.2], [64, 0.6],
    [70, 0], [80, 0], [86, 0.85], [93, 0.3], [100, 0.9], [108, 0.25], [114, 0.5], [120, 0]];
  const b = blink(72);
  const brow = { p: [[0, [0, 0]], [44, [0, 0]], [50, [0, -5], 'back'], [62, [0, -5]], [70, [0, 0]], [120, [0, 0]]] };
  out['websaurus-talk'] = headComp('WebSaurus talk', 120, {
    talk: open,
    moods: { smug: { eyeL: { s: b }, eyeR: { s: b }, browL: brow, browR: brow } },
  }, {
    p: [[0, [0, 0]], [15, [0, -2]], [30, [0, 0]], [45, [0, -3]], [60, [0, 0]], [75, [0, -2]], [90, [0, 0]], [105, [0, -2]], [120, [0, 0]]],
    r: [[0, 0], [60, -1.5], [120, 0]],
  });
}

// 8. Avatar: smug loop on an ink circle with the paper outline
{
  const [cfg, fx] = smugSpec();
  out['websaurus-avatar'] = headComp('WebSaurus avatar', 180, { ...cfg, headStroke: C.paper, headSw: 6 }, fx, [],
    { a: [260, 132], p: [256, 268], s: [165, 165] }, C.ink);
}

fs.mkdirSync(OUT, { recursive: true });
for (const [name, data] of Object.entries(out)) {
  const file = path.join(OUT, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data));
  console.log(`${name}.json  ${(fs.statSync(file).size / 1024).toFixed(1)} KB  ${data.op / FR}s`);
}
