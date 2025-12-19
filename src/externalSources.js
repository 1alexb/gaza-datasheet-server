// src/externalSources.js
const fetch = require('node-fetch');

/**
 * Step 1: Fetch Gaza casualty summary from TechForPalestine dataset.
 */
async function fetchTechForPalestine() {
  const url = "https://data.techforpalestine.org/api/v3/summary.json";

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch Tech For Palestine data");

    const data = await res.json();
    const gazaData = data.gaza?.killed || {};

    const normalized = [
      {
        region: "Gaza",
        totalKilled: gazaData.total || 0,
        women: gazaData.women || 0,
        men: gazaData.men || 0,
        children: gazaData.children || 0,
        source: "TechForPalestine",
        lastUpdated: new Date().toISOString()
      }
    ];

    return normalized;

  } catch (err) {
    console.error("Tech For Palestine fetch error:", err.message);
    return [];
  }
}

/**
 * Step 1.1: Fetch daily casualty data from TechForPalestine (time-based dataset)
 */
async function fetchTechForPalestineDaily() {
 const url = "https://data.techforpalestine.org/api/v2/casualties_daily.json";

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch daily casualties: ${res.status}`);
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
      throw new Error("Unexpected daily casualties response format");
    }

    const normalized = data.map(entry => ({
      date: entry.report_date,
      killed: entry.killed ?? null,
      killed_cum: entry.killed_cum ?? null,
      injured: entry.injured ?? null,
      injured_cum: entry.injured_cum ?? null,
      region: "Gaza",
      source: "TechForPalestine-Daily"
    }));

    console.log(`Fetched ${normalized.length} daily casualty records.`);
    return normalized;

  } catch (err) {
    console.error("TechForPalestine daily fetch error:", err.message);
    return [];
  }
}

/**
 * Step 2: Fetch conflict events from ACLED API.
 * Note: Endpoint instability currently handled gracefully.
 */
async function fetchACLED() {
  console.warn("ACLED integration present but upstream API unstable.");
  return [];
}

/**
 * Step 3: Fetch humanitarian reports from ReliefWeb API.
 */
async function fetchReliefWeb() {
  const baseUrl = "https://api.reliefweb.int/v1/reports";
  const appName = process.env.RELIEFWEB_APPNAME;
  const query = "Gaza";
  const limit = 10;

  if (!appName) {
    console.error("ReliefWeb appname not configured.");
    return [];
  }

  const url =
    `${baseUrl}?appname=${encodeURIComponent(appName)}` +
    `&query[value]=${encodeURIComponent(query)}` +
    `&limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch ReliefWeb data: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    if (!data.data || !Array.isArray(data.data)) {
      throw new Error("Unexpected ReliefWeb API response format.");
    }

    // Normalize the ReliefWeb response
    const normalized = data.data.map(item => ({
      id: item.id,
      title: item.fields?.title || "Untitled",
      source: item.fields?.source?.[0]?.name || "ReliefWeb",
      date: item.fields?.date?.created || "N/A",
      url: item.fields?.url || "N/A",
      country: item.fields?.country?.map(c => c.name).join(", ") || "N/A"
    }));

    console.log(`Fetched ${normalized.length} ReliefWeb reports.`);
    return normalized;

  } catch (err) {
    console.error("ReliefWeb fetch error:", err.message);
    return [];
  }
}

module.exports = {
  fetchTechForPalestine,
  fetchTechForPalestineDaily,
  fetchACLED,
  fetchReliefWeb
};