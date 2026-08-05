const db = require('../config/db');

// POST /api/tickets - Créer un ticket de support (client uniquement)
const creerTicket = async (req, res, next) => {
  try {
    const { sujet } = req.body;

    if (!sujet || sujet.trim() === '') {
      return res.status(422).json({
        succes: false,
        erreurs: [{ champ: 'sujet', message: 'Le sujet est obligatoire' }]
      });
    }

    const utilisateur_id = req.user.id; // Issu du token JWT

    // Résoudre le client_id à partir de l'utilisateur connecté
    const clientResult = await db.query(
      `SELECT id FROM clients WHERE utilisateur_id = $1`,
      [utilisateur_id]
    );

    if (clientResult.rows.length === 0) {
      return res.status(403).json({
        succes: false,
        erreur: 'Seul un client abonné peut ouvrir un ticket de support'
      });
    }

    const client_id = clientResult.rows[0].id;

    const result = await db.query(
      `INSERT INTO tickets (client_id, sujet, statut)
       VALUES ($1, $2, 'ouvert')
       RETURNING *`,
      [client_id, sujet]
    );

    res.status(201).json({
      succes: true,
      message: 'Ticket de support créé avec succès',
      ticket: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/tickets/:id/messages - Historique des messages d'un ticket
const obtenirMessagesTicket = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT m.id, m.ticket_id, m.expediteur_id, u.nom, u.prenom, u.role,
              m.type, m.contenu, m.fichier_url, m.fichier_nom, m.fichier_taille,
              m.envoye_le
       FROM messages m
       JOIN utilisateurs u ON m.expediteur_id = u.id
       WHERE m.ticket_id = $1
       ORDER BY m.envoye_le ASC`,
      [id]
    );

    res.json({
      succes: true,
      messages: result.rows
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { creerTicket, obtenirMessagesTicket };
