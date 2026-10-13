// apps/desktop/assets/generate-placeholder-icons.cjs
// DIST-03 — Generador reproducible de iconos PLACEHOLDER para Ego.
// Produce: icon.svg (fuente vectorial), icon.png (512px), icon.ico
// (multi-tamaño PNG-in-ICO 16/32/48/256, válido Vista+), icon.icns
// (contenedor icns con payloads PNG ic07/ic08/ic09 — ver nota abajo).
// Solo Node stdlib (zlib). BLOQUEO al owner: diseño final profesional
// antes de DIST-04 (firmado) / DIST-08 (Golden Path Beta).
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const DIR = __dirname;

// Paleta: fondo tinta casi-negra, marca "E" abstracta en papel + acento.
const BG = [16, 17, 22, 255];
const FG = [237, 234, 226, 255];
const ACCENT = [196, 120, 52, 255];

function paint(size) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3];
  };
  const rect = (x0, y0, w, h, c) => {
    for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) set(x, y, c);
  };
  const disc = (cx, cy, r, c) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
        const dx = x - cx; const dy = y - cy;
        if (dx * dx + dy * dy <= r * r) set(x, y, c);
      }
    }
  };
  // Fondo con margen redondeado simulado (esquinas recortadas).
  const m = Math.floor(size * 0.06);
  rect(0, m, size, size - 2 * m, BG);
  rect(m, 0, size - 2 * m, size, BG);
  disc(m, m, m, BG); disc(size - m, m, m, BG);
  disc(m, size - m, m, BG); disc(size - m, size - m, m, BG);
  // Marca "E": barra vertical + tres barras horizontales.
  const bx = Math.floor(size * 0.30); const bw = Math.floor(size * 0.075);
  const by = Math.floor(size * 0.26); const bh = Math.floor(size * 0.48);
  rect(bx, by, bw, bh, FG);
  const armY = [by, Math.floor(size * 0.4625), by + bh - Math.floor(size * 0.075)];
  for (const y of armY) rect(bx, y, Math.floor(size * 0.40), Math.floor(size * 0.075), FG);
  // Punto acento (nodo cognitivo).
  disc(Math.floor(size * 0.70), Math.floor(size * 0.30), Math.floor(size * 0.055), ACCENT);
  return { size, px };
}

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePng({ size, px }) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y += 1) {
    raw[y * (1 + size * 4)] = 0; // filtro None
    px.copy(raw, y * (1 + size * 4) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function encodeIco(pngs) {
  // pngs: [{ size: number, png: Buffer }] — entradas PNG-in-ICO
  // multi-tamaño (16/32/48/256) para taskbar/explorer sin reescalado.
  // 256 se codifica como 0 en el byte de dimensión (spec ICO).
  const n = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(n, 4);
  let offset = 6 + 16 * n;
  const entries = [];
  const bodies = [];
  for (const { size, png } of pngs) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size; entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0; entry[3] = 0;
    entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(entry);
    bodies.push(png);
  }
  return Buffer.concat([header, ...entries, ...bodies]);
}

function encodeIcns(entries) {
  // entries: [{ type: 'ic07'|'ic08'|'ic09', png: Buffer }]
  // Contenedor icns estructuralmente válido (magic 'icns' + longitudes).
  // Payloads PNG (no JP2 clásico): aceptados por macOS moderno, pero el
  // render final en Finder/Dock SOLO queda validado en máquina macOS —
  // ver BLOQUEO diseño en README.md.
  const body = Buffer.concat(entries.map(({ type, png }) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(8 + png.length, 0);
    return Buffer.concat([Buffer.from(type, 'ascii'), len, png]);
  }));
  const head = Buffer.alloc(8);
  head.write('icns', 0, 'ascii');
  head.writeUInt32BE(8 + body.length, 4);
  return Buffer.concat([head, body]);
}

function main() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n`
    + `  <!-- Ego placeholder icon (DIST-03). Diseño final pendiente del owner. -->\n`
    + `  <rect x="30" y="30" width="452" height="452" rx="110" fill="#101116"/>\n`
    + `  <rect x="154" y="133" width="38" height="246" fill="#EDEAE2"/>\n`
    + `  <rect x="154" y="133" width="205" height="38" fill="#EDEAE2"/>\n`
    + `  <rect x="154" y="237" width="205" height="38" fill="#EDEAE2"/>\n`
    + `  <rect x="154" y="341" width="205" height="38" fill="#EDEAE2"/>\n`
    + `  <circle cx="358" cy="154" r="28" fill="#C47834"/>\n`
    + `</svg>\n`;
  fs.writeFileSync(path.join(DIR, 'icon.svg'), svg);
  console.log('[icons] icon.svg');

  const png512 = encodePng(paint(512));
  fs.writeFileSync(path.join(DIR, 'icon.png'), png512);
  console.log(`[icons] icon.png (${png512.length} bytes)`);

  const ico = encodeIco([
    { size: 16, png: encodePng(paint(16)) },
    { size: 32, png: encodePng(paint(32)) },
    { size: 48, png: encodePng(paint(48)) },
    { size: 256, png: encodePng(paint(256)) },
  ]);
  fs.writeFileSync(path.join(DIR, 'icon.ico'), ico);
  console.log(`[icons] icon.ico (${ico.length} bytes)`);

  const icns = encodeIcns([
    { type: 'ic07', png: encodePng(paint(128)) },
    { type: 'ic08', png: encodePng(paint(256)) },
    { type: 'ic09', png: png512 },
  ]);
  fs.writeFileSync(path.join(DIR, 'icon.icns'), icns);
  console.log(`[icons] icon.icns (${icns.length} bytes)`);
}

main();
