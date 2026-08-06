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
      socket.user = decoded; // { id, nom, prenom, email, role }
      next();
    } catch (err) {
      next(new Error('Authentification WebSocket échouée : Token invalide'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Utilisateur connecté : ${socket.user.email} (ID: ${socket.user.id})`);

    // Jointure automatique des rooms personnelles (nécessaire pour M4 : appel:entrant, etc.)
    socket.join(`user_${socket.user.id}`);
    if (socket.user.role === 'agent') {
      socket.join('agents');
      console.log(`[Socket] ${socket.user.email} a rejoint la room agents`);
    }

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

    // 3. Indicateur de frappe — relayé en direct, jamais persisté en BDD
    socket.on('frappe', ({ ticket_id }) => {
      socket.to(`ticket_${ticket_id}`).emit('frappe', {
        utilisateur_id: socket.user.id,
        nom: socket.user.nom
      });
    });

    // 4. Un agent s'assigne un ticket -> passe en_cours (prérequis obligatoire pour démarrer un appel M4)
    socket.on('ticket:assigner', async ({ ticket_id }) => {
      try {
        if (socket.user.role !== 'agent') {
          return socket.emit('error_message', { message: 'Seul un agent peut s\'assigner un ticket' });
        }

        const result = await db.query(
          `UPDATE tickets
           SET agent_id = $1, statut = 'en_cours'
           WHERE id = $2 AND statut = 'ouvert'
           RETURNING id, client_id, agent_id, statut`,
          [socket.user.id, ticket_id]
        );

        if (result.rows.length === 0) {
          return socket.emit('error_message', { message: 'Ticket introuvable ou déjà assigné' });
        }

        const ticket = result.rows[0];
        socket.join(`ticket_${ticket_id}`);

        // Retrouver l'utilisateur_id du client pour le notifier personnellement
        const clientResult = await db.query(
          `SELECT utilisateur_id FROM clients WHERE id = $1`,
          [ticket.client_id]
        );
        const clientUtilisateurId = clientResult.rows[0]?.utilisateur_id;

        if (clientUtilisateurId) {
          io.to(`user_${clientUtilisateurId}`).emit('ticket:pris_en_charge', {
            ticket_id,
            agent: { id: socket.user.id, nom: socket.user.nom }
          });
        }

        socket.emit('ticket:assigne_ok', ticket);
        console.log(`[Socket] Ticket ${ticket_id} assigné à ${socket.user.email}, statut=en_cours`);
      } catch (err) {
        console.error('[ticket:assigner] erreur :', err.message);
        socket.emit('error_message', { message: 'Erreur lors de l\'assignation du ticket' });
      }
    });

    // 5. Fermeture du ticket par l'agent
    socket.on('ticket:fermer', async ({ ticket_id }) => {
      try {
        if (socket.user.role !== 'agent') {
          return socket.emit('error_message', { message: 'Seul un agent peut fermer un ticket' });
        }

        const result = await db.query(
          `UPDATE tickets SET statut = 'ferme', ferme_le = NOW() WHERE id = $1 RETURNING client_id`,
          [ticket_id]
        );

        if (result.rows.length === 0) {
          return socket.emit('error_message', { message: 'Ticket introuvable' });
        }

        const clientResult = await db.query(
          `SELECT utilisateur_id FROM clients WHERE id = $1`,
          [result.rows[0].client_id]
        );
        const clientUtilisateurId = clientResult.rows[0]?.utilisateur_id;

        if (clientUtilisateurId) {
          io.to(`user_${clientUtilisateurId}`).emit('ticket:ferme', { ticket_id });
        }
        io.to(`ticket_${ticket_id}`).emit('ticket:ferme', { ticket_id });

        console.log(`[Socket] Ticket ${ticket_id} fermé par ${socket.user.email}`);
      } catch (err) {
        console.error('[ticket:fermer] erreur :', err.message);
        socket.emit('error_message', { message: 'Erreur lors de la fermeture du ticket' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Déconnexion de l'utilisateur ${socket.user.email}`);
    });
  });
};

module.exports = initialiserSocketSupport;
