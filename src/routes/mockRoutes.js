const { Router } = require("express");
const {
  getMockTest,
  getFullTest,
  getListeningTest,
  getReadingTest,
  getSpeakingTest,
  getWritingTest,
} = require("../controllers/mockController");

const router = Router();

// public routes
router.get("/mock", getMockTest);
router.get("/mock/full-test/:id", getFullTest);
router.get("/mock/listening/:id", getListeningTest);
router.get("/mock/reading/:id", getReadingTest);
router.get("/mock/writing/:id", getWritingTest);
router.get("/mock/speaking/:id", getSpeakingTest);

module.exports = router;
