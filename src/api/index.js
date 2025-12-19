const path = require('path');
const { version } = require('../../package.json');
const express = require('express');
const {
  fetchTechForPalestine,
  fetchTechForPalestineDaily,
  fetchACLED,
  fetchReliefWeb
} = require(path.resolve(__dirname, '../externalSources.js'));

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
      .catch(err => res.status(404).send({ error: err.message, err }));
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

  // === Datasheet resource routes ===
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

  // === Simplified error handling routes ===
  api.get('/:sheet', (req, res) => {
    res.status(400).send({ error: 'Invalid request: missing tab or resource.' });
  });

  api.get('/:sheet/:tab', (req, res) => {
    res.status(400).send({ error: 'Invalid request: missing resource fragment.' });
  });

  return api;
};
