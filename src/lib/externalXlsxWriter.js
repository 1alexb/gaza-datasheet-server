// src/lib/externalXlsxWriter.js
const XLSX = require('xlsx');
const crypto = require('crypto');
const { GAZA_CENTROID } = require('./geoDefaults');

/**
 * Build a stable ID from event fields.
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
 * DATE_FMT = MM/DD/YYYY
 * TIME_FMT = hh:mm   (12-hour, no AM/PM)
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
  return '12:00';
}

/**
 * Map a frozen contract event into a row value for a given column header.
 * Template driven: preserves column order and names.
 */
function valueForHeader(header, e) {
  const h = String(header || '').trim().toLowerCase();

  if (h === 'id') return stableId(e);

  if (h === 'title') {
    return e.title || `${e.source || 'External'} — ${e.location || 'Unknown'}`;
  }

  // ENRICHED DESCRIPTION: Adds URL if available
  if (h === 'description' || h === 'desc') {
    let d = e.description || (e.date ? `Imported event dated ${e.date}.` : 'Imported undated event.');
    if (e.url) {
      d += `\n\nSource Link: ${e.url}`;
    }
    return d;
  }

  if (h === 'date') return normalizeDateForTimemap(e.date);
  if (h === 'time') return normalizeTimeForTimemap(e.time);
  if (h === 'location' || h === 'place') return e.location || '';
  if (h === 'latitude' || h === 'lat') return e.latitude ?? GAZA_CENTROID.latitude;
  if (h === 'longitude' || h === 'lon' || h === 'lng') return e.longitude ?? GAZA_CENTROID.longitude;

  // This maps the source to the Association IDs defined in seed_categories.js
  if (h === 'association1') {
    const src = (e.source || '').toLowerCase();
    if (src.includes('techforpalestine')) return 'casualties';
    if (src.includes('reliefweb')) return 'humanitarian';
    return ''; // Default/None
  }

  if (h === 'source1') return e.source || '';

  return '';
}

/**
 * Overwrite EXPORT_EVENTS with header + event rows.
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
  
  console.log(`[XLSX Writer] Wrote ${events.length} rows to ${sheetName}`);
}

module.exports = {
  writeEventsToXlsx
};