const path = require('path');
const { version } = require('../../package.json');
const express = require('express');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit'); // Security Feature

const {
  fetchTechForPalestine,
  fetchTechForPalestineDaily,
  fetchReliefWeb
} = require(path.resolve(__dirname, '../externalSources.js'));
const { writeEventsToXlsx } = require(path.resolve(__dirname, '../lib/externalXlsxWriter.js'));

module.exports = ({ config, controller }) => {
  const api = express.Router();

  // --- HELPER: Structured Logging ---
  const log = (msg, context = 'SYSTEM') => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${context}] ${msg}`);
  };

  const logError = (msg, context = 'ERROR') => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${context}] ${msg}`);
  };

  // --- MIDDLEWARE: Rate Limiting ---
  // Limits each IP to 100 requests every 15 minutes
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
  });
  api.use(limiter);

  // --- HELPER: The Core Sync Logic ---
  async function runSyncProcess(triggerSource = 'MANUAL') {
    log('Starting data synchronization...', triggerSource);
    
    // 1. Fetch
    const [tfpSummary, tfpDaily, reliefWeb] = await Promise.all([
      fetchTechForPalestine(),
      fetchTechForPalestineDaily(),
      fetchReliefWeb()
    ]);

    // 2. Aggregate
    let events = []
      .concat(tfpSummary || [])
      .concat(tfpDaily || [])
      .concat(reliefWeb || [])
      .map(item => item.event)
      .filter(Boolean);

    // 3. Sort
    events.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });

    // 4. Resolve Path
    const xlsxList = (config && config.xlsx) || (config && config.default && config.default.xlsx) || [];
    const xlsxCfg = xlsxList.find(x => x.name === 'gaza_timemap') || xlsxList[0];
    const fallbackRelPath = 'data/gaza_timemap.xlsx';
    const xlsxPath = xlsxCfg && xlsxCfg.path
      ? path.resolve(process.cwd(), xlsxCfg.path)
      : path.resolve(process.cwd(), fallbackRelPath);

    if (!xlsxPath) throw new Error('No XLSX path resolved');

    // 5. Write to DB
    writeEventsToXlsx({
      xlsxPath,
      sheetName: 'EXPORT_EVENTS',
      events
    });

    // 6. Refresh Memory
    await controller.update();
    
    log(`Sync Complete. Processed ${events.length} events.`, triggerSource);
    return events.length;
  }

  // --- AUTOMATION: Cron Job ---
  // Runs automatically every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    try {
      await runSyncProcess('AUTO-CRON');
    } catch (err) {
      logError(`Auto-Sync Failed: ${err.message}`, 'CRON-ERROR');
    }
  });

  // --- MIDDLEWARE: Admin Guard ---
  const requireAdmin = (req, res, next) => {
    const secret = req.query.secret;
    if (secret === 'admin2024') {
      next();
    } else {
      logError(`Unauthorized access attempt from ${req.ip}`, 'SECURITY');
      res.status(403).json({
        error: 'Forbidden: Admin access required.',
        message: 'This action is protected. Please provide the correct ?secret= key.'
      });
    }
  };

  // Base route
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

  // Analytics Dashboard
  api.get('/dashboard', (req, res) => {
    res.render('dashboard');
  });

  // Update route
  api.get('/update', requireAdmin, (req, res) => {
    controller.update()
      .then(msg => {
        log('Manual update triggered via /update', 'ADMIN');
        res.json({ success: msg });
      })
      .catch(err =>
        res.status(404).send({ error: err.message, err })
      );
  });

  // === Public Data Routes ===
  api.get('/external/techforpalestine', async (req, res) => {
    try { res.json(await fetchTechForPalestine()); } catch (err) { res.status(500).json({ error: err.message }); }
  });

  api.get('/external/techforpalestine-daily', async (req, res) => {
    try { res.json(await fetchTechForPalestineDaily()); } catch (err) { res.status(500).json({ error: err.message }); }
  });

  api.get('/external/reliefweb', async (req, res) => {
    try { res.json(await fetchReliefWeb()); } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // === Aggregated Events ===
  api.get('/external/events', async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      const { from, to, source } = req.query;
      const [tfpSummary, tfpDaily, reliefWeb] = await Promise.all([
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

      if (source) events = events.filter(e => e.source === source);
      if (from) events = events.filter(e => e.date && e.date >= from);
      if (to) events = events.filter(e => e.date && e.date <= to);

      events.sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return b.date.localeCompare(a.date);
      });

      res.json(events);
    } catch (err) {
      logError(err.message, 'API-EVENTS');
      res.status(500).json({ error: 'Failed', details: err.message });
    }
  });

  // === Analytics ===
  api.get('/external/analytics/events', async (req, res) => {
    try {
      const [tfpSummary, tfpDaily, reliefWeb] = await Promise.all([
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
        if (!e.date) { undated++; continue; }
        if (!earliest || e.date < earliest) earliest = e.date;
        if (!latest || e.date > latest) latest = e.date;
      }

      res.json({
        totalEvents: events.length,
        bySource,
        dateRange: { earliest, latest },
        undatedEvents: undated
      });
    } catch (err) {
      res.status(500).json({ error: 'Analytics Failed', details: err.message });
    }
  });

  // === Sync Pipeline (PROTECTED) ===
  api.get('/external/sync-xlsx', requireAdmin, async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store');
      
      const count = await runSyncProcess('MANUAL-ADMIN');

      res.json({
        success: true,
        wroteEvents: count,
        message: "Manual sync successful"
      });
    } catch (err) {
      logError(err.message, 'SYNC-FAIL');
      res.status(500).json({ error: 'Sync Failed', details: err.message });
    }
  });

  // Health Check
  api.get('/external/health', async (req, res) => {
    const status = { techforpalestine: 'unknown', techforpalestine_daily: 'unknown', reliefweb: 'unknown' };
    try { if ((await fetchTechForPalestine()).length) status.techforpalestine = 'ok'; } catch (_) {}
    try { if ((await fetchTechForPalestineDaily()).length) status.techforpalestine_daily = 'ok'; } catch (_) {}
    try { if ((await fetchReliefWeb()).length) status.reliefweb = 'ok'; } catch (_) {}
    res.json(status);
  });

  // Datasheet Resources
  api.get('/:sheet/:tab/:resource/:frag', (req, res) => {
    const { sheet, tab, resource, frag } = req.params;
    controller.retrieveFrag(sheet, tab, resource, frag)
      .then(data => res.json(data))
      .catch(err => res.status(err.status || 404).send({ error: err.message }));
  });

  api.get('/:sheet/:tab/:resource', (req, res) => {
    const { sheet, tab, resource } = req.params;
    controller.retrieve(sheet, tab, resource)
      .then(data => res.json(data))
      .catch(err => res.status(err.status || 404).send({ error: err.message }));
  });

  // Errors
  api.get('/:sheet', (req, res) => {
    res.status(400).send({ error: 'Invalid request: missing tab or resource.' });
  });

  api.get('/:sheet/:tab', (req, res) => {
    res.status(400).send({ error: 'Invalid request: missing resource fragment.' });
  });

  return api;
};