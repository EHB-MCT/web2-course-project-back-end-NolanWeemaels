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


function signToken(payload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiresIn });
}

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Missing Bearer token" });
  }

  const token = header.split(" ")[1];

  try {
    req.user = jwt.verify(token, jwtSecret); // { id, username, email }
    next();
  } catch {
    return res.status(401).send({ message: "Invalid token" });
  }
}

// health
app.get("/", (req, res) => {
  res.send({ message: "Fritkot GP API running" });
});

// AUTH: register
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

      const token = signToken({
        id: result.insertedId.toString(),
        username: doc.username,
        email: doc.email
      });

      return res.status(201).send({
        user: { id: result.insertedId.toString(), username: doc.username, email: doc.email },
        token
      });
    });
  } catch (e) {
    console.error(e);
    return res.status(500).send({ message: "Server error" });
  }
});

// AUTH: login
app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).send({ message: "Missing email or password" });
    }

    const db = getDB();
    const users = db.collection("users");

    const user = await users.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(401).send({ message: "Invalid credentials" });

    bcrypt.compare(password, user.password, (err, ok) => {
      if (err) return res.status(500).send({ message: "Compare failed" });
      if (!ok) return res.status(401).send({ message: "Invalid credentials" });

      const token = signToken({
        id: user._id.toString(),
        username: user.username,
        email: user.email
      });

      return res.send({
        user: { id: user._id.toString(), username: user.username, email: user.email },
        token
      });
    });
  } catch (e) {
    console.error(e);
    return res.status(500).send({ message: "Server error" });
  }
});

// DB connect
connectDB().catch((err) => {
  console.error("DB connect error:", err);
  process.exit(1);
});

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
