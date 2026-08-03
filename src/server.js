// src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const forfaitRoutes = require('./routes/forfaits');
const factureRoutes = require('./routes/factures');
const statsRoutes = require('./routes/stats');
const { gestionnaireErreurs } = require('./middleware/erreurs');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/forfaits', forfaitRoutes);
app.use('/api/factures', factureRoutes);
app.use('/api/stats', statsRoutes);

// Healthcheck (Module M1)
app.get('/api/health', (req, res) => {
  res.json({
    statut: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    env: process.env.NODE_ENV,
  });
});

// Middleware Global de Gestion des Erreurs (doit être en dernier)
app.use(gestionnaireErreurs);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Serveur Sénégal Connect démarré sur http://localhost:${PORT}`);
});
