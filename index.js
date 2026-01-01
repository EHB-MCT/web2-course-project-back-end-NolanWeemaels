require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");

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

// Commit 18 helper
function requireFields(res, body, fields) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || body[f] === "") {
      res.status(400).send({ message: `Missing ${f}` });
      return false;
    }
  }
  return true;
}

// Commit 21 helpers
function randBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function simulate(trackLengthKm) {
  const speedKmh = randBetween(250, 300);
  const pitStopSec = randBetween(20, 25);
  const travelTimeSec = (trackLengthKm / speedKmh) * 3600;
  const totalSec = travelTimeSec + pitStopSec;

  return {
    speedKmh: Number(speedKmh.toFixed(2)),
    pitStopSec: Number(pitStopSec.toFixed(2)),
    travelTimeSec: Number(travelTimeSec.toFixed(2)),
    lapTimeMs: Math.round(totalSec * 1000)
  };
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

    // Easter egg
    if (String(username).toLowerCase() === "frietkoning") {
      if (req.headers["x-secret-sauce"] !== "andalouse") {
        return res
          .status(400)
          .send({ message: "Secret validation: x-secret-sauce=andalouse missing" });
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

// TEAMS: list
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

// TEAMS: detail
app.get("/teams/:id", async (req, res) => {
  try {
    await seedIfEmpty();
    const db = getDB();
    const team = await db.collection("teams").findOne({ _id: new ObjectId(req.params.id) });
    if (!team) return res.status(404).send({ message: "Team not found" });
    res.send(team);
  } catch {
    res.status(400).send({ message: "Invalid id" });
  }
});

// TRACKS: list
app.get("/tracks", async (req, res) => {
  try {
    await seedIfEmpty();
    const db = getDB();
    const tracks = await db.collection("tracks").find({}).sort({ lengthKm: -1 }).toArray();
    res.send(tracks);
  } catch (e) {
    console.error(e);
    res.status(500).send({ message: "Server error" });
  }
});

// TRACKS: detail
app.get("/tracks/:id", async (req, res) => {
  try {
    await seedIfEmpty();
    const db = getDB();
    const track = await db.collection("tracks").findOne({ _id: new ObjectId(req.params.id) });
    if (!track) return res.status(404).send({ message: "Track not found" });
    res.send(track);
  } catch {
    res.status(400).send({ message: "Invalid id" });
  }
});

// RACES: simulate + save best (Commit 23)
app.post("/races/simulate", auth, async (req, res) => {
  try {
    await seedIfEmpty();

    const { teamId, trackId, save } = req.body;
    if (!requireFields(res, req.body, ["teamId", "trackId"])) return;

    const db = getDB();
    const team = await db.collection("teams").findOne({ _id: new ObjectId(teamId) });
    const track = await db.collection("tracks").findOne({ _id: new ObjectId(trackId) });

    if (!team) return res.status(404).send({ message: "Team not found" });
    if (!track) return res.status(404).send({ message: "Track not found" });

    const result = simulate(track.lengthKm);

    if (save === true) {
      const races = db.collection("races");

      const filter = { userId: req.user.id, teamId, trackId };
      const existing = await races.findOne(filter);

      const payload = {
        userId: req.user.id,
        username: req.user.username,
        teamId,
        teamName: team.name,
        trackId,
        trackCity: track.city,
        ...result,
        createdAt: new Date()
      };

      if (!existing) {
        const created = await races.insertOne(payload);
        return res.status(201).send({ status: "created", id: created.insertedId, result });
      }

      if (result.lapTimeMs < existing.lapTimeMs) {
        await races.updateOne({ _id: existing._id }, { $set: payload });
        return res.status(200).send({ status: "updated", id: existing._id, result });
      }

      return res.status(200).send({ status: "ignored", id: existing._id, result });
    }

    return res.send({
      status: "simulated",
      result,
      team: { id: team._id.toString(), name: team.name },
      track: { id: track._id.toString(), city: track.city, lengthKm: track.lengthKm }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).send({ message: "Server error" });
  }
});

app.get("/races", auth, async (req, res) => {
  try {
    const db = getDB();
    const races = db.collection("races");

    const sortBy = req.query.sortBy || "latest";
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    const sort = sortBy === "fastest" ? { lapTimeMs: 1 } : { createdAt: -1 };

    const list = await races
      .find({ userId: req.user.id })
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .toArray();

    res.send(list);
  } catch (e) {
    console.error(e);
    res.status(500).send({ message: "Server error" });
  }
});

app.get("/races/:id", auth, async (req, res) => {
  try {
    const db = getDB();
    const race = await db.collection("races").findOne({ _id: new ObjectId(req.params.id) });
    if (!race) return res.status(404).send({ message: "Race not found" });
    if (race.userId !== req.user.id) return res.status(403).send({ message: "No access" });
    res.send(race);
  } catch {
    res.status(400).send({ message: "Invalid id" });
  }
});

app.delete("/races/:id", auth, async (req, res) => {
  try {
    const db = getDB();
    const races = db.collection("races");

    const race = await races.findOne({ _id: new ObjectId(req.params.id) });
    if (!race) return res.status(404).send({ message: "Race not found" });
    if (race.userId !== req.user.id) return res.status(403).send({ message: "No access" });

    await races.deleteOne({ _id: race._id });
    res.send({ message: "Race deleted" });
  } catch {
    res.status(400).send({ message: "Invalid id" });
  }
});

// DB connect
connectDB().catch((err) => {
  console.error("DB connect error:", err);
  process.exit(1);
});

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
