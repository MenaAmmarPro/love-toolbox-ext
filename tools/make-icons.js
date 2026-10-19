"use strict";

/*
 * Dependency-free PNG icon generator for love-toolbox-ext.
 * Run once:  node tools/make-icons.js
 */

const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(t, d) {
  const l = Buffer.alloc(4);
  l.writeUInt32BE(d.length, 0);
  const ty = Buffer.from(t, "ascii");
  const cr = Buffer.alloc(4);
  cr.writeUInt32BE(crc32(Buffer.concat([ty, d])), 0);
  return Buffer.concat([l, ty, d, cr]);
}

function png(size, fn) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      const p = fn(x, y, size);
      raw[o++] = p[0];
      raw[o++] = p[1];
      raw[o++] = p[2];
      raw[o++] = p[3];
    }
  }
  const ih = Buffer.alloc(13);
  ih.writeUInt32BE(size, 0);
  ih.writeUInt32BE(size, 4);
  ih[8] = 8;
  ih[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ih),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function heart(x, y, size) {
  const nx = (x + 0.5) / size * 2 - 1;
  const ny = 1 - (y + 0.5) / size * 2;
  const X = nx * 1.3;
  const Y = ny * 1.3 + 0.1;
  return Math.pow(X * X + Y * Y - 1, 3) - X * X * Math.pow(Y, 3) <= 0;
}

fs.mkdirSync("icons", { recursive: true });
for (const s of [16, 32, 48, 128]) {
  fs.writeFileSync(
    path.join("icons", `icon-${s}.png`),
    png(s, (x, y, z) => (heart(x, y, z) ? [233, 30, 99, 255] : [255, 255, 255, 0]))
  );
}
fs.writeFileSync(
  path.join("icons", "icon.svg"),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#e91e63" d="M12 21s-7.5-4.6-10-9.2C.4 8.6 2.2 5 5.7 5c2 0 3.4 1 4.3 2.3L12 9.5l2-2.2C14.9 6 16.3 5 18.3 5 21.8 5 23.6 8.6 22 11.8 19.5 16.4 12 21 12 21z"/></svg>'
);
console.log("icons written");
