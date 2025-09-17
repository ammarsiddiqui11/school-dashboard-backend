

const express = require('express');
const authMiddleware = require("../middleware/authMiddleware");
const { createPayment, handleWebhook, getTransactionStatus, getAllTransactions, getTransactionsBySchool, checkPaymentStatus } = require('../controllers/paymentController');

const router = express.Router();

router.post('/create-payment', authMiddleware, createPayment); 
router.post('/webhook', handleWebhook); 
router.get("/status/:custom_order_id", authMiddleware, getTransactionStatus);
router.get("/transactions", authMiddleware, getAllTransactions);
router.get("/transactions/school/:schoolId", authMiddleware, getTransactionsBySchool);
router.get("/check-status/:collectId", checkPaymentStatus);


module.exports = router;
