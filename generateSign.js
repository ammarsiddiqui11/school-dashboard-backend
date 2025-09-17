import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config(); 
const SCHOOL_ID = process.env.SCHOOL_ID;
const PG_KEY = process.env.PAYMENT_PG_KEY;

function generateSign(collectRequestId) {
  if (!SCHOOL_ID || !PG_KEY) {
    throw new Error("Missing SCHOOL_ID or PG_KEY in environment variables");
  }

  const payload = {
    school_id: SCHOOL_ID,
    collect_request_id: collectRequestId,
  };

  return jwt.sign(payload, PG_KEY, { algorithm: "HS256" });
}

// CLI usage
const collectRequestId = process.argv[2];
if (!collectRequestId) {
  console.error("Usage: node generateSign.js <collect_request_id>");
  process.exit(1);
}

console.log("Generated Sign:", generateSign(collectRequestId));