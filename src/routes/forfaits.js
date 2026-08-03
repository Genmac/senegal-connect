// src/routes/forfaits.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const forfaitController = require('../controllers/forfaitController');
const { verifierJWT, garderRole } = require('../middleware/auth');

const router = express.Router();

const valider = (req, res, next) => {
  const err = validationResult(req);
  if (!err.isEmpty()) {
    return res.status(422).json({ erreurs: err.array() });
  }
  next();
};

router.get('/', forfaitController.getForfaits);
router.get('/:id', forfaitController.getForfaitById);

// Routes protégées Admin
router.post(
  '/',
  verifierJWT,
  garderRole('admin'),
  [
    body('nom').notEmpty().withMessage('Le nom est requis'),
    body('quota_data_go').isInt({ min: 0 }).withMessage('Quota data doit être >= 0'),
    body('quota_voix_min').isInt({ min: 0 }).withMessage('Quota voix doit être >= 0'),
    body('prix_mensuel_fcfa').isFloat({ gt: 0 }).withMessage('Le prix doit être > 0 FCFA'),
    valider,
  ],
  forfaitController.creerForfait
);

router.delete('/:id', verifierJWT, garderRole('admin'), forfaitController.supprimerForfait);

module.exports = router;
