// src/middleware/erreurs.js
const multer = require('multer');

// Formatage de la réponse de pagination
exports.paginer = (queryResult, page, limite, total) => {
  const totalPageCount = Math.ceil(total / limite);
  return {
    data: queryResult,
    pagination: {
      total: parseInt(total),
      page: parseInt(page),
      limite: parseInt(limite),
      total_pages: totalPageCount,
    },
  };
};

// Middleware global de gestion d'erreurs Express (4 paramètres)
exports.gestionnaireErreurs = (err, req, res, next) => {
  console.error(err);

  // Violation de contrainte d'unicité (ex: MSISDN ou email déjà existant)
  if (err.code === '23505') {
    return res.status(409).json({
      erreur: 'Une ressource avec cette valeur unique existe déjà dans la base de données.',
      detail: err.detail,
    });
  }
  // Violation de clé étrangère
  if (err.code === '23503') {
    return res.status(422).json({
      erreur: 'Opération impossible : référence introuvable (clé étrangère).',
      detail: err.detail,
    });
  }
  // Erreurs Multer (fichier trop volumineux, etc.)
  if (err instanceof multer.MulterError) {
    return res.status(422).json({
      erreur: err.code === 'LIMIT_FILE_SIZE'
        ? 'Fichier trop volumineux (10 Mo maximum).'
        : `Erreur d'upload : ${err.message}`,
    });
  }
  // Type de fichier rejeté par le fileFilter de multer
  if (err.message && err.message.includes('Type de fichier non autorisé')) {
    return res.status(422).json({ erreur: err.message });
  }

  return res.status(500).json({
    erreur: process.env.NODE_ENV === 'production' ? 'Erreur interne du serveur' : err.message,
  });
};
