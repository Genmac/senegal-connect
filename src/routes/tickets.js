const express = require('express');
const router = express.Router();
const {
  creerTicket,
  listerTickets,
  obtenirMessagesTicket,
  obtenirAppelsTicket
} = require('../controllers/ticketController');
const { verifierJWT } = require('../middleware/auth');

router.use(verifierJWT);

router.get('/', listerTickets);
router.post('/', creerTicket);
router.get('/:id/messages', obtenirMessagesTicket);
router.get('/:id/appels', obtenirAppelsTicket);

module.exports = router;
