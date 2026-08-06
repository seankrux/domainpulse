/** Date helpers for GSC Search Analytics (America/Los_Angeles calendar dates). */

const GSC_TZ = 'America/Los_Angeles';

function partsInTz(date, timeZone = GSC_TZ) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

/** YYYY-MM-DD in America/Los_Angeles for a given instant. */
export function formatDate(date = new Date()) {
  const { year, month, day } = partsInTz(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Parse YYYY-MM-DD as a noon UTC anchor to avoid DST edge flips when shifting days. */
function parseYmd(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return { y, m, d };
}

function ymdFromUtcNoon(y, m, d) {
  return formatDate(new Date(Date.UTC(y, m - 1, d, 20, 0, 0)));
}

function addDaysYmd(ymd, delta) {
  const { y, m, d } = parseYmd(ymd);
  const dt = new Date(Date.UTC(y, m - 1, d + delta, 20, 0, 0));
  return formatDate(dt);
}

/** GSC data typically lags ~2–3 days; end before “today” in PT. */
export function defaultRange(days = 28, now = new Date()) {
  const endDate = addDaysYmd(formatDate(now), -3);
  const startDate = addDaysYmd(endDate, -(days - 1));
  return { startDate, endDate, days };
}

export function previousRange(startDate, endDate) {
  const start = parseYmd(startDate);
  const end = parseYmd(endDate);
  const startUtc = Date.UTC(start.y, start.m - 1, start.d);
  const endUtc = Date.UTC(end.y, end.m - 1, end.d);
  const span = Math.round((endUtc - startUtc) / 86400000) + 1;
  const prevEnd = addDaysYmd(startDate, -1);
  const prevStart = addDaysYmd(prevEnd, -(span - 1));
  return { startDate: prevStart, endDate: prevEnd };
}

export function pctChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export { GSC_TZ, ymdFromUtcNoon, addDaysYmd };
