// src/routes/factures.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const factureController = require('../controllers/factureController');
const { verifierJWT, garderRole } = require('../middleware/auth');

const router = express.Router();

const valider = (req, res, next) => {
  const err = validationResult(req);
  if (!err.isEmpty()) return res.status(422).json({ erreurs: err.array() });
  next();
};

router.get('/', verifierJWT, factureController.getFactures);

router.post(
  '/',
  verifierJWT,
  garderRole('admin'),
  [
    body('client_id').isInt().withMessage('client_id valide requise'),
    body('periode').matches(/^\d{4}-\d{2}$/).withMessage('Format période doit être YYYY-MM'),
    body('montant_fcfa').isFloat({ min: 0 }).withMessage('Montant doit être >= 0 FCFA'),
    body('date_echeance').isISO8601().withMessage('Date d\'échéance invalide'),
    valider,
  ],
  factureController.creerFacture
);

module.exports = router;
