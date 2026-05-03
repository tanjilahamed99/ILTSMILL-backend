// routes/adminRoutes.js
const express = require("express");
const router = express.Router();

const { uploadImage, uploadAudio } = require("../config/cloudinary");
const {
  getTestsByType,
  getTestById,
  createSeries,
  createTest,
  deleteSeries,
  deleteTest,
  getSeries,
  updateSeries,
  updateTest,
  updateTestPublishStatus,
  uploadMultipleAudios,
  uploadMultipleImages,
  uploadSingleAudio,
  uploadSingleImage,
  createSelfReadingTest,
  updateSelfReadingTest,
  deleteSelfReadingTest,
} = require("../controllers/adminController");

router.get("/tests/:type", getTestsByType);
router.get("/test/:type/:id", getTestById);
router.get("/series", getSeries);
router.post("/tests/:type", createTest);
router.put("/tests/:type/:id", updateTest);
router.patch("/tests/:type/:id/publish", updateTestPublishStatus);
router.delete("/tests/:type/:id", deleteTest);
router.post("/series", createSeries);
router.put("/series/:id", updateSeries);
router.delete("/series/:id", deleteSeries);
router.post("/upload/audio", uploadSingleAudio);
router.post(
  "/upload/audios",
  uploadAudio.array("audios", 5),
  uploadMultipleAudios,
);
router.post("/upload/image", uploadSingleImage);
router.post(
  "/upload/images",
  uploadImage.array("images", 10),
  uploadMultipleImages,
);

// self practice

router.post("/selfPractice/:type", createSelfReadingTest);
router.put("/selfPractice/:type/:id", updateSelfReadingTest);
router.delete("/selfPractice/:type/:id", deleteSelfReadingTest);

module.exports = router;
