/*
 SOURCES:
 - Node.js `process.env` (environment variables):
    https://nodejs.org/api/process.html#processenv
 - The Twelve-Factor App — Config (env vars as configuration):
    https://12factor.net/config
 
USED IN THIS FILE:
 - Reading environment variables (process.env.*)
 - Providing fallback defaults (|| "default")
 */

const mongoUri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || "fritkotgp";
const jwtSecret = process.env.JWT_SECRET || "fritkot_secret";
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "7d";
const port = process.env.PORT || 3000;

module.exports = { mongoUri, dbName, jwtSecret, jwtExpiresIn, port };