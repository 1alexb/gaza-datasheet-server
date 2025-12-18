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

    // Extract Gaza data
    const gazaData = data.gaza?.killed || {};
    const totalKilled = gazaData.total || 0;
    const women = gazaData.women || 0;
    const men = gazaData.men || 0;
    const children = gazaData.children || 0;

    // Normalize to a consistent structure
    return [
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
  } catch (err) {
    console.error("Tech For Palestine fetch error:", err.message);
    return [];
  }
}

/**
 * Step 1: Authenticate with ACLED API and get a temporary Bearer token.
 */
async function getAcledToken() {
  const email = process.env.ACLED_EMAIL;
  const password = process.env.ACLED_PASSWORD;
  const loginUrl = "https://developer.acleddata.com/api/login/";

  try {
    const response = await fetch(loginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error(`Login failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || !data.access) {
      throw new Error("No token found in ACLED login response.");
    }

    console.log("ACLED authentication successful.");
    return data.access;

  } catch (error) {
    console.error("ACLED login error:", error.message);
    throw error;
  }
}

/**
 * Step 2: Fetch conflict data from ACLED using the obtained token.
 */
async function fetchACLED() {
  const baseUrl = "https://developer.acleddata.com/api/acled/read/";
  let token;

  try {
    token = await getAcledToken();
  } catch (err) {
    console.error("ACLED token retrieval failed.");
    return [];
  }

  try {
    const response = await fetch(`${baseUrl}?country=Palestine&limit=25`, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`ACLED API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.results || !Array.isArray(data.results)) {
      throw new Error("Unexpected ACLED response format.");
    }

    // Normalize structure
    const normalized = data.results.map(event => ({
      date: event.event_date || "N/A",
      location: event.location || "Unknown",
      event_type: event.event_type || "Unspecified",
      fatalities: parseInt(event.fatalities || 0),
      source: "ACLED",
    }));

    console.log(`Fetched ${normalized.length} ACLED events.`);
    return normalized;

  } catch (error) {
    console.error("ACLED fetch error:", error.message);
    return [];
  }
}

/**
 * Step 3: Fetch humanitarian reports from ReliefWeb API.
 */
async function fetchReliefWeb() {
  const baseUrl = "https://api.reliefweb.int/v2/reports";
  const appName = "gaza-timemap-nci-x23177055"; // Your unique app identifier
  const query = "Gaza"; // Search keyword
  const limit = 10; // Limit results for efficiency

  const url = `${baseUrl}?appname=${appName}&query[value]=${encodeURIComponent(query)}&limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json" }
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
      source: item.fields?.source?.[0]?.name || "Unknown",
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

module.exports = { fetchTechForPalestine, fetchACLED, fetchReliefWeb };