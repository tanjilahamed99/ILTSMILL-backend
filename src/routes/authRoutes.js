const { Router } = require("express");
const {
  register,
  login,
  updateProfile,
} = require("../controllers/authController");

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/update-profile", updateProfile);

module.exports = router;
