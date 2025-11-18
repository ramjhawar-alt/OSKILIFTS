const express = require('express');
const cors = require('cors');
const {
  fetchWeightRoomStatus,
  fetchGroupFitnessSchedule,
  getPacificISODate,
} = require('./rsfService');
require('dotenv').config();

const PORT = process.env.PORT || 4000;
const app = express();

app.use(cors());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/api/weightroom', async (_req, res) => {
  try {
    const data = await fetchWeightRoomStatus();
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({
      error: 'Failed to fetch weight room data',
      details: error.message,
    });
  }
});

app.get('/api/classes', async (req, res) => {
  try {
    const startDate = req.query.startDate || getPacificISODate();
    const data = await fetchGroupFitnessSchedule(startDate);
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({
      error: 'Failed to fetch class schedule',
      details: error.message,
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`OSKILIFTS API listening on http://0.0.0.0:${PORT}`);
});

