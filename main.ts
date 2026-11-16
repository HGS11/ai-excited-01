import * as fs from "node:fs";
import * as zlib from "node:zlib";
import * as path from "node:path";

const S = 2048;
const W = 1024;
const H = 1024;
const pixels = new Uint8Array(S * S * 4);

function blend(x: number, y: number, r: number, g: number, b: number, a: number): void {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= S || iy >= S || a <= 0) return;
  const p = (iy * S + ix) * 4;
  const old = pixels[p + 3] / 255;
  const next = a + old * (1 - a);
  if (next <= 0) return;
  pixels[p] = Math.round((r * a + pixels[p] * old * (1 - a)) / next);
  pixels[p + 1] = Math.round((g * a + pixels[p + 1] * old * (1 - a)) / next);
  pixels[p + 2] = Math.round((b * a + pixels[p + 2] * old * (1 - a)) / next);
  pixels[p + 3] = Math.round(next * 255);
}

function rect(x: number, y: number, w: number, h: number, c: number[], a = 1): void {
  const xa = Math.max(0, Math.floor(x));
  const ya = Math.max(0, Math.floor(y));
  const xb = Math.min(S, Math.ceil(x + w));
  const yb = Math.min(S, Math.ceil(y + h));
  for (let yy = ya; yy < yb; yy++) for (let xx = xa; xx < xb; xx++) blend(xx, yy, c[0], c[1], c[2], a);
}

function circle(cx: number, cy: number, radius: number, c: number[], a = 1): void {
  const r2 = radius * radius;
  for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(S, Math.ceil(cy + radius)); y++) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(S, Math.ceil(cx + radius)); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) blend(x, y, c[0], c[1], c[2], a);
    }
  }
}

function line(x1: number, y1: number, x2: number, y2: number, width: number, c: number[], a = 1): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const rad = width / 2;
  const minx = Math.max(0, Math.floor(Math.min(x1, x2) - rad));
  const maxx = Math.min(S, Math.ceil(Math.max(x1, x2) + rad));
  const miny = Math.max(0, Math.floor(Math.min(y1, y2) - rad));
  const maxy = Math.min(S, Math.ceil(Math.max(y1, y2) + rad));
  for (let y = miny; y < maxy; y++) for (let x = minx; x < maxx; x++) {
    let t = len2 === 0 ? 0 : ((x + 0.5 - x1) * dx + (y + 0.5 - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const qx = x1 + t * dx;
    const qy = y1 + t * dy;
    const ex = x + 0.5 - qx;
    const ey = y + 0.5 - qy;
    if (ex * ex + ey * ey <= rad * rad) blend(x, y, c[0], c[1], c[2], a);
  }
}

function polygon(points: number[][], c: number[], a = 1): void {
  let minx = S, miny = S, maxx = 0, maxy = 0;
  for (const p of points) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
  for (let y = Math.max(0, Math.floor(miny)); y < Math.min(S, Math.ceil(maxy)); y++) {
    for (let x = Math.max(0, Math.floor(minx)); x < Math.min(S, Math.ceil(maxx)); x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i][0], yi = points[i][1], xj = points[j][0], yj = points[j][1];
        if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < (xj - xi) * (y + 0.5 - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) blend(x, y, c[0], c[1], c[2], a);
    }
  }
}

let seed = 873421;
function rnd(): number { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }

function glow(cx: number, cy: number, radius: number, color: number[], strength: number): void {
  for (let i = 12; i >= 1; i--) {
    const f = i / 12;
    circle(cx, cy, radius * f, color, strength * 0.045);
  }
}

function burst(cx: number, cy: number, radius: number, points: number, inner: number, color: number[], alpha: number): void {
  const p: number[][] = [];
  for (let i = 0; i < points * 2; i++) {
    const ang = i * Math.PI / points - Math.PI / 2;
    const rr = i % 2 === 0 ? radius : inner;
    p.push([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr]);
  }
  polygon(p, color, alpha);
}

// Deep ink field with a restrained blue-violet radial atmosphere.
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  const dx = (x - 1010) / 1550;
  const dy = (y - 900) / 1700;
  const glowv = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
  const band = Math.max(0, 1 - Math.abs((x + y * 0.58) / 2600));
  const p = (y * S + x) * 4;
  pixels[p] = Math.round(5 + glowv * 8 + band * 3);
  pixels[p + 1] = Math.round(8 + glowv * 9);
  pixels[p + 2] = Math.round(25 + glowv * 30 + band * 12);
  pixels[p + 3] = 255;
}

const cx = 1160, cy = 760;
glow(cx, cy, 700, [255, 43, 125], 0.78);
glow(cx, cy, 510, [255, 164, 44], 0.9);
glow(cx, cy, 310, [255, 240, 190], 1);

