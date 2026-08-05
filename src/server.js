const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const forfaitRoutes = require('./routes/forfaits');
const factureRoutes = require('./routes/factures');
const statsRoutes = require('./routes/stats');
const ticketRoutes = require('./routes/tickets');
const { gestionnaireErreurs } = require('./middleware/erreurs'); // ✅ destructuration
const initialiserSocketSupport = require('./socket/supportSocket');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGINS || '*',
    methods: ['GET', 'POST']
  }
});

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/forfaits', forfaitRoutes);
app.use('/api/factures', factureRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/tickets', ticketRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'Sénégal Connect API' });
});

// Handler 404 - route inconnue (doit venir APRÈS toutes les routes)
app.use((req, res) => {
  res.status(404).json({ erreur: 'Route non trouvée' });
});

// Middleware global de gestion des erreurs (doit être en dernier)
app.use(gestionnaireErreurs);

initialiserSocketSupport(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur Senegal Connect démarré sur http://localhost:${PORT}`);
});

module.exports = server;
