require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const forfaitRoutes = require('./routes/forfaits');
const factureRoutes = require('./routes/factures');
const statsRoutes = require('./routes/stats');
const ticketRoutes = require('./routes/tickets');
const { gestionnaireErreurs } = require('./middleware/erreurs');
const initialiserSocketSupport = require('./socket/supportSocket');

const app = express();
const server = http.createServer(app);

// Configuration Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGINS || '*',
    methods: ['GET', 'POST']
  }
});

// Rendre l'instance io accessible aux contrôleurs REST via req.app.get('io')
app.set('io', io);

// Middlewares globaux
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/forfaits', forfaitRoutes);
app.use('/api/factures', factureRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/tickets', ticketRoutes);

// Healthcheck complet (Version combinée)
app.get('/api/health', (req, res) => {
  res.json({
    statut: 'ok',
    service: 'Sénégal Connect API',
    version: '1.0.0',
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development',
  });
});

// ATTENTION : Le gestionnaire d'erreurs doit intercepter TOUT, le 404 se gère juste avant en passant l'erreur à next()
app.use((req, res, next) => {
  const erreur = new Error('Route non trouvée');
  erreur.status = 404;
  next(erreur); // Envoie l'erreur 404 vers le gestionnaire d'erreurs global
});

// Middleware Global de Gestion des Erreurs (doit TOUJOURS être le dernier)
app.use(gestionnaireErreurs);

// Initialisation des serveurs de communication
initialiserSocketSupport(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur Sénégal Connect démarré sur http://localhost:${PORT}`);
});

module.exports = server; // Gardé pour les tests Jest
