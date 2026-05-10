import { deflateSync, crc32 } from 'node:zlib';

// 1×1 transparent PNG, smallest valid PNG (67 bytes after base64 decode).
// Used by tests that just need *any* valid image to exercise upload/download flow.
export const tinyPngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

function pngChunk(name: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const nameBuf = Buffer.from(name);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([nameBuf, data])));
  return Buffer.concat([len, nameBuf, data, crcBuf]);
}

// Encode a solid-color RGB PNG. Pure Node, no deps. Used by tests that need
// a multi-pixel canvas to draw redaction rectangles on and verify pixel content.
export function makeSolidPng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const [r, g, b] = rgb;
  const stride = 1 + width * 3;
  const raw = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const off = y * stride;
    raw[off] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const p = off + 1 + x * 3;
      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
    }
  }
  const idat = deflateSync(raw);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
