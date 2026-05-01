const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Load environment variables ONCE at the top
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
const connectDB = require("./src/db/db");
connectDB();

// Routes
const authRoutes = require("./src/routes/authRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const testRoutes = require("./src/routes/testRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/test", testRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ message: "welcome to iltsmill website" });
});

// ✅ CRITICAL: Export for Vercel serverless function
module.exports = app;

// ✅ Only listen locally (not on Vercel)
if (process.env.NODE_ENV !== "production") {
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}
