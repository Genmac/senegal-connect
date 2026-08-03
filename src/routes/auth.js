// src/routes/auth.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const { verifierJWT } = require('../middleware/auth');

const router = express.Router();

// Middleware pour intercepter les erreurs de validation
const valider = (req, res, next) => {
  const erreurs = validationResult(req);
  if (!erreurs.isEmpty()) {
    return res.status(422).json({
      erreurs: erreurs.array().map((err) => ({
        champ: err.path,
        message: err.msg,
        valeur: err.value,
      })),
    });
  }
  next();
};

// Route Registre
router.post(
  '/register',
  [
    body('nom').trim().notEmpty().withMessage('Le nom est requis'),
    body('prenom').trim().notEmpty().withMessage('Le prénom est requis'),
    body('email').isEmail().withMessage('Email invalide'),
    body('mot_de_passe').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères'),
    body('role').optional().isIn(['client', 'agent', 'admin']).withMessage('Rôle invalide'),
    valider,
  ],
  authController.register
);

// Route Login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Email invalide'),
    body('mot_de_passe').notEmpty().withMessage('Le mot de passe est requis'),
    valider,
  ],
  authController.login
);

// Route Profil Protégée
router.get('/profil', verifierJWT, authController.getProfil);

module.exports = router;
