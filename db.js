
const { MongoClient } = require("mongodb");
const { mongoUri, dbName } = require("./config");

let db = null;

async function connectDB() {
  if (!mongoUri) throw new Error("Missing MONGO_URI in env/.env");

  const client = new MongoClient(mongoUri);
  await client.connect();

  db = client.db(dbName);
  console.log("Connected to MongoDB:", db.databaseName);

  return db;
}

function getDB() {
  if (!db) throw new Error("DB not connected yet");
  return db;
}

module.exports = { connectDB, getDB };
