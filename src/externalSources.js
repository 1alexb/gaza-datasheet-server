// src/externalSources.js
const fetch = require('node-fetch');

/**
 * Fetch Gaza and West Bank data from TechForPalestine dataset
 */
async function fetchTechForPalestine() {
  const url = "https://data.techforpalestine.org/api/v3/summary.json";

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch Tech For Palestine data");
    const data = await res.json();

    // Extract Gaza data (you can expand to include West Bank later)
    const gazaData = data.gaza?.killed || {};
    const totalKilled = gazaData.total || 0;
    const women = gazaData.women || 0;
    const men = gazaData.men || 0;
    const children = gazaData.children || 0;

    // Normalize to a consistent structure
    const normalized = [
      {
        region: "Gaza",
        totalKilled,
        women,
        men,
        children,
        source: "TechForPalestine",
        lastUpdated: new Date().toISOString(),
      },
    ];

    return normalized;
  } catch (err) {
    console.error("Tech For Palestine fetch error:", err.message);
    return [];
  }
}

module.exports = { fetchTechForPalestine };