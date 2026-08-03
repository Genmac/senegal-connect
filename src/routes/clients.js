// src/routes/clients.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const clientController = require('../controllers/clientController');
const { verifierJWT, garderRole } = require('../middleware/auth');

const router = express.Router();

const valider = (req, res, next) => {
  const err = validationResult(req);
  if (!err.isEmpty()) {
    return res.status(422).json({ erreurs: err.array() });
  }
  next();
};

router.get('/', verifierJWT, clientController.getClients);
router.get('/:id', verifierJWT, clientController.getClientById);

// Création avec validation Regex MSISDN Sénégalaise /^\+221[0-9]{9}$/
router.post(
  '/',
  verifierJWT,
  garderRole('admin'),
  [
    body('utilisateur_id').isInt().withMessage('utilisateur_id valide requis'),
    body('msisdn')
      .matches(/^\+221[0-9]{9}$/)
      .withMessage('Le MSISDN doit respecter le format sénégalais +221XXXXXXXXX (9 chiffres)'),
    body('forfait_id').optional().isInt(),
    valider,
  ],
  clientController.creerClient
);

router.patch(
  '/:id/statut',
  verifierJWT,
  garderRole('admin'),
  [
    body('statut').isIn(['actif', 'suspendu', 'resilie']).withMessage('Statut invalide'),
    valider,
  ],
  clientController.changerStatut
);

module.exports = router;
