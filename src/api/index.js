const path = require('path');
const { version } = require('../../package.json');
const express = require('express');
const {
  fetchTechForPalestine,
  fetchTechForPalestineDaily,
  fetchACLED,
  fetchReliefWeb
} = require(path.resolve(__dirname, '../externalSources.js'));
const { writeEventsToXlsx } = require(path.resolve(__dirname, '../lib/externalXlsxWriter.js'));

module.exports = ({ config, controller }) => {
  const api = express.Router();

  // Base route - version info
  api.get('/', (req, res) => {
    res.json({ version });
  });

  // Blueprint view route
  api.get('/blueprints', (req, res) => {
    const bps = controller.blueprints();
    res.render('blueprints', {
      bps: bps.map(bp => ({
        source: bp.sheet.name,
        tab: bp.name,
        urls: bp.urls
      }))
    });
  });

  // Update route for Google Sheets or XLSX data
  api.get('/update', (req, res) => {
    controller.update()
      .then(msg => res.json({ success: msg }))
      .catch(err =>
        res.status(404).send({ error: err.message, err })
      );
  });

  // === External Data Integration Routes ===

  // Tech for Palestine (summary)
  api.get('/external/techforpalestine', async (req, res) => {
    try {
      const data = await fetchTechForPalestine();
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error: 'Failed to fetch Tech For Palestine data',
        details: err.message
      });
    }
  });

  // Tech for Palestine (daily casualties)
  api.get('/external/techforpalestine-daily', async (req, res) => {
    try {
      const data = await fetchTechForPalestineDaily();
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error: 'Failed to fetch Tech For Palestine daily data',
        details: err.message
      });
    }
  });

  // ACLED data
  api.get('/external/acled', async (req, res) => {
    try {
      const data = await fetchACLED();
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error: 'Failed to fetch ACLED data',
        details: err.message
      });
    }
  });

  // ReliefWeb data
  api.get('/external/reliefweb', async (req, res) => {
    try {
      const data = await fetchReliefWeb();
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error: 'Failed to fetch ReliefWeb data',
        details: err.message
      });
    }
  });

  // === Aggregated external events (Timemap-ready) ===
  // CONTRACT: This endpoint exposes a stable, normalized event schema.
  // Downstream consumers (Timemap, UI, analysis) must rely ONLY on this shape.
  // Source-specific fields must NOT be added here.

  api.get('/external/events', async (req, res) => {
    try {
      // Explicitly disable caching to preserve contract determinism
      res.set('Cache-Control', 'no-store');

      const { from, to, source } = req.query;

      const [
        tfpSummary,
        tfpDaily,
        reliefWeb
      ] = await Promise.all([
        fetchTechForPalestine(),
        fetchTechForPalestineDaily(),
        fetchReliefWeb()
      ]);

      // Extract Timemap-aligned event objects only
      let events = []
        .concat(tfpSummary || [])
        .concat(tfpDaily || [])
        .concat(reliefWeb || [])
        .map(item => item.event)
        .filter(Boolean);

      // Optional source filter
      if (source) {
        events = events.filter(e => e.source === source);
      }

      // Optional date range filtering
      if (from) {
        events = events.filter(e => e.date && e.date >= from);
      }

      if (to) {
        events = events.filter(e => e.date && e.date <= to);
      }

      // Deterministic ordering: newest dated events first, undated last
      events.sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
      });

      res.json(events);

    } catch (err) {
      res.status(500).json({
        error: 'Failed to aggregate external events',
        details: err.message
      });
    }
  });

  // === Derived analytics over frozen external events contract ===
  // No source-specific logic allowed here.

  api.get('/external/analytics/events', async (req, res) => {
    try {
      const [
        tfpSummary,
        tfpDaily,
        reliefWeb
      ] = await Promise.all([
        fetchTechForPalestine(),
        fetchTechForPalestineDaily(),
        fetchReliefWeb()
      ]);

      const events = []
        .concat(tfpSummary || [])
        .concat(tfpDaily || [])
        .concat(reliefWeb || [])
        .map(item => item.event)
        .filter(Boolean);

      const bySource = {};
      let earliest = null;
      let latest = null;
      let undated = 0;

      for (const e of events) {
        bySource[e.source] = (bySource[e.source] || 0) + 1;

        if (!e.date) {
          undated++;
          continue;
        }

        if (!earliest || e.date < earliest) earliest = e.date;
        if (!latest || e.date > latest) latest = e.date;
      }

      res.json({
        totalEvents: events.length,
        bySource,
        dateRange: {
          earliest,
          latest
        },
        undatedEvents: undated
      });

    } catch (err) {
      res.status(500).json({
        error: 'Failed to compute event analytics',
        details: err.message
      });
    }
  });

  // === Sync frozen external events into the Timemap XLSX export tab ===
  //
  // 1) fetch frozen /external/events contract (event objects only)
  // 2) write into data/gaza_timemap.xlsx -> export_events (template-driven)
  // 3) run controller.update() so datasheet-server serves the new rows immediately

  api.get('/external/sync-xlsx', async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store');

      // Use same query semantics as /external/events for reproducible subsets
      const { from, to, source } = req.query;

      const [
        tfpSummary,
        tfpDaily,
        reliefWeb
      ] = await Promise.all([
        fetchTechForPalestine(),
        fetchTechForPalestineDaily(),
        fetchReliefWeb()
      ]);

      let events = []
        .concat(tfpSummary || [])
        .concat(tfpDaily || [])
        .concat(reliefWeb || [])
        .map(item => item.event)
        .filter(Boolean);

      if (source) {
        events = events.filter(e => e.source === source);
      }

      if (from) {
        events = events.filter(e => e.date && e.date >= from);
      }

      if (to) {
        events = events.filter(e => e.date && e.date <= to);
      }

      // Deterministic ordering (same logic as /external/events)
      events.sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
      });

      // Resolve XLSX path from config (prefer gaza_timemap)
      const xlsxList =
        (config && config.xlsx) ||
        (config && config.default && config.default.xlsx) ||
        [];

      const xlsxCfg =
        xlsxList.find(x => x.name === 'gaza_timemap') ||
        xlsxList[0];

      // Hard fallback (keeps dev unblocked even if config is not injected)
      const fallbackRelPath = 'data/gaza_timemap.xlsx';

      const xlsxPath = xlsxCfg && xlsxCfg.path
        ? path.resolve(process.cwd(), xlsxCfg.path)
        : path.resolve(process.cwd(), fallbackRelPath);

      if (!xlsxPath) {
        return res.status(500).json({
          error: 'No XLSX path could be resolved'
        });
      }

      // Write events into export_events tab
      writeEventsToXlsx({
        xlsxPath,
        sheetName: 'EXPORT_EVENTS',
        events
      });

      // Reload datasheet-server in-memory state from XLSX
      await controller.update();

      res.json({
        success: true,
        wroteEvents: events.length,
        xlsx: (xlsxCfg && xlsxCfg.name) || 'gaza_timemap',
        path: (xlsxCfg && xlsxCfg.path) || fallbackRelPath
      });

    } catch (err) {
      res.status(500).json({
        error: 'Failed to sync external events into XLSX',
        details: err.message
      });
    }
  });

  // === External data availability & degradation monitoring ===
  // Used to demonstrate resilience and partial failure handling.

  api.get('/external/health', async (req, res) => {
    const status = {
      techforpalestine: 'unknown',
      techforpalestine_daily: 'unknown',
      reliefweb: 'unknown',
      acled: 'degraded'
    };

    try {
      if ((await fetchTechForPalestine()).length) {
        status.techforpalestine = 'ok';
      }
    } catch (_) {}

    try {
      if ((await fetchTechForPalestineDaily()).length) {
        status.techforpalestine_daily = 'ok';
      }
    } catch (_) {}

    try {
      if ((await fetchReliefWeb()).length) {
        status.reliefweb = 'ok';
      }
    } catch (_) {}

    res.json(status);
  });

  // === Datasheet resource routes ===

  api.get('/:sheet/:tab/:resource/:frag', (req, res) => {
    const { sheet, tab, resource, frag } = req.params;
    controller.retrieveFrag(sheet, tab, resource, frag)
      .then(data => res.json(data))
      .catch(err =>
        res.status(err.status || 404).send({ error: err.message })
      );
  });

  api.get('/:sheet/:tab/:resource', (req, res) => {
    const { sheet, tab, resource } = req.params;
    controller.retrieve(sheet, tab, resource)
      .then(data => res.json(data))
      .catch(err =>
        res.status(err.status || 404).send({ error: err.message })
      );
  });

  // === Simplified error handling routes ===

  api.get('/:sheet', (req, res) => {
    res.status(400).send({
      error: 'Invalid request: missing tab or resource.'
    });
  });

  api.get('/:sheet/:tab', (req, res) => {
    res.status(400).send({
      error: 'Invalid request: missing resource fragment.'
    });
  });

  return api;
};
