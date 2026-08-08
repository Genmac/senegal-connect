const db = require('../config/db');

const initialiserSocketAppels = (io) => {
  io.on('connection', (socket) => {

    // Étape 1 (PDF) : un utilisateur initie un appel
    socket.on('appel:initier', async ({ ticketId, type, peerId }) => {
      try {
        const ticketResult = await db.query(
          `SELECT statut, client_id, agent_id FROM tickets WHERE id = $1`,
          [ticketId]
        );

        if (ticketResult.rows.length === 0) {
          return socket.emit('appel:erreur', { message: 'Ticket introuvable' });
        }

        const ticket = ticketResult.rows[0];

        // Règle métier obligatoire : appel possible uniquement si ticket en_cours
        if (ticket.statut !== 'en_cours') {
          return socket.emit('appel:erreur', {
            message: 'Impossible de démarrer un appel : le ticket n\'est pas en cours de traitement'
          });
        }

        const initiateur = socket.user;
        let destinataireId;

        if (initiateur.role === 'client') {
          destinataireId = ticket.agent_id;
        } else {
          // L'agent connaît client_id (table clients), il faut son utilisateur_id
          const clientResult = await db.query(
            `SELECT utilisateur_id FROM clients WHERE id = $1`,
            [ticket.client_id]
          );
          destinataireId = clientResult.rows[0]?.utilisateur_id;
        }

        if (!destinataireId) {
          return socket.emit('appel:erreur', { message: 'Destinataire introuvable' });
        }

        // INSERT en BDD (étape 2 du PDF)
        const appelResult = await db.query(
          `INSERT INTO appels (ticket_id, initiateur_id, destinataire_id, type, statut)
           VALUES ($1, $2, $3, $4, 'initie')
           RETURNING id`,
          [ticketId, initiateur.id, destinataireId, type]
        );

        const appelId = appelResult.rows[0].id;

        // Notifier le destinataire via sa room privée (étape 2 du PDF)
        io.to(`user_${destinataireId}`).emit('appel:entrant', {
          appelId,
          ticketId,
          type,
          peerId,
          initiateur: { id: initiateur.id, nom: initiateur.nom }
        });

        socket.emit('appel:initie_ok', { appelId });
      } catch (err) {
        console.error('[appel:initier] erreur :', err.message);
        socket.emit('appel:erreur', { message: 'Erreur lors de l\'initiation de l\'appel' });
      }
    });

    // Étape 3 (PDF) : le destinataire accepte l'appel
    socket.on('appel:accepter', async ({ appelId, peerId }) => {
      try {
        const result = await db.query(
          `UPDATE appels SET statut = 'accepte' WHERE id = $1 RETURNING initiateur_id`,
          [appelId]
        );

        if (result.rows.length === 0) {
          return socket.emit('appel:erreur', { message: 'Appel introuvable' });
        }

        const initiateurId = result.rows[0].initiateur_id;

        // Étape 4 (PDF) : notifier l'initiateur avec le peerId du destinataire
        io.to(`user_${initiateurId}`).emit('appel:accepte', { appelId, peerId });
      } catch (err) {
        console.error('[appel:accepter] erreur :', err.message);
        socket.emit('appel:erreur', { message: 'Erreur lors de l\'acceptation' });
      }
    });

    // L'appel est refusé
    socket.on('appel:refuser', async ({ appelId }) => {
      try {
        const result = await db.query(
          `UPDATE appels SET statut = 'refuse', fin_le = NOW() WHERE id = $1 RETURNING initiateur_id`,
          [appelId]
        );

        if (result.rows.length === 0) return;

        io.to(`user_${result.rows[0].initiateur_id}`).emit('appel:refuse', { appelId });
      } catch (err) {
        console.error('[appel:refuser] erreur :', err.message);
      }
    });

    // Fin de l'appel — durée calculée côté client et envoyée ici
    socket.on('appel:terminer', async ({ appelId, dureeSecondes }) => {
      try {
        const result = await db.query(
          `UPDATE appels
           SET statut = 'termine', duree_secondes = $2, fin_le = NOW()
           WHERE id = $1
           RETURNING initiateur_id, destinataire_id`,
          [appelId, dureeSecondes || 0]
        );

        if (result.rows.length === 0) return;

        const { initiateur_id, destinataire_id } = result.rows[0];

        io.to(`user_${initiateur_id}`).emit('appel:termine', { appelId });
        io.to(`user_${destinataire_id}`).emit('appel:termine', { appelId });
      } catch (err) {
        console.error('[appel:terminer] erreur :', err.message);
      }
    });

    // Relais des contrôles (micro, caméra, partage d'écran) à l'autre participant du ticket
    socket.on('appel:controle', ({ ticketId, micro, video, partageEcran }) => {
      socket.to(`ticket_${ticketId}`).emit('appel:controle', {
        userId: socket.user.id,
        micro,
        video,
        partageEcran
      });
    });

  });
};

module.exports = initialiserSocketAppels;
