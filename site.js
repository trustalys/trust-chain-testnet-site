// The public page of the Trust Chain test network (E5 research R-7, contracts/site.md).
// It works out the reset dates (D33, D35), reads the early resets in notices.json, and asks the
// schema address whether the network runs now (D32). Plain JavaScript, no library, nothing from
// another server, no cookie.

export const CHECK_URL = 'https://schema.test.trustalys.net/';
export const CHECK_TIMEOUT_MS = 8000;
const RESET_HOUR_UTC = 6;
const REASON_MAX = 200;

export const STATUS_TEXT = {
  checking: 'Checking whether the network runs...',
  runs: 'The network runs.',
  down: 'The network does not run now.',
  unreachable: 'The network does not run now, or your browser could not reach it.',
};

// ---- Reset dates: the first Monday of each month at 06:00 UTC (D33) ----

function firstMonday(year, month) {
  const first = new Date(Date.UTC(year, month, 1, RESET_HOUR_UTC));
  const daysToMonday = (8 - first.getUTCDay()) % 7;
  return new Date(Date.UTC(year, month, 1 + daysToMonday, RESET_HOUR_UTC));
}

// The first scheduled reset after now. At the reset time itself, that reset counts as passed.
export function nextScheduledReset(now) {
  const thisMonth = firstMonday(now.getUTCFullYear(), now.getUTCMonth());
  if (thisMonth > now) return thisMonth;
  return firstMonday(now.getUTCFullYear(), now.getUTCMonth() + 1);
}

// The latest scheduled reset at or before now.
export function lastScheduledReset(now) {
  const thisMonth = firstMonday(now.getUTCFullYear(), now.getUTCMonth());
  if (thisMonth <= now) return thisMonth;
  return firstMonday(now.getUTCFullYear(), now.getUTCMonth() - 1);
}

// ---- Early resets: notices.json, edited by the owner on GitHub's website (D35) ----

const UTC_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?Z$/;

function validTime(text) {
  if (typeof text !== 'string' || !UTC_TIME.test(text)) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  // Reject dates that JavaScript rolls over, such as month 13.
  if (date.toISOString().slice(0, 16) !== text.slice(0, 16)) return null;
  return date;
}

// parseNotices(text) gives { notices: [{ date, reason }], error }. Entries that are not a valid
// time in UTC are ignored; a file that is not a JSON list gives error: true.
export function parseNotices(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { notices: [], error: true };
  }
  if (!Array.isArray(data)) return { notices: [], error: true };
  const notices = [];
  for (const entry of data) {
    if (entry === null || typeof entry !== 'object') continue;
    const date = validTime(entry.date);
    if (!date) continue;
    const reason = typeof entry.reason === 'string' ? entry.reason.slice(0, REASON_MAX) : '';
    notices.push({ date, reason });
  }
  return { notices, error: false };
}

// resetDates(now, notices) gives { next, last }, each { date, early, reason }.
export function resetDates(now, notices) {
  let next = { date: nextScheduledReset(now), early: false, reason: '' };
  let last = { date: lastScheduledReset(now), early: false, reason: '' };
  for (const notice of notices) {
    if (notice.date > now && notice.date < next.date) next = { ...notice, early: true };
    if (notice.date <= now && notice.date > last.date) last = { ...notice, early: true };
  }
  return { next, last };
}

// ---- Whether the network runs now (FR-005a) ----

// checkNetwork(fetch) gives 'runs', 'down' or 'unreachable'. Caddy answers 503 for the schema
// address when the kit does not run, with the cross-origin header, so the browser can read it.
export async function checkNetwork(fetchFn, timeoutMs = CHECK_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(CHECK_URL, {
      method: 'GET', mode: 'cors', credentials: 'omit', cache: 'no-store', signal: controller.signal,
    });
    return response.status === 503 ? 'down' : 'runs';
  } catch {
    return 'unreachable';
  } finally {
    clearTimeout(timer);
  }
}

// ---- The page ----

function describe(date) {
  const utc = date.toLocaleString('en-GB', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const local = date.toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
  const time = date.toISOString().slice(11, 16);
  return `${utc} at ${time} UTC (${local} where you are)`;
}

function show(id, text) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
    element.hidden = !text;
  }
}

async function loadNotices() {
  try {
    const response = await fetch('notices.json', { cache: 'no-store', credentials: 'omit' });
    if (response.status === 404) return { notices: [], error: false };
    return parseNotices(await response.text());
  } catch {
    return { notices: [], error: true };
  }
}

async function start() {
  const statusElement = document.getElementById('status');
  statusElement.textContent = STATUS_TEXT.checking;
  statusElement.className = 'status checking';
  checkNetwork(fetch.bind(window)).then((result) => {
    statusElement.textContent = STATUS_TEXT[result];
    statusElement.className = `status ${result}`;
  });

  const { notices, error } = await loadNotices();
  const { next, last } = resetDates(new Date(), notices);
  show('next-reset', `Next reset: ${describe(next.date)}.`);
  show('early-reset', next.early ? `This is an early reset. Reason: ${next.reason || 'not given'}.` : '');
  show('last-reset', `Last reset: ${describe(last.date)}${last.early ? ' (an early reset)' : ''}.`);
  show('notices-error', error ? 'The list of early resets could not be read.' : '');
}

if (typeof document !== 'undefined') {
  start();
}
