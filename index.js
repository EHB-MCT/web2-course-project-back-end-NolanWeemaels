require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { connectDB } = require("./db");
const { port } = require("./config");

const app = express();
app.use(cors());
app.use(express.json());

// health
app.get("/", (req, res) => {
  res.send({ message: "Fritkot GP API running" });
});

// DB connect
connectDB().catch((err) => {
  console.error("DB connect error:", err);
  process.exit(1);
});

app.listen(port, () => console.log(`✅ Server running on http://localhost:${port}`));
