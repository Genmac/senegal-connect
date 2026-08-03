// src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Inscription utilisateur
exports.register = async (req, res) => {
  const { nom, prenom, email, mot_de_passe, role } = req.body;
  const roleUtilisateur = role || 'client'; // Rôle par défaut

  try {
    // Vérifier si l'email existe déjà
    const checkEmail = await db.query('SELECT id FROM utilisateurs WHERE email = $1', [email]);
    if (checkEmail.rows.length > 0) {
      return res.status(409).json({ erreur: "L'adresse email est déjà utilisée." });
    }

    // Hachage du mot de passe avec un coût de 12 (Bcrypt)
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(mot_de_passe, salt);

    // Insertion BDD
    const queryText = `
      INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, nom, prenom, email, role, cree_le
    `;
    const result = await db.query(queryText, [nom, prenom, email, passwordHash, roleUtilisateur]);

    return res.status(201).json({
      message: 'Utilisateur inscrit avec succès',
      utilisateur: result.rows[0],
    });
  } catch (err) {
    return res.status(500).json({ erreur: err.message });
  }
};

// Connexion utilisateur
exports.login = async (req, res) => {
  const { email, mot_de_passe } = req.body;

  try {
    const userResult = await db.query('SELECT * FROM utilisateurs WHERE email = $1', [email]);
    
    // Message générique si le compte n'existe pas
    if (userResult.rows.length === 0) {
      return res.status(401).json({ erreur: 'Identifiants incorrects' });
    }

    const user = userResult.rows[0];

    // Verification du mot de passe
    const passwordValide = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
    if (!passwordValide) {
      // Même message générique pour des raisons de sécurité
      return res.status(401).json({ erreur: 'Identifiants incorrects' });
    }

    // Génération du Token JWT
    const payload = {
      id: user.id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      issuer: 'senegal-connect',
    });

    return res.json({
      token,
      expires_in: '24h',
      utilisateur: payload,
    });
  } catch (err) {
    return res.status(500).json({ erreur: err.message });
  }
};

// Profil de l'utilisateur connecté
exports.getProfil = async (req, res) => {
  try {
    const userResult = await db.query(
      'SELECT id, nom, prenom, email, role, cree_le FROM utilisateurs WHERE id = $1',
      [req.user.id]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ erreur: 'Utilisateur introuvable' });
    }
    return res.json(userResult.rows[0]);
  } catch (err) {
    return res.status(500).json({ erreur: err.message });
  }
};
