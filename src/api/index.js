const path = require('path');
const { version } = require('../../package.json');
const express = require('express');
const copy = require('../copy/en');
const { fetchTechForPalestine } = require(path.resolve(__dirname, '../externalSources.js'));

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

  // External data integration route
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

  // Datasheet resource routes
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

  // Error routes (keep these last)
  api.get('/:sheet', (req, res) => {
    res.status(400).send({ error: copy.errors.onlysheet });
  });

  api.get('/:sheet/:tab', (req, res) => {
    res.status(400).send({ error: copy.errors.onlyTab });
  });

  return api;
};
