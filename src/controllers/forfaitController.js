// src/controllers/forfaitController.js
const db = require('../config/db');

// GET /api/forfaits - Liste avec nombre d'abonnés actifs (COUNT via JOIN)
exports.getForfaits = async (req, res, next) => {
  try {
    const sql = `
      SELECT f.*, COUNT(c.id)::INT AS nb_clients
      FROM forfaits f
      LEFT JOIN clients c ON f.id = c.forfait_id AND c.statut = 'actif'
      WHERE f.actif = TRUE
      GROUP BY f.id
      ORDER BY f.prix_mensuel_fcfa ASC
    `;
    const result = await db.query(sql);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/forfaits/:id - Détail d'un forfait + abonnés
exports.getForfaitById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const forfaitRes = await db.query('SELECT * FROM forfaits WHERE id = $1', [id]);

    if (forfaitRes.rows.length === 0) {
      return res.status(404).json({ erreur: 'Forfait non trouvé' });
    }

    const clientsRes = await db.query(
      'SELECT id, msisdn, statut FROM clients WHERE forfait_id = $1',
      [id]
    );

    res.json({
      ...forfaitRes.rows[0],
      clients: clientsRes.rows,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/forfaits - Créer un forfait (Admin)
exports.creerForfait = async (req, res, next) => {
  try {
    const { nom, quota_data_go, quota_voix_min, prix_mensuel_fcfa } = req.body;
    const sql = `
      INSERT INTO forfaits (nom, quota_data_go, quota_voix_min, prix_mensuel_fcfa)
      VALUES ($1, $2, $3, $4) RETURNING *
    `;
    const result = await db.query(sql, [nom, quota_data_go, quota_voix_min, prix_mensuel_fcfa]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/forfaits/:id - Supprimer (Impossible si des clients y sont abonnés -> 409)
exports.supprimerForfait = async (req, res, next) => {
  try {
    const { id } = req.params;
    const checkClients = await db.query('SELECT COUNT(*)::INT FROM clients WHERE forfait_id = $1', [id]);

    if (checkClients.rows[0].count > 0) {
      return res.status(409).json({ erreur: 'Impossible de supprimer un forfait lié à des abonnés actifs' });
    }

    const deleteRes = await db.query('DELETE FROM forfaits WHERE id = $1 RETURNING *', [id]);
    if (deleteRes.rows.length === 0) {
      return res.status(404).json({ erreur: 'Forfait non trouvé' });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
