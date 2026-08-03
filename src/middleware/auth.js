// src/middleware/auth.js
const jwt = require('jsonwebtoken');

// Middleware 1: Vérification strict du JWT avec 3 messages d'erreur distincts
const verifierJWT = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

  // Cas 1: Token absent
  if (!token) {
    return res.status(401).json({ erreur: 'Token manquant' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      // Cas 2: Token expiré
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ erreur: 'Token expiré - veuillez vous reconnecter' });
      }
      // Cas 3: Token invalide
      return res.status(401).json({ erreur: 'Token invalide' });
    }

    req.user = decoded; // Stocke { id, nom, email, role } dans req.user
    next();
  });
};

// Middleware 2: Contrôle d'accès basé sur le rôle (RBAC)
const garderRole = (...rolesAutorises) => {
  return (req, res, next) => {
    if (!req.user || !rolesAutorises.includes(req.user.role)) {
      return res.status(403).json({ erreur: 'Accès refusé: privilèges insuffisants' });
    }
    next();
  };
};

module.exports = { verifierJWT, garderRole };
