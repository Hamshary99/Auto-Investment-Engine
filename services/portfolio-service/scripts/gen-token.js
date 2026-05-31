/**
 * gen-token.js
 * Generates a dev JWT signed with the same secret the portfolio-service uses.
 * Usage: node scripts/gen-token.js [userId] [email]
 * Output: a Bearer token you can paste into postman/local.environment.json → jwtToken
 */
const jwt = require("jsonwebtoken");
const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../../../.env") });

const userId = process.argv[2] || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const email  = process.argv[3] || "dev@auto-invest.local";
const secret = process.env.JWT_SECRET || "dev-secret";

const token = jwt.sign(
  { sub: userId, email },
  secret,
  { expiresIn: "8h" },
);

console.log("\n── Dev JWT ─────────────────────────────────────────────");
console.log(`  userId : ${userId}`);
console.log(`  email  : ${email}`);
console.log(`  secret : ${secret}`);
console.log("────────────────────────────────────────────────────────");
console.log("\nBearer token (copy into local.environment.json → jwtToken):\n");
console.log(token);
console.log();
