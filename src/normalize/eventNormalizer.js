/**
 * Normalize external data records into a minimal Timemap compatible event.
 * This is intentionally minimal and source agnostic.
 */
function normalizeEvent({ date, location, latitude, longitude, source }) {
  return {
    date: date || null,
    location: location || "Unknown",
    latitude: latitude || null,
    longitude: longitude || null,
    source
  };
}

module.exports = { normalizeEvent };