const express = require('express');
const router = express.Router();
const {
  creerTicket,
  listerTickets,
  obtenirMessagesTicket,
  obtenirAppelsTicket,
  uploaderFichierTicket
} = require('../controllers/ticketController');
const { verifierJWT } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(verifierJWT);

router.get('/', listerTickets);
router.post('/', creerTicket);
router.get('/:id/messages', obtenirMessagesTicket);
router.get('/:id/appels', obtenirAppelsTicket);
router.post('/:id/fichier', upload.single('fichier'), uploaderFichierTicket);

module.exports = router;
