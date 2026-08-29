/**
 * A minimal, dependency-free PNG encoder.
 *
 * Purpose
 *   `tools/textures/build-textures.mjs` bakes the app's surface textures into seamless
 *   RGBA tiles. Writing them needs a PNG writer; the standing constraint is "install
 *   packages, never software", and a 90-line encoder over Node's own `zlib` is cheaper
 *   than a dependency for a script that runs perhaps twice a year.
 *
 * Scope
 *   8-bit RGBA (colour type 6), no interlacing, one IDAT, filter type 0 on every scanline.
 *   That is all the tiles need. It is not a general PNG library and should not become one.
 */

import { deflateSync } from 'node:zlib';

/** The eight bytes every PNG starts with. */
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Colour type 6 — truecolour with alpha. */
const COLOR_TYPE_RGBA = 6;

/** Bits per channel. */
const BIT_DEPTH = 8;

/** Channels per pixel in colour type 6. */
const CHANNELS = 4;

/** The CRC-32 table, built once. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/**
 * CRC-32 of a buffer, as PNG chunks require.
 *
 * @param {Buffer} bytes The bytes to sum.
 * @returns {number} The unsigned checksum.
 */
function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Wrap a payload as a length-type-data-CRC chunk.
 *
 * @param {string} type The four-character chunk type.
 * @param {Buffer} data The chunk payload.
 * @returns {Buffer} The framed chunk.
 */
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

/**
 * Encode an RGBA raster as a PNG.
 *
 * @param {{ width: number, height: number, pixels: Uint8Array }} image
 *   `pixels` is `width * height * 4` bytes, row-major, R G B A.
 * @returns {Buffer} The complete PNG file.
 */
export function encodePng({ width, height, pixels }) {
  const expected = width * height * CHANNELS;
  if (pixels.length !== expected) {
    throw new Error(`expected ${expected} bytes of RGBA, received ${pixels.length}`);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.writeUInt8(BIT_DEPTH, 8);
  header.writeUInt8(COLOR_TYPE_RGBA, 9);
  // Compression 0, filter 0, interlace 0 — the only values PNG defines for all three.

  const stride = width * CHANNELS;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * stride, stride).copy(
      raw,
      y * (stride + 1) + 1,
    );
  }

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
