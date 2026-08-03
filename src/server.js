// src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Routes API
app.use('/api/auth', authRoutes);

// Healthcheck (Module M1)
app.get('/api/health', (req, res) => {
  res.json({
    statut: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    env: process.env.NODE_ENV,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur Sénégal Connect démarré sur http://localhost:${PORT}`);
});
