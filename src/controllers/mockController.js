// routes/adminRoutes.js
// All admin-only routes: create/update/delete tests + file upload

const express  = require("express");
const router   = express.Router();
const mongoose = require("mongoose");

const ListeningTest = require("../models/ListeningTest.model");
const ReadingTest   = require("../models/ReadingTest.model");
const WritingTest   = require("../models/WritingTest.model");
const FullTest      = require("../models/FullTest.model");
const TestSeries    = require("../models/TestSeries.model");

const TEST_MODELS = {
  listening: ListeningTest,
  reading:   ReadingTest,
  writing:   WritingTest,
  full:      FullTest,
};

// TODO: add admin auth middleware
// const { requireAdmin } = require("../middleware/auth");
// router.use(requireAdmin);

// ─── CREATE test  ─  POST /api/admin/tests/:type ──────────────────────────────
router.post("/tests/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const Model = TEST_MODELS[type];
    if (!Model) return res.status(400).json({ success: false, message: "Invalid type" });

    const doc = await Model.create(req.body);

    // Update series counts (non-blocking)
    updateSeriesCounts(req.body.seriesId, type).catch(console.error);

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ success: false, message: "Test with this series + number already exists" });
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── UPDATE test  ─  PUT /api/admin/tests/:type/:id ───────────────────────────
router.put("/tests/:type/:id", async (req, res) => {
  try {
    const { type, id } = req.params;
    const Model = TEST_MODELS[type];
    if (!Model) return res.status(400).json({ success: false, message: "Invalid type" });

    const doc = await Model.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });

    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── TOGGLE PUBLISH  ─  PATCH /api/admin/tests/:type/:id/publish ─────────────
router.patch("/tests/:type/:id/publish", async (req, res) => {
  try {
    const { type, id } = req.params;
    const { isPublished } = req.body;
    const Model = TEST_MODELS[type];
    if (!Model) return res.status(400).json({ success: false, message: "Invalid type" });

    const doc = await Model.findByIdAndUpdate(id, { isPublished }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });

    res.json({ success: true, data: { isPublished: doc.isPublished } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DELETE test  ─  DELETE /api/admin/tests/:type/:id ───────────────────────
router.delete("/tests/:type/:id", async (req, res) => {
  try {
    const { type, id } = req.params;
    const Model = TEST_MODELS[type];
    if (!Model) return res.status(400).json({ success: false, message: "Invalid type" });

    const doc = await Model.findByIdAndDelete(id);
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });

    updateSeriesCounts(doc.seriesId, type).catch(console.error);

    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Series CRUD ──────────────────────────────────────────────────────────────
router.post("/series", async (req, res) => {
  try {
    const doc = await TestSeries.create(req.body);
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put("/series/:id", async (req, res) => {
  try {
    const doc = await TestSeries.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete("/series/:id", async (req, res) => {
  try {
    await TestSeries.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Series deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── File upload (audio / image) ──────────────────────────────────────────────
// Using multer + cloudinary / S3. Swap in your preferred storage.
// npm install multer @aws-sdk/client-s3  OR  cloudinary multer-storage-cloudinary

router.post("/upload/audio", async (req, res) => {
  /*
   * REAL IMPLEMENTATION with Cloudinary:
   *
   * const multer = require("multer");
   * const { v2: cloudinary } = require("cloudinary");
   * const { CloudinaryStorage } = require("multer-storage-cloudinary");
   *
   * const storage = new CloudinaryStorage({
   *   cloudinary,
   *   params: { folder: "iltsmill/audio", resource_type: "video", format: "mp3" },
   * });
   * const upload = multer({ storage });
   *
   * router.post("/upload/audio", upload.single("audio"), (req, res) => {
   *   res.json({ success: true, url: req.file.path });
   * });
   *
   * ── For now: return dummy URL ─────────────────────────────────────────────
   */
  res.json({
    success: true,
    url: `/audio/placeholder-${Date.now()}.mp3`,
    message: "Dummy upload — connect Cloudinary or S3 to store real files",
  });
});

router.post("/upload/image", async (req, res) => {
  res.json({
    success: true,
    url: `/images/placeholder-${Date.now()}.jpg`,
    message: "Dummy upload — connect Cloudinary or S3",
  });
});

// ─── Helper: update series counts after test create/delete ───────────────────
async function updateSeriesCounts(seriesId, type) {
  if (!seriesId) return;
  const countMap = {
    listening: "totalListeningTests",
    reading:   "totalReadingTests",
    writing:   "totalWritingTests",
    full:      "totalFullTests",
  };
  const field = countMap[type];
  if (!field) return;

  const Model = TEST_MODELS[type];
  const count = await Model.countDocuments({ seriesId, isPublished: true });
  await TestSeries.findOneAndUpdate({ seriesId }, { [field]: count });
}

module.exports = router;