// Speed rays converge on the rupture.
for (let i = 0; i < 54; i++) {
  const ang = rnd() * Math.PI * 2;
  const outer = 900 + rnd() * 700;
  const inner = 300 + rnd() * 160;
  const x1 = cx + Math.cos(ang) * outer;
  const y1 = cy + Math.sin(ang) * outer;
  const x2 = cx + Math.cos(ang) * inner;
  const y2 = cy + Math.sin(ang) * inner;
  const col = i % 4 === 0 ? [53, 223, 255] : (i % 3 === 0 ? [255, 54, 133] : [106, 137, 197]);
  line(x1, y1, x2, y2, 2 + rnd() * 5, col, 0.24 + rnd() * 0.22);
}

// Cracked wall plane, broken into dark angular plates.
polygon([[210,180],[780,95],[1090,250],[1010,535],[790,650],[420,540],[170,420]], [18,25,52], 0.94);
polygon([[1330,105],[1830,210],[1960,650],[1660,760],[1390,620],[1260,400]], [19,24,51], 0.95);
polygon([[180,580],[510,550],[785,700],[650,1070],[330,1240],[90,1010]], [14,21,43], 0.95);
polygon([[1290,720],[1570,650],[1960,810],[1870,1220],[1540,1330],[1280,1060]], [15,20,42], 0.96);
polygon([[680,1320],[1040,1190],[1260,1380],[1090,1780],[730,1850],[540,1600]], [18,23,47], 0.94);
polygon([[1360,1290],[1670,1220],[1940,1450],[1850,1900],[1490,1870],[1260,1600]], [17,21,43], 0.95);

// Angular fissures, each edged by a warm luminous seam.
const cracks = [
  [[cx,cy],[1080,650],[1000,590],[930,480],[820,430],[760,310]],
  [[cx,cy],[1250,640],[1320,560],[1350,440],[1450,350],[1510,220]],
  [[cx,cy],[1040,800],[930,820],[850,900],[720,930],[650,1080]],
  [[cx,cy],[1260,850],[1360,900],[1420,1010],[1540,1070],[1620,1200]],
  [[cx,cy],[1120,900],[1080,1010],[990,1090],[950,1210],[880,1280]],
  [[cx,cy],[1200,590],[1190,490],[1240,400],[1220,300]],
  [[cx,cy],[1010,730],[910,690],[850,610],[740,590]],
  [[cx,cy],[1310,760],[1420,730],[1500,660],[1600,650]],
  [[cx,cy],[1160,960],[1210,1080],[1190,1190],[1250,1290]]
];
for (const crack of cracks) {
  for (let i = 0; i < crack.length - 1; i++) {
    const a = crack[i], b = crack[i + 1];
    line(a[0], a[1], b[0], b[1], 22, [255, 69, 116], 0.46);
    line(a[0], a[1], b[0], b[1], 10, [255, 174, 63], 0.9);
    line(a[0], a[1], b[0], b[1], 4, [255, 246, 202], 0.98);
  }
}

// Large flying wall plates at the perimeter, with motion tails.
const shards = [
  [[90,140],[310,70],[400,210],[300,330],[130,300]],
  [[1610,90],[1910,140],[1970,360],[1800,310],[1690,220]],
  [[50,510],[240,420],[300,550],[220,730],[80,680]],
  [[1780,500],[2010,420],[2030,700],[1870,790],[1730,670]],
  [[130,1120],[310,1030],[470,1160],[360,1330],[170,1300]],
  [[1750,1080],[1980,1010],[2010,1270],[1830,1340],[1690,1220]],
  [[470,1720],[650,1570],[820,1670],[740,1930],[530,1980]],
  [[1280,1800],[1450,1610],[1680,1710],[1660,1960],[1420,2020]]
];
for (let i = 0; i < shards.length; i++) {
  const pts = shards[i];
  const midx = pts.reduce((v, p) => v + p[0], 0) / pts.length;
  const midy = pts.reduce((v, p) => v + p[1], 0) / pts.length;
  const dx = midx - cx, dy = midy - cy;
  line(midx - dx * 0.19, midy - dy * 0.19, midx - dx * 0.46, midy - dy * 0.46, 12, i % 2 ? [255, 48, 137] : [42, 222, 255], 0.78);
  polygon(pts, [25, 34, 67], 1);
  const tip = pts[1];
  line(pts[0][0], pts[0][1], tip[0], tip[1], 9, i % 2 ? [255, 190, 71] : [81, 224, 255], 0.9);
  polygon([[midx,midy],[pts[0][0],pts[0][1]],[tip[0],tip[1]]], [47, 60, 99], 0.75);
}

