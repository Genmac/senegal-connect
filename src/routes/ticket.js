const express = require('express');
const router = express.Router();
const { creerTicket, obtenirMessagesTicket } = require('../controllers/ticketController');
const { authentifierToken } = require('../middleware/auth');

router.use(authentifierToken);

router.post('/', creerTicket);
router.get('/:id/messages', obtenirMessagesTicket);

module.exports = router;
