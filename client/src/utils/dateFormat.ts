const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export function formatShortDate(isoDate: string): string {
  const time = Date.parse(isoDate);
  if (!Number.isFinite(time)) {
    return isoDate;
  }
  return shortDateFormatter.format(new Date(time));
}
