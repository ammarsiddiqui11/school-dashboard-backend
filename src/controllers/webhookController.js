const axios = require("axios");
const jwt = require("jsonwebtoken");
const WebhookLog = require("../models/webhooklog");
const OrderStatus = require("../models/OrderStatus");
const Order = require("../models/Order");

function generateSign(payload) {
  return jwt.sign(payload, process.env.PAYMENT_PG_KEY, { algorithm: "HS256" });
}

exports.handleWebhook = async (req, res, next) => {
  try {
    const payload = req.body;
    console.log("📩 Webhook received:", JSON.stringify(payload, null, 2));

    // Save raw log
    const log = new WebhookLog({ received_payload: payload });
    await log.save();

    const orderInfo = payload.order_info || payload;

    const gatewayCollectId =
      orderInfo.order_id ||
      orderInfo.collect_request_id ||
      orderInfo.collect_id ||
      null;

    const customOrderId =
      orderInfo.custom_order_id && orderInfo.custom_order_id !== "NA"
        ? orderInfo.custom_order_id
        : null;

    if (!gatewayCollectId && !customOrderId) {
      log.processed = false;
      log.error = "Missing identifiers (collect_request_id/custom_order_id)";
      await log.save();
      return res
        .status(400)
        .json({ message: "Invalid webhook payload: missing identifiers" });
    }

   
    let orderStatus = await OrderStatus.findOne({
      $or: [
        { gateway_collect_id: gatewayCollectId },
        { custom_order_id: customOrderId },
      ],
    });

    if (!orderStatus) {
      let order = null;
      if (customOrderId) {
        order = await Order.findOne({ custom_order_id: customOrderId });
      }
      orderStatus = new OrderStatus({
        collect_id: order ? order._id : undefined,
        custom_order_id: customOrderId || undefined,
        gateway_collect_id: gatewayCollectId,
      });
    }

    
    orderStatus.status = orderInfo.status || orderStatus.status;
    orderStatus.transaction_amount =
      orderInfo.transaction_amount ||
      orderInfo.order_amount ||
      orderStatus.transaction_amount;
    orderStatus.order_amount =
      orderInfo.order_amount || orderStatus.order_amount;
    orderStatus.payment_mode =
      orderInfo.payment_mode || orderStatus.payment_mode;
    orderStatus.payment_details =
      orderInfo.payment_details ||
      orderInfo.details ||
      orderStatus.payment_details;
    orderStatus.bank_reference =
      orderInfo.bank_reference || orderStatus.bank_reference;
    orderStatus.payment_message =
      orderInfo.payment_message ||
      orderInfo.Payment_message ||
      orderStatus.payment_message;
    orderStatus.error_message =
      orderInfo.error_message || orderStatus.error_message;
    orderStatus.payment_time = orderInfo.payment_time
      ? new Date(orderInfo.payment_time)
      : new Date();

    await orderStatus.save();

  
    if (gatewayCollectId && !orderInfo.status) {
      try {
        const signPayload = {
          school_id: process.env.SCHOOL_ID,
          collect_request_id: gatewayCollectId,
        };
        const sign = generateSign(signPayload);

        const edvResp = await axios.get(
          `${process.env.PAYMENT_API_ENDPOINT2}/${gatewayCollectId}`,
          {
            params: { school_id: process.env.SCHOOL_ID, sign },
            headers: {
              Authorization: `Bearer ${process.env.PAYMENT_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );
        const edv = edvResp.data;
        orderStatus.status = edv.status || orderStatus.status;
        orderStatus.transaction_amount =
          edv.transaction_amount || edv.amount || orderStatus.transaction_amount;
        orderStatus.order_amount = edv.amount || orderStatus.order_amount;
        orderStatus.payment_mode =
          edv.details?.payment_mode || orderStatus.payment_mode;
        orderStatus.payment_details = edv.details || orderStatus.payment_details;
        orderStatus.bank_reference =
          edv.details?.bank_ref || orderStatus.bank_reference;
        orderStatus.payment_message =
          edv.payment_message || orderStatus.payment_message;
        await orderStatus.save();
      } catch (err) {
        console.warn("Webhook fallback Edviron check failed:", err.message);
      }
    }

    log.processed = true;
    await log.save();

    return res.status(200).json({
      message: "Webhook processed",
      updated: orderStatus,
    });
  } catch (err) {
    console.error("Webhook error:", err.message);
    next(err);
  }
};
