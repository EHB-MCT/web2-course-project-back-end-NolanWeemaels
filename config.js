const mongoUri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || "fritkotgp";
const jwtSecret = process.env.JWT_SECRET || "fritkot_secret";
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "7d";
const port = process.env.PORT || 3000;

module.exports = { mongoUri, dbName, jwtSecret, jwtExpiresIn, port };