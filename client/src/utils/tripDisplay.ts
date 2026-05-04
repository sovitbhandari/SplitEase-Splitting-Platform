export function displayTripName(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed || trimmed.toLowerCase() === 'trip') {
    return 'Untitled Trip';
  }
  return trimmed;
}

/** True when the trip could use a clearer name (empty, generic, or displayed as Untitled). */
export function tripNeedsTitleAttention(raw: string | null | undefined): boolean {
  const trimmed = raw?.trim() ?? '';
  return !trimmed || trimmed.toLowerCase() === 'trip';
}
