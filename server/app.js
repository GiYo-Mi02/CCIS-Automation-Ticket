require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const { requireAuth } = require("./middleware/auth");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/admin");
const scannerRoutes = require("./routes/scanner");

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
  ],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    fallthrough: true,
  })
);

// ── Public routes (no auth required) ──
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth routes are partially public (check-access verifies the token itself)
app.use("/api/auth", authRoutes);

// ── Protected routes (require valid JWT + whitelisted email) ──
app.use("/api/admin", requireAuth, adminRoutes);
app.use("/api/scanner", requireAuth, scannerRoutes);

// ── Global error handler ──
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
