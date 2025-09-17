const express = require('express');
const auth = require('../middleware/authMiddleware');
const { getAllTransactions, getTransactionsBySchool, getTransactionStatus } = require('../controllers/transactionController');
const router = express.Router();

// All routes protected
router.get('/transactions', auth, getAllTransactions);
router.get('/transactions/school/:schoolId', auth, getTransactionsBySchool);
router.get('/transaction-status/:custom_order_id', auth, getTransactionStatus);

module.exports = router;
