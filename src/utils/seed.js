require('dotenv').config();
const connectDB = require('../config/db');
const Order = require('../models/Order');
const OrderStatus = require('../models/OrderStatus');

const seed = async () => {
  try {
    await connectDB();
    // clear
    await Order.deleteMany({});
    await OrderStatus.deleteMany({});

    const orders = [];
    for (let i = 0; i < 10; i++) {
      const o = new Order({
        school_id: process.env.SCHOOL_ID,
        trustee_id: `trustee_${i}`,
        custom_order_id: `CUST-${Date.now()}-${i}`,
        student_info: { name: `Student ${i}`, id: `${1000 + i}`, email: `student${i}@mail.com` },
        gateway_name: 'PhonePe'
      });
      await o.save();
      const os = new OrderStatus({
        collect_id: o._id,
        order_amount: 2000 + i * 100,
        transaction_amount: 2000 + i * 100,
        status: i % 3 === 0 ? 'success' : (i % 3 === 1 ? 'pending' : 'failed'),
        payment_mode: 'upi',
        payment_details: `success@upi`,
        bank_reference: `REF${i}`,
        payment_time: new Date()
      });
      await os.save();
      orders.push({ o, os });
    }
    console.log('Seed done');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();
