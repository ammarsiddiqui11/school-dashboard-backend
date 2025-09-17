const mongoose = require('mongoose');

const StudentInfoSchema = new mongoose.Schema({
  name: String,
  id: String,
  email: String
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  school_id: { type: String, index: true },
  trustee_id: { type: String },
  custom_order_id: { type: String, unique: true, index: true }, // optional custom id
  student_info: StudentInfoSchema,
  gateway_name: String,
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', OrderSchema);
