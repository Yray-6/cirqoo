export function asDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function iso(value: Date | string | null | undefined) {
  return asDate(value)?.toISOString() ?? null;
}
