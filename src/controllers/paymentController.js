const axios = require('axios');
const jwt = require('jsonwebtoken');
const Order = require('../models/Order');
const OrderStatus = require('../models/OrderStatus');
const { generateSignForStatus,generateSignForCreate } = require("../utils/signHelper");

/**
 * createPayment:
 *  - save an Order (basic info)
 *  - sign payload with PG secret (JWT)
 *  - call Edviron create-collect-request API
 *  - store gateway_collect_id in OrderStatus
 *  - return payment link to frontend
 */

exports.createPayment = async (req, res, next) => {
  try {
    const {
      school_id = process.env.SCHOOL_ID,
      trustee_id,
      student_info,
      order_amount,
      custom_order_id,
      redirect_url,
    } = req.body;

    // 1️⃣ Validation
    if (!order_amount || !student_info) {
      return res.status(400).json({ message: "Missing order_amount or student_info" });
    }

    // 2️⃣ Create Order
    const order = new Order({
      school_id,
      trustee_id,
      student_info,
      custom_order_id,
      gateway_name: "Edviron",
    });
    await order.save();

    // 3️⃣ Create initial OrderStatus (pending)
    let orderStatus = new OrderStatus({
      collect_id: order._id,
      order_amount,
      status: "PENDING",
      custom_order_id: custom_order_id || undefined,
    });
    await orderStatus.save();

    // 4️⃣ Payload for Edviron
    const callback_url = redirect_url || `${process.env.BASE_URL}/api/webhook`;
    const payloadForSign = { school_id, amount: String(order_amount), callback_url };

    // ✅ Generate sign
    const sign = generateSignForCreate(payloadForSign);

    const requestBody = { ...payloadForSign, sign };

    // 5️⃣ Call Edviron API
    const response = await axios.post(process.env.PAYMENT_API_ENDPOINT, requestBody, {
      headers: {
        Authorization: `Bearer ${process.env.PAYMENT_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    // 6️⃣ Extract values
    const { collect_request_id, collect_request_url } = response.data;

    // 7️⃣ Update OrderStatus with gateway_collect_id
    orderStatus.gateway_collect_id = collect_request_id;
    orderStatus.payment_details = response.data;
    await orderStatus.save();

    return res.status(201).json({
      message: "Payment created",
      order_id: order._id,
      local_collect_id: orderStatus._id,
      gateway_collect_id: collect_request_id,
      paymentLink: collect_request_url, // lowercase fixed
      rawResponse: response.data,
    });
  } catch (err) {
    console.error("Payment error:", err.response?.data || err.message);
    next(err);
  }
};



exports.handleWebhook = async (req, res, next) => {
  try {
    const payload = req.body;
    console.log("📩 Webhook received:", payload);

    // Extract identifiers from webhook
    const orderInfo = payload.order_info || {};
    const searchId = orderInfo.order_id || orderInfo.collect_request_id;

    if (!searchId) {
      return res.status(400).json({
        message: "Invalid webhook payload: missing order_id or collect_request_id",
      });
    }

    // Find existing OrderStatus by gateway_collect_id
    const orderStatus = await OrderStatus.findOne({ gateway_collect_id: searchId });
    if (!orderStatus) {
      return res.status(404).json({
        message: `Order status not found for gateway_collect_id=${searchId}`,
      });
    }

    // ✅ Generate fresh sign for Edviron status API
    const sign = generateSignForStatus(searchId);

    // ✅ Call Edviron collect-request status API
    const response = await axios.get(
      `${process.env.PAYMENT_API_ENDPOINT2}/${searchId}`,
      {
        params: {
          school_id: process.env.SCHOOL_ID,
          sign,
        },
        headers: {
          Authorization: `Bearer ${process.env.PAYMENT_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = response.data;

    
    orderStatus.status = data.status || orderStatus.status;
    orderStatus.transaction_amount = data.transaction_amount || orderStatus.transaction_amount;
    orderStatus.payment_mode = data.details?.payment_mode || orderStatus.payment_mode;
    orderStatus.bank_reference = data.details?.bank_ref || orderStatus.bank_reference;
    orderStatus.payment_details = data.details || orderStatus.payment_details;
    orderStatus.payment_time = new Date();

    await orderStatus.save();

    return res.status(200).json({
      message: "Webhook processed & status synced",
      edvironResponse: data,
      updated: orderStatus,
    });
  } catch (err) {
    console.error("Webhook error:", err.response?.data || err.message);
    next(err);
  }
};




exports.getTransactionStatus = async (req, res, next) => {
  try {
    const { custom_order_id } = req.params;
    const status = await OrderStatus.findOne({ custom_order_id })
    .populate("collect_id");

    if (!status) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    res.json(status);
  } catch (err) {
    next(err);
  }
};

// ✅ Get all transactions
exports.getAllTransactions = async (req, res, next) => {
  try {
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortField = req.query.sort || "createdAt"; 
    const sortOrder = req.query.order === "asc" ? 1 : -1;

    const skip = (page - 1) * limit;

    
    const [transactions, total] = await Promise.all([
      OrderStatus.find()
        .populate("collect_id")
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit),
      OrderStatus.countDocuments()
    ]);

    //  Send response
    res.json({
      data: transactions,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (err) {
    console.error("Error in getAllTransactions:", err.message);
    next(err);
  }
};


// Get transactions by school
exports.getTransactionsBySchool = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    const statuses = await OrderStatus.find().populate({
      path: "collect_id",
      match: { school_id: schoolId }
    });

    const filtered = statuses.filter(s => s.collect_id !== null);
    res.json(filtered);
  } catch (err) {
    next(err);
  }
};
exports.checkPaymentStatus = async (req, res, next) => {
  try {
    const { collectId } = req.params;

    
    const payload = {
      school_id: process.env.SCHOOL_ID,
      collect_request_id: collectId,
    };

    // sign with PG key
    const sign = jwt.sign(payload, process.env.PAYMENT_PG_KEY, {
      algorithm: "HS256",
    });

    // call Edviron status API
    const response = await axios.get(
      `${process.env.PAYMENT_API_ENDPOINT2}/${collectId}`,
      {
        params: {
          school_id: process.env.SCHOOL_ID,
          sign,
        },
        headers: {
          Authorization: `Bearer ${process.env.PAYMENT_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = response.data;

   
    const updated = await OrderStatus.findOneAndUpdate(
      { gateway_collect_id: collectId },
      {
        status: data.status,
        transaction_amount: data.transaction_amount || data.amount,
        order_amount: data.amount,
        payment_mode: data.details?.payment_mode,
        payment_details: data.details,
        bank_reference: data.details?.bank_ref,
        payment_message: data.payment_message || null,
        payment_time: data.payment_time
          ? new Date(data.payment_time)
          : new Date(),
      },
      { new: true }
    );

    return res.json({
      message: "Status synced with Edviron",
      edvironResponse: data,
      updated,
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res
      .status(500)
      .json({ message: "Error checking status", error: err.message });
  }
};

