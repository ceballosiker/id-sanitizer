export function getWatermarkPlaceholder(now: Date, locale: string): string {
  const shortDate = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(now);
  return `For [purpose] · ${shortDate}`;
}
