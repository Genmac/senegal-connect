require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const { ExpressPeerServer } = require('peer');
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const forfaitRoutes = require('./routes/forfaits');
const factureRoutes = require('./routes/factures');
const statsRoutes = require('./routes/stats');
const ticketRoutes = require('./routes/tickets');
const { gestionnaireErreurs } = require('./middleware/erreurs');
const initialiserSocketSupport = require('./socket/supportSocket');
const initialiserSocketAppels = require('./socket/appels');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGINS || '*',
    methods: ['GET', 'POST']
  }
});

app.set('io', io);

const peerServer = ExpressPeerServer(server, { debug: true });
app.use('/peerjs', peerServer);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/forfaits', forfaitRoutes);
app.use('/api/factures', factureRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/tickets', ticketRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    statut: 'ok',
    service: 'Sénégal Connect API',
    version: '1.0.0',
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development',
  });
});

app.use((req, res, next) => {
  const erreur = new Error('Route non trouvée');
  erreur.status = 404;
  next(erreur);
});

app.use(gestionnaireErreurs);

initialiserSocketSupport(io);
initialiserSocketAppels(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur Sénégal Connect démarré sur http://localhost:${PORT}`);
});

module.exports = server;
