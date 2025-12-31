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
app.post("/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).send({ message: "Missing username, email or password" });
    }
    if (String(password).length < 6) {
      return res.status(400).send({ message: "Password must be at least 6 characters" });
    }

    const db = getDB();
    const users = db.collection("users");

    const exists = await users.findOne({ email: String(email).toLowerCase() });
    if (exists) return res.status(409).send({ message: "Email already exists" });

    bcrypt.hash(password, 10, async (err, hash) => {
  if (err) return res.status(500).send({ message: "Hashing failed" });

  const doc = {
    username: String(username).trim(),
    email: String(email).toLowerCase().trim(),
    password: hash,
    createdAt: new Date()
  };

  const result = await users.insertOne(doc);

  res.status(201).send({
    user: { id: result.insertedId.toString(), username: doc.username, email: doc.email },
    message: "Register ok"
  });
});

  } catch (e) {
    console.error(e);
    res.status(500).send({ message: "Server error" });
  }
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
