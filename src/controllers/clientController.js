// src/controllers/clientController.js
const db = require('../config/db');
const { paginer } = require('../middleware/erreurs');

// GET /api/clients - Liste paginée + filtres ?q=, ?forfait_id=, ?statut=, ?page=, ?limite=
exports.getClients = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limite = parseInt(req.query.limite) || 10;
    const offset = (page - 1) * limite;

    const { q, forfait_id, statut } = req.query;
    let conditions = [];
    let params = [];
    let paramIdx = 1;

    if (q) {
      conditions.push(`(u.nom ILIKE $${paramIdx} OR u.prenom ILIKE $${paramIdx} OR c.msisdn ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx})`);
      params.push(`%${q}%`);
      paramIdx++;
    }

    if (forfait_id) {
      conditions.push(`c.forfait_id = $${paramIdx}`);
      params.push(forfait_id);
      paramIdx++;
    }

    if (statut) {
      conditions.push(`c.statut = $${paramIdx}`);
      params.push(statut);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Comptage total
    const countSql = `SELECT COUNT(c.id)::INT FROM clients c JOIN utilisateurs u ON c.utilisateur_id = u.id ${whereClause}`;
    const totalResult = await db.query(countSql, params);
    const total = totalResult.rows[0].count;

    // Requête données paginées
    const dataSql = `
      SELECT c.*, u.nom, u.prenom, u.email, f.nom AS nom_forfait
      FROM clients c
      JOIN utilisateurs u ON c.utilisateur_id = u.id
      LEFT JOIN forfaits f ON c.forfait_id = f.id
      ${whereClause}
      ORDER BY c.id DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;
    params.push(limite, offset);

    const dataResult = await db.query(dataSql, params);
    res.json(paginer(dataResult.rows, page, limite, total));
  } catch (err) {
    next(err);
  }
};

// GET /api/clients/:id - Détail d'un client
exports.getClientById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT c.*, u.nom, u.prenom, u.email, f.nom as forfait_nom
      FROM clients c
      JOIN utilisateurs u ON c.utilisateur_id = u.id
      LEFT JOIN forfaits f ON c.forfait_id = f.id
      WHERE c.id = $1
    `;
    const result = await db.query(sql, [id]);
    if (result.rows.length === 0) return res.status(404).json({ erreur: 'Client non trouvé' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// POST /api/clients - Créer un abonné client (Admin)
exports.creerClient = async (req, res, next) => {
  try {
    const { utilisateur_id, msisdn, forfait_id } = req.body;
    const sql = `
      INSERT INTO clients (utilisateur_id, msisdn, forfait_id)
      VALUES ($1, $2, $3) RETURNING *
    `;
    const result = await db.query(sql, [utilisateur_id, msisdn, forfait_id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/clients/:id/statut - Changer statut (actif/suspendu/resilie)
exports.changerStatut = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { statut } = req.body;

    // Règle métier : Impossible de résilier si factures impayées
    if (statut === 'resilie') {
      const impayes = await db.query(
        "SELECT COUNT(*)::INT FROM factures WHERE client_id = $1 AND statut IN ('impayee', 'en_retard')",
        [id]
      );
      if (impayes.rows[0].count > 0) {
        return res.status(409).json({ erreur: 'Impossible de résilier un client avec des factures impayées' });
      }
    }

    const result = await db.query('UPDATE clients SET statut = $1 WHERE id = $2 RETURNING *', [statut, id]);
    if (result.rows.length === 0) return res.status(404).json({ erreur: 'Client non trouvé' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};
