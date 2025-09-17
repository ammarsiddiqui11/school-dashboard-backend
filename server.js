require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/auth');
const paymentsRoutes = require('./src/routes/payments');
const webhookRoutes = require('./src/routes/webhook');
const transactionsRoutes = require('./src/routes/transactions');
const { errorHandler } = require('./src/middleware/errorHandler');

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

app.use('/api/auth', authRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api', transactionsRoutes);


app.get('/', (req, res) => res.send('School Payments API is running'));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
