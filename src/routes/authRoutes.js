const express = require("express");
const {
  register,
  login,
  getProfile,
  forgotPassword,
  resetPassword,
  changePassword,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { getTotalAttempt } = require("../controllers/testController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/profile", protect, getProfile);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/change-password", changePassword);

router.get("/totalAttempt/:userId", protect, getTotalAttempt);

module.exports = router;
