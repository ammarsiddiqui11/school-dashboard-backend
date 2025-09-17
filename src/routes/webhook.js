const express = require('express');
const { handleWebhook } = require('../controllers/webhookController');
const router = express.Router();

// webhooks are usually publicly accessible - provider will POST here
router.post('/', express.json(), handleWebhook);

module.exports = router;
