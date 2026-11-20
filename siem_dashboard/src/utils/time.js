// The server stores UTC timestamps with no timezone marker ("2026-11-05T12:20:13"
// or SQLite's "2026-11-05 12:20:13"). `new Date()` would read those as local time,
// so mark them as UTC before parsing; the browser then displays local time.
export function parseTs(value) {
  if (value instanceof Date) return value;
  const s = String(value ?? '').trim().replace(' ', 'T');
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(s);
  return new Date(hasZone ? s : `${s}Z`);
}

// <input type="datetime-local"> gives local time ("2026-11-05T15:20"); the server
// compares against UTC "YYYY-MM-DD HH:MM:SS", so convert before querying.
export function localInputToUtc(value) {
  const d = new Date(value);
  return isNaN(d) ? value : d.toISOString().slice(0, 19).replace('T', ' ');
}
