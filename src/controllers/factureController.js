// src/controllers/factureController.js
const db = require('../config/db');
const { paginer } = require('../middleware/erreurs');

// GET /api/factures - Liste paginée + filtres ?client_id=, ?statut=, ?periode=
exports.getFactures = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limite = parseInt(req.query.limite) || 10;
    const offset = (page - 1) * limite;
    const { client_id, statut, periode } = req.query;

    let conditions = [];
    let params = [];
    let pIdx = 1;

    if (client_id) { conditions.push(`client_id = $${pIdx++}`); params.push(client_id); }
    if (statut) { conditions.push(`statut = $${pIdx++}`); params.push(statut); }
    if (periode) { conditions.push(`periode = $${pIdx++}`); params.push(periode); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await db.query(`SELECT COUNT(*)::INT FROM factures ${where}`, params);
    const total = countRes.rows[0].count;

    const dataSql = `SELECT * FROM factures ${where} ORDER BY date_emission DESC LIMIT $${pIdx} OFFSET $${pIdx + 1}`;
    params.push(limite, offset);

    const dataRes = await db.query(dataSql, params);
    res.json(paginer(dataRes.rows, page, limite, total));
  } catch (err) {
    next(err);
  }
};

// POST /api/factures - Génération automatique de la référence (FAC-YYYYMM-XXXX)
exports.creerFacture = async (req, res, next) => {
  try {
    const { client_id, periode, montant_fcfa, date_echeance } = req.body;

    // Génération automatique d'une référence unique (ex: FAC-202608-4821)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const periodeClean = periode.replace('-', '');
    const reference = `FAC-${periodeClean}-${randomSuffix}`;

    const sql = `
      INSERT INTO factures (client_id, reference, periode, montant_fcfa, date_echeance)
      VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const result = await db.query(sql, [client_id, reference, periode, montant_fcfa, date_echeance]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};
