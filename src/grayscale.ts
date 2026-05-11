// Rec. 601 luma weights (Y = 0.299R + 0.587G + 0.114B). Matches the conversion
// used by CSS `filter: grayscale(1)` per the Filter Effects spec.
export function toGrayscale(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length);
  const n = rgba.length - (rgba.length % 4);
  for (let i = 0; i < n; i += 4) {
    const y = Math.round(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]);
    out[i] = y;
    out[i + 1] = y;
    out[i + 2] = y;
    out[i + 3] = rgba[i + 3];
  }
  for (let i = n; i < rgba.length; i++) out[i] = rgba[i];
  return out;
}