// Bright shards close to the rupture push toward the viewer.
polygon([[930,580],[1020,530],[1080,615],[1010,675]], [255, 183, 76], 0.95);
polygon([[1280,590],[1370,650],[1300,735],[1240,660]], [255, 78, 145], 0.94);
polygon([[950,900],[1035,875],[1080,980],[1000,1000]], [68, 226, 255], 0.9);
polygon([[1290,880],[1370,930],[1305,1020],[1240,960]], [255, 194, 76], 0.95);

// Rupture halo and blinding white-hot center.
glow(cx, cy, 310, [255, 132, 38], 1);
burst(cx, cy, 300, 18, 224, [255, 189, 70], 0.88);
burst(cx, cy, 235, 18, 202, [255, 246, 222], 0.96);
circle(cx, cy, 165, [255, 255, 244], 1);
circle(cx - 22, cy - 25, 106, [255, 255, 255], 1);
circle(cx + 38, cy + 46, 49, [255, 255, 255], 1);

// Outward embers and comic confetti.
for (let i = 0; i < 145; i++) {
  const ang = rnd() * Math.PI * 2;
  const dist = 245 + rnd() * 650;
  const x = cx + Math.cos(ang) * dist;
  const y = cy + Math.sin(ang) * dist;
  const size = 3 + rnd() * 11;
  const col = i % 5 === 0 ? [59, 226, 255] : (i % 3 === 0 ? [255, 57, 143] : [255, 190, 68]);
  line(x, y, x - Math.cos(ang) * (10 + rnd() * 30), y - Math.sin(ang) * (10 + rnd() * 30), size * 0.75, col, 0.9);
  circle(x, y, size, col, 0.95);
}

// Lower-left WOW badge: burst plate, rim, and chunky bitmap lettering.
burst(385, 1510, 333, 14, 255, [255, 191, 55], 1);
burst(385, 1510, 288, 14, 238, [248, 51, 120], 1);
circle(385, 1510, 230, [12, 20, 46], 1);
circle(385, 1510, 210, [21, 34, 70], 1);

const glyphs: Record<string, string[]> = {
  W: ["10001","10001","10001","10101","10101","10101","10101","10101","01010"],
  O: ["01110","10001","10001","10001","10001","10001","10001","10001","01110"],
  "!": ["1","1","1","1","1","1","1","0","1"]
};
function drawGlyph(ch: string, x: number, y: number, unit: number, color: number[]): number {
  const rows = glyphs[ch];
  const cell = unit;
  for (let ry = 0; ry < rows.length; ry++) for (let rx = 0; rx < rows[ry].length; rx++) {
    if (rows[ry][rx] === "1") {
      rect(x + rx * cell + 8, y + ry * cell + 10, cell, cell, [2, 8, 20], 0.95);
      rect(x + rx * cell, y + ry * cell, cell, cell, color, 1);
      rect(x + rx * cell + 5, y + ry * cell + 4, Math.max(2, cell - 10), 8, [255, 241, 183], 0.55);
    }
  }
  return rows[0].length * cell;
}
const unit = 32;
const total = 5 * unit + 0.26 * unit + 5 * unit + 0.26 * unit + 5 * unit;
let gx = 385 * 2 - total / 2;
const gy = 1510 * 2 - 4.5 * unit;
gx += drawGlyph("W", gx, gy, unit, [255, 203, 75]) + unit * 0.26;
gx += drawGlyph("O", gx, gy, unit, [255, 91, 140]) + unit * 0.26;
drawGlyph("W", gx, gy, unit, [71, 226, 255]);

// Badge sparkle marks.
for (let i = 0; i < 8; i++) {
  const ang = i * Math.PI / 4;
  const x = 385 + Math.cos(ang) * 270;
  const y = 755 + Math.sin(ang) * 270;
  line(x * 2, y * 2, (x + Math.cos(ang) * 22) * 2, (y + Math.sin(ang) * 22) * 2, 8, [255, 246, 201], 0.95);
}

// Supersample resolve by averaging each 2 by 2 block.
const out = new Uint8Array(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const src = ((y * 2) * S + x * 2) * 4;
  const dst = (y * W + x) * 4;
  for (let c = 0; c < 4; c++) out[dst + c] = Math.round((pixels[src + c] + pixels[src + 4 + c] + pixels[src + S * 4 + c] + pixels[src + S * 4 + 4 + c]) / 4);
}

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name: string, data: Uint8Array): Buffer {
  const type = Buffer.from(name, "ascii");
  const body = Buffer.concat([type, Buffer.from(data)]);
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  body.copy(result, 4);
  result.writeUInt32BE(crc32(body), 8 + data.length);
  return result;
}
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  const row = y * (W * 4 + 1);
  raw[row] = 0;
  Buffer.from(out.buffer, out.byteOffset + y * W * 4, W * 4).copy(raw, row + 1);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", new Uint8Array(0))
]);
if (png.length > 1048576) throw new Error("PNG exceeds 1048576 bytes");
const dir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "entry.png"), png);
