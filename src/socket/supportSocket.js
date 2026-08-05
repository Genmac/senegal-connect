const jwt = require('jsonwebtoken');
const db = require('../config/db');

const initialiserSocketSupport = (io) => {
  // Middleware d'authentification Socket.IO avec le Token JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
      || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentification WebSocket échouée : Token manquant'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // { id, nom, email, role }
      next();
    } catch (err) {
      next(new Error('Authentification WebSocket échouée : Token invalide'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Utilisateur connecté : ${socket.user.email} (ID: ${socket.user.id})`);

    // 1. Rejoindre la room d'un ticket spécifique
    socket.on('join_room', ({ ticket_id }) => {
      const room = `ticket_${ticket_id}`;
      socket.join(room);
      console.log(`[Socket] ${socket.user.email} a rejoint la room ${room}`);
    });

    // 2. Émission et enregistrement d'un message
    socket.on('send_message', async ({ ticket_id, contenu }) => {
      try {
        if (!contenu || contenu.trim() === '') return;

        const result = await db.query(
          `INSERT INTO messages (ticket_id, expediteur_id, type, contenu)
           VALUES ($1, $2, 'texte', $3)
           RETURNING id, ticket_id, expediteur_id, type, contenu, envoye_le`,
          [ticket_id, socket.user.id, contenu]
        );

        const nouveauMessage = {
          ...result.rows[0],
          expediteur: {
            id: socket.user.id,
            nom: socket.user.nom,
            email: socket.user.email,
            role: socket.user.role
          }
        };

        // Diffusion à tous les membres de la room (client + agent)
        io.to(`ticket_${ticket_id}`).emit('receive_message', nouveauMessage);
      } catch (err) {
        console.error('[Socket Error] Échec de l\'envoi du message:', err.message);
        socket.emit('error_message', { message: 'Impossible d\'envoyer le message.' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Déconnexion de l'utilisateur ${socket.user.email}`);
    });
  });
};

module.exports = initialiserSocketSupport;
