export type Format = 'png' | 'jpeg';

export function buildFilename(originalName: string | undefined, format: Format): string {
  const ext = format === 'jpeg' ? 'jpg' : 'png';
  const base = (originalName ?? '').replace(/\.[^./]+$/, '');
  const safeBase = base.length > 0 ? base : 'id';
  return `${safeBase}-sanitized.${ext}`;
}

export function formatToMime(format: Format): {
  mime: string;
  quality: number | undefined;
} {
  if (format === 'jpeg') return { mime: 'image/jpeg', quality: 0.92 };
  return { mime: 'image/png', quality: undefined };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
