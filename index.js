require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { connectDB, getDB } = require("./db");
const { port, jwtSecret, jwtExpiresIn } = require("./config");

const app = express();
app.use(cors());
app.use(express.json());

// health
app.get("/", (req, res) => {
  res.send({ message: "Fritkot GP API running" });
});

// --- WIP auth routes
app.post("/auth/register", (req, res) => {
  res.status(501).send({ message: "WIP: register not implemented yet" });
});

app.post("/auth/login", (req, res) => {
  res.status(501).send({ message: "WIP: login not implemented yet" });
});

// DB connect
connectDB().catch((err) => {
  console.error("DB connect error:", err);
  process.exit(1);
});

app.listen(port, () => console.log(`✅ Server running on http://localhost:${port}`));
