// src/routes/stats.js
const express = require('express');
const db = require('../config/db');
const { verifierJWT, garderRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/stats - Agrégations du tableau de bord
router.get('/', verifierJWT, garderRole('admin'), async (req, res, next) => {
  try {
    const statsQuery = `
      SELECT
        (SELECT COUNT(*)::INT FROM clients WHERE statut = 'actif') AS clients_actifs,
        (SELECT COALESCE(SUM(montant_fcfa), 0)::FLOAT FROM factures WHERE statut = 'payee') AS revenus_mrr_fcfa,
        (SELECT COUNT(*)::INT FROM factures WHERE statut = 'impayee') AS factures_impayees,
        (SELECT COUNT(*)::INT FROM tickets WHERE statut = 'ouvert') AS tickets_ouverts
    `;
    const result = await db.query(statsQuery);
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
