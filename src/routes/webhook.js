const express = require('express');
const { handleWebhook } = require('../controllers/webhookController');
const router = express.Router();

router.post('/', express.json(), handleWebhook);

module.exports = router;
