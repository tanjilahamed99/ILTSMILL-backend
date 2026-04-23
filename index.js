const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());
require("dotenv").config();
app.use(express.urlencoded({ extended: true })); // Parses URL-encoded bodies
const connectDB = require("./src/db/db");
connectDB();

const authRoutes = require("./src/routes/authRoutes");
const adminRoutes = require("./src/routes/adminRoutes");
const testRoutes = require("./src/routes/testRoutes");


app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/test", testRoutes);

app.listen(port, () => {
  console.log(`welcome to iltsmill website`);
});
