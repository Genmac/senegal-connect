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
    const utilisateur_id = req.user.id;
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

    const ticket = result.rows[0];

    const io = req.app.get('io');
    if (io) {
      io.to('agents').emit('ticket:nouveau', {
        ...ticket,
        client_nom: req.user.nom,
        client_prenom: req.user.prenom
      });
    }

    res.status(201).json({
      succes: true,
      message: 'Ticket de support créé avec succès',
      ticket
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/tickets - Liste des tickets selon le rôle connecté
const listerTickets = async (req, res, next) => {
  try {
    const { role, id: utilisateur_id } = req.user;
    let query, params;

    if (role === 'client') {
      query = `
        SELECT t.id, t.sujet, t.statut, t.ouvert_le, t.ferme_le,
               t.agent_id, ua.nom AS agent_nom
        FROM tickets t
        JOIN clients c ON t.client_id = c.id
        LEFT JOIN utilisateurs ua ON t.agent_id = ua.id
        WHERE c.utilisateur_id = $1
        ORDER BY t.ouvert_le DESC`;
      params = [utilisateur_id];
    } else if (role === 'agent') {
      query = `
        SELECT t.id, t.sujet, t.statut, t.ouvert_le, t.ferme_le,
               t.client_id, t.agent_id,
               uc.nom AS client_nom, uc.prenom AS client_prenom
        FROM tickets t
        JOIN clients c ON t.client_id = c.id
        JOIN utilisateurs uc ON c.utilisateur_id = uc.id
        WHERE t.statut = 'ouvert' OR t.agent_id = $1
        ORDER BY t.ouvert_le DESC`;
      params = [utilisateur_id];
    } else {
      query = `
        SELECT t.id, t.sujet, t.statut, t.ouvert_le, t.ferme_le,
               t.client_id, t.agent_id,
               uc.nom AS client_nom, uc.prenom AS client_prenom
        FROM tickets t
        JOIN clients c ON t.client_id = c.id
        JOIN utilisateurs uc ON c.utilisateur_id = uc.id
        ORDER BY t.ouvert_le DESC`;
      params = [];
    }

    const result = await db.query(query, params);
    res.json({ succes: true, tickets: result.rows });
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
    res.json({ succes: true, messages: result.rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/tickets/:id/appels - Historique des appels d'un ticket (M4)
const obtenirAppelsTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT a.id, a.ticket_id, a.type, a.statut, a.duree_secondes,
              a.debut_le, a.fin_le,
              init.nom AS initiateur_nom, init.id AS initiateur_id,
              dest.nom AS destinataire_nom, dest.id AS destinataire_id
       FROM appels a
       JOIN utilisateurs init ON a.initiateur_id = init.id
       JOIN utilisateurs dest ON a.destinataire_id = dest.id
       WHERE a.ticket_id = $1
       ORDER BY a.debut_le DESC`,
      [id]
    );
    res.json({ succes: true, appels: result.rows });
  } catch (err) {
    next(err);
  }
};

// POST /api/tickets/:id/fichier - Upload d'un fichier (multer). Le message est créé ensuite via Socket.IO (fichier:partager)
const uploaderFichierTicket = (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(422).json({ succes: false, erreur: 'Aucun fichier reçu' });
    }
    res.status(201).json({
      succes: true,
      fichier_url: `/uploads/${req.file.filename}`,
      fichier_nom: req.file.originalname,
      fichier_taille: req.file.size,
      mime_type: req.file.mimetype
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  creerTicket,
  listerTickets,
  obtenirMessagesTicket,
  obtenirAppelsTicket,
  uploaderFichierTicket
};
