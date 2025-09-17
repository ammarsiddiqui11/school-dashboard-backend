
const jwt = require("jsonwebtoken");

function generateSignForCreate(payload) {
  if (!process.env.SCHOOL_ID || !process.env.PAYMENT_PG_KEY) {
    throw new Error("Missing SCHOOL_ID or PAYMENT_PG_KEY in environment variables");
  }

  return jwt.sign(payload, process.env.PAYMENT_PG_KEY, { algorithm: "HS256" });
}


function generateSignForStatus(collectRequestId) {
  if (!process.env.SCHOOL_ID || !process.env.PAYMENT_PG_KEY) {
    throw new Error("Missing SCHOOL_ID or PAYMENT_PG_KEY in environment variables");
  }

  const payload = {
    school_id: process.env.SCHOOL_ID,
    collect_request_id: collectRequestId,
  };

  return jwt.sign(payload, process.env.PAYMENT_PG_KEY, { algorithm: "HS256" });
}

module.exports = {
  generateSignForCreate,
  generateSignForStatus,
};
