const mongoose = require('mongoose');

const WebhookLogSchema = new mongoose.Schema({
  received_payload: Object,
  received_at: { type: Date, default: Date.now },
  processed: { type: Boolean, default: false },
  error: String
});

module.exports = mongoose.model('WebhookLog', WebhookLogSchema);
