const mongoose = require("mongoose");
const { Router } = require("express");

const {
  getListeningBand,
  getReadingBand,
  calcOverallBand,
  isCorrect,
} = require("../utils/bandScore");
const {
  getTestAttempts,
  getTestSeries,
  getTestsByType,
  getTestById,
  startTestAttempt,
  saveTestAttempt,
  getTestAttemptResult,
  submitTestAttempt,
  getTotalAttempt,
} = require("../controllers/testController");

const router = Router();

router.get("/series", getTestSeries);
router.get("/:type", getTestsByType);
router.get("/:type/:id", getTestById);
router.post("/attempts/start", startTestAttempt);
router.put("/attempts/:attemptId/save", saveTestAttempt);
router.get("/attempts/:attemptId/result", getTestAttemptResult);
router.post("/attempts/:attemptId/submit", submitTestAttempt);
router.get("/attempts", getTestAttempts);
router.get("/totalAttempt/:userId", getTotalAttempt);


module.exports = router;
