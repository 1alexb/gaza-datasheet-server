// src/externalSources.js
const fetch = require("node-fetch");

/*
 * CONTRACT NOTICE:
 * All external sources must normalize their data into a Timemap compatible
 * `event` object.
 */

/**
 * Shared helper: build a Timemap-aligned event object with consistent keys.
 */
function buildTimemapEvent({ date, time, location, latitude, longitude, source }) {
  return {
    date: date || null,
    time: time ?? "12:00", // Default time is safer than null for validation
    location: location || "Unknown Location",
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    source: source || "Unknown Source"
  };
}

/**
 * Step 1: Fetch Gaza casualty summary.
 * REMOVED: Spatial Jitter. All summary points will stack on the exact centroid.
 */
async function fetchTechForPalestine() {
  const url = "https://data.techforpalestine.org/api/v3/summary.json";
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch TechForPalestine data");

    const data = await res.json();
    const gazaData = data.gaza?.killed || {};
    const today = new Date().toISOString().slice(0, 10);
    
    // Strict Base coordinates (Central Gaza)
    const baseLat = 31.4; 
    const baseLng = 34.38;

    const events = [];

    // Helper to push safe events
    const pushEvent = (title, desc) => {
      events.push({
        source: "TechForPalestine",
        event: {
          ...buildTimemapEvent({
            date: today,
            location: "Gaza Strip",
            latitude: baseLat,
            longitude: baseLng,
            source: "TechForPalestine"
          }),
          event_type: "casualty_summary",
          title: title,
          description: desc
        }
      });
    };

    if (gazaData.total) pushEvent(`Total Killed: ${gazaData.total}`, `Total officially recorded deaths: ${gazaData.total}`);
    if (gazaData.children) pushEvent(`Children Killed: ${gazaData.children}`, `Number of children killed: ${gazaData.children}`);
    if (gazaData.women) pushEvent(`Women Killed: ${gazaData.women}`, `Number of women killed: ${gazaData.women}`);

    return events; // Returns Array of { source, event }
  } catch (err) {
    console.error("TechForPalestine fetch error:", err.message);
    return [];
  }
}

/**
 * Step 1.1: Fetch daily casualty data.
 */
async function fetchTechForPalestineDaily() {
  const url = "https://data.techforpalestine.org/api/v2/casualties_daily.json";
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed daily casualties fetch: ${res.status}`);

    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Unexpected response format");

    // SLICE: Last 45 days only
    const recentData = data.slice(-45);

    return recentData.map(entry => {
        // Validation check inside map
        if (!entry.report_date) return null;

        return {
          source: "TechForPalestine-Daily",
          event: {
            ...buildTimemapEvent({
              date: entry.report_date,
              location: "Gaza",
              source: "TechForPalestine-Daily",
              latitude: 31.5, // Generic center
              longitude: 34.466
            }),
            event_type: "daily_casualty",
            casualties: {
              killed: entry.killed ?? 0,
              injured: entry.injured ?? 0
            },
            title: `Daily Casualties: ${entry.killed} Killed`
          }
        };
    }).filter(Boolean); // Filter out any nulls
  } catch (err) {
    console.error("TechForPalestine daily fetch error:", err.message);
    return [];
  }
}

/**
 * Step 3: Fetch humanitarian reports from ReliefWeb.
 */
async function fetchReliefWeb() {
  const appname = "NCI-academia-Z4HHCq13Eb";
  const baseUrl = "https://api.reliefweb.int/v2/reports";

  const params = new URLSearchParams();
  params.append('appname', appname);
  params.append('limit', '25');
  params.append('preset', 'latest');
  params.append('filter[field]', 'country.iso3');
  params.append('filter[value]', 'PSE');
  params.append('fields[include][]', 'date');
  params.append('fields[include][]', 'url');
  params.append('fields[include][]', 'title');
  params.append('fields[include][]', 'source');

  const url = `${baseUrl}?${params.toString()}`;

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`ReliefWeb request failed: ${res.status}`);
    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) return [];

    return data.data.map(item => {
        const fields = item.fields || {};
        const createdRaw = fields.date?.created || fields.date?.original;

        if (!createdRaw) return null;

        const dateObj = new Date(createdRaw);
        if (isNaN(dateObj.getTime())) return null; // Safety check
        const dateStr = dateObj.toISOString().slice(0, 10);

        return {
          source: "ReliefWeb",
          event: {
            ...buildTimemapEvent({ 
              date: dateStr, 
              time: "12:00",
              location: "Gaza / Palestine",
              source: "ReliefWeb",
              latitude: 31.5,
              longitude: 34.466
            }),
            event_type: "humanitarian_report",
            title: fields.title || "Untitled Report",
            url: fields.url || item.href
          }
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.error("ReliefWeb fetch error:", err.message);
    return [];
  }
}

module.exports = {
  fetchTechForPalestine,
  fetchTechForPalestineDaily,
  fetchReliefWeb
};