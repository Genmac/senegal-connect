const express = require('express');
const router = express.Router();
const { creerTicket, obtenirMessagesTicket } = require('../controllers/ticketController');
const { verifierJWT } = require('../middleware/auth');

router.use(verifierJWT);

router.post('/', creerTicket);
router.get('/:id/messages', obtenirMessagesTicket);

module.exports = router;
