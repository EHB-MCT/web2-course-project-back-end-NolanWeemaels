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

async function seedIfEmpty() {
  const db = getDB();
  const teamsCol = db.collection("teams");
  const tracksCol = db.collection("tracks");

  const teamCount = await teamsCol.countDocuments();
  if (teamCount === 0) {
    await teamsCol.insertMany([
      { name: "Mercedes", description: "Silver friet arrows." },
      { name: "Ferrari", description: "Rosso friet." },
      { name: "McLaren", description: "Paprika-orange performance." },
      { name: "RedBull", description: "Energy + extra zout." },
      { name: "Racing Bulls", description: "Junior bulls met snackpower." },
      { name: "Sauber", description: "Clean lap, clean sauce." },
      { name: "Haas", description: "No-nonsense frit engineering." },
      { name: "Aston Martin", description: "Green & crispy." },
      { name: "Alpine", description: "Cool blue, hot fries." },
      { name: "Williams", description: "Classic speed." },
      { name: "Racefriet GP", description: "Eigen team: de friet-legende." }
    ]);
  }

  const trackCount = await tracksCol.countDocuments();
  if (trackCount === 0) {
    await tracksCol.insertMany([
      { name: "Ronde 1", city: "Galmaarden", lengthKm: 5.7 },
      { name: "Ronde 2", city: "Knokke", lengthKm: 1.2 },
      { name: "Finale", city: "Brussel", lengthKm: 1.3 }
    ]);
  }

  // Indexes (zodat updateBest later makkelijk wordt)
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("teams").createIndex({ name: 1 }, { unique: true });
  await db.collection("tracks").createIndex({ name: 1 }, { unique: true });
  await db.collection("races").createIndex(
    { userId: 1, teamId: 1, trackId: 1 },
    { unique: true }
  );
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
    //Easter egg
    if (String(username).toLowerCase() === "frietkoning") {
  if (req.headers["x-secret-sauce"] !== "andalouse") {
    return res.status(400).send({ message: "Secret validation: x-secret-sauce=andalouse missing" });
  }
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

app.get("/teams", async (req, res) => {
  try {
    await seedIfEmpty();
    const db = getDB();
    const teams = await db.collection("teams").find({}).sort({ name: 1 }).toArray();
    res.send(teams);
  } catch (e) {
    console.error(e);
    res.status(500).send({ message: "Server error" });
  }
});

// DB connect
connectDB().catch((err) => {
  console.error("DB connect error:", err);
  process.exit(1);
});

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
