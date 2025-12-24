// src/lib/externalXlsxWriter.js
const XLSX = require('xlsx');
const crypto = require('crypto');

/**
 * Build a stable-ish ID from event fields (deterministic for same inputs).
 */
function stableId(e) {
  const raw = [
    e.source || '',
    e.date || '',
    e.location || '',
    e.latitude ?? '',
    e.longitude ?? ''
  ].join('|');

  const hash = crypto
    .createHash('sha1')
    .update(raw)
    .digest('hex')
    .slice(0, 12);

  return `${(e.source || 'unknown').replace(/\s+/g, '_')}_${hash}`;
}

/**
 * Timemap expects:
 *   DATE_FMT = MM/DD/YYYY
 *   TIME_FMT = hh:mm   (12-hour, no AM/PM)
 *
 * Datasheet-server must emit strings ONLY.
 */
function normalizeDateForTimemap(date) {
  if (!date) return '';

  // Expect upstream date as YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date).trim());
  if (!m) return '';

  const [, yyyy, mm, dd] = m;
  return `${mm}/${dd}/${yyyy}`;
}

function normalizeTimeForTimemap(time) {
  // Timemap defaults empty time to 00:00 internally,
  // but validator rejects invalid datetime, so we emit a safe value.
  return '12:00';
}

/**
 * Map a frozen-contract event into a row value for a given column header.
 * Template-driven: preserves column order and names.
 */
function valueForHeader(header, e) {
  const h = String(header || '').trim().toLowerCase();

  if (h === 'id') return stableId(e);

  if (h === 'title') {
    return `${e.source || 'External'} — ${e.location || 'Unknown'}`;
  }

  if (h === 'description' || h === 'desc') {
    const d = e.date
      ? `Imported event dated ${e.date}.`
      : 'Imported undated event.';
    return `${d} Source: ${e.source || 'unknown'}`;
  }

  if (h === 'date') {
    return normalizeDateForTimemap(e.date);
  }

  if (h === 'time') {
    return normalizeTimeForTimemap(e.time);
  }

  if (h === 'location' || h === 'place') return e.location || '';

  if (h === 'latitude' || h === 'lat') return e.latitude ?? '';
  if (h === 'longitude' || h === 'lon' || h === 'lng') return e.longitude ?? '';

  // Association / source reference columns intentionally left blank
  if (h.startsWith('association')) return '';
  if (h.startsWith('source')) return '';

  return '';
}

/**
 * Overwrite EXPORT_EVENTS with header + event rows.
 * Workbook and template structure preserved.
 */
function writeEventsToXlsx({ xlsxPath, sheetName = 'EXPORT_EVENTS', events }) {
  const wb = XLSX.readFile(xlsxPath);
  const ws = wb.Sheets[sheetName];

  if (!ws) {
    throw new Error(`Sheet "${sheetName}" not found in ${xlsxPath}`);
  }

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const headers = rows[0];

  if (!headers || !headers.length) {
    throw new Error(`Sheet "${sheetName}" has no header row`);
  }

  const out = [headers];

  for (const e of events) {
    out.push(headers.map(h => valueForHeader(h, e)));
  }

  wb.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(out);
  XLSX.writeFile(wb, xlsxPath);
}

module.exports = {
  writeEventsToXlsx
};
