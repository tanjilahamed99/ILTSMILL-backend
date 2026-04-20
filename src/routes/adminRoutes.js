// routes/adminRoutes.js
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const ListeningTest = require("../modal/ListeningSchema");
const ReadingTest = require("../modal/ReadingModal");
const WritingTest = require("../modal/WritingModal");
const FullTest = require("../modal/FullTestModal");
const TestSeries = require("../modal/TestseriesModel");
const { uploadImage, uploadAudio } = require("../config/cloudinary");

const TEST_MODELS = {
  listening: ListeningTest,
  reading: ReadingTest,
  writing: WritingTest,
  full: FullTest,
};

// ─── Sanitize helpers ─────────────────────────────────────────────────────────
const FILL_IN_TYPES = new Set([
  "form_completion",
  "note_completion",
  "sentence_completion",
]);
const MCQ_TYPES = new Set(["mcq_single", "mcq_multiple"]);

function sanitizeQuestion(q) {
  const out = { ...q };

  if (!FILL_IN_TYPES.has(out.type)) {
    delete out.formFields;
  } else {
    if (Array.isArray(out.formFields)) {
      out.formFields = out.formFields.filter(
        (f) => f && (f.label || "").trim() !== "",
      );
      if (out.formFields.length === 0) {
        out.formFields = [{ questionNumber: out.questionNumber, label: "" }];
      }
    }
  }

  if (!MCQ_TYPES.has(out.type)) {
    delete out.options;
  } else {
    if (Array.isArray(out.options)) {
      out.options = out.options.filter(
        (o) => o && (o.label || "").trim() !== "",
      );
    }
  }

  return out;
}

function sanitizeTestData(body, type) {
  const data = { ...body };

  if (type === "listening" && Array.isArray(data.sections)) {
    data.sections = data.sections.map((section) => ({
      ...section,
      questions: Array.isArray(section.questions)
        ? section.questions.map(sanitizeQuestion)
        : [],
    }));
  }

  if (type === "reading" && Array.isArray(data.passages)) {
    data.passages = data.passages.map((passage) => ({
      ...passage,
      questionGroups: Array.isArray(passage.questionGroups)
        ? passage.questionGroups.map((group) => ({
            ...group,
            questions: Array.isArray(group.questions)
              ? group.questions.map(sanitizeQuestion)
              : [],
          }))
        : [],
    }));
  }

  return data;
}

// =============================================================================
// GET ROUTES  (admin sees everything — drafts + published, with answers)
// =============================================================================

// GET /api/admin/tests/:type?page=1&limit=10&seriesId=xxx&search=yyy
router.get("/tests/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const Model = TEST_MODELS[type];
    if (!Model)
      return res.status(400).json({ success: false, message: "Invalid type" });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const seriesId = req.query.seriesId?.trim(); // ← just add .trim()
    const search = req.query.search;

    const query = {};
    if (seriesId) query.seriesId = seriesId;
    if (search) query.title = { $regex: search, $options: "i" };

    const [tests, total] = await Promise.all([
      Model.find(query)
        .select(
          "-sections.questions.answer -passages.questionGroups.questions.answer -tasks.modelAnswer",
        )
        .sort({ seriesId: 1, testNumber: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Model.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: tests,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/tests/:type/:id  (full doc WITH answers for admin editing)
router.get("/tests/:type/:id", async (req, res) => {
  try {
    const { type, id } = req.params;
    const Model = TEST_MODELS[type];
    if (!Model)
      return res.status(400).json({ success: false, message: "Invalid type" });

    let doc;
    if (type === "full") {
      doc = await FullTest.findById(id)
        .populate("listeningTest", "title seriesId testNumber difficulty")
        .populate("readingTest", "title seriesId testNumber difficulty")
        .populate("writingTest", "title seriesId testNumber difficulty");
    } else {
      doc = await Model.findById(id); // includes answers — admin only
    }

    if (!doc)
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });

    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/series?page=1&limit=20
router.get("/series", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [series, total] = await Promise.all([
      TestSeries.find()
        .sort({ seriesNumber: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TestSeries.countDocuments(),
    ]);

    res.json({
      success: true,
      data: series,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// =============================================================================
// CREATE / UPDATE / DELETE
// =============================================================================

// POST /api/admin/tests/:type
router.post("/tests/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const Model = TEST_MODELS[type];
    if (!Model)
      return res.status(400).json({ success: false, message: "Invalid type" });

    const cleanData = sanitizeTestData(req.body, type);
    const doc = await Model.create(cleanData);

    updateSeriesCounts(req.body.seriesId, type).catch(console.error);

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({
        success: false,
        message: "Test with this series + number already exists",
      });
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/admin/tests/:type/:id
router.put("/tests/:type/:id", async (req, res) => {
  try {
    const { type, id } = req.params;
    const Model = TEST_MODELS[type];
    if (!Model)
      return res.status(400).json({ success: false, message: "Invalid type" });

    const cleanData = sanitizeTestData(req.body, type);
    const doc = await Model.findByIdAndUpdate(
      id,
      { $set: cleanData },
      { new: true, runValidators: true },
    );
    if (!doc)
      return res.status(404).json({ success: false, message: "Not found" });

    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/admin/tests/:type/:id/publish
router.patch("/tests/:type/:id/publish", async (req, res) => {
  try {
    const { type, id } = req.params;
    const { isPublished } = req.body;
    const Model = TEST_MODELS[type];
    if (!Model)
      return res.status(400).json({ success: false, message: "Invalid type" });

    const doc = await Model.findByIdAndUpdate(
      id,
      { isPublished },
      { new: true },
    );
    if (!doc)
      return res.status(404).json({ success: false, message: "Not found" });

    res.json({ success: true, data: { isPublished: doc.isPublished } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/admin/tests/:type/:id
router.delete("/tests/:type/:id", async (req, res) => {
  try {
    const { type, id } = req.params;
    const Model = TEST_MODELS[type];
    if (!Model)
      return res.status(400).json({ success: false, message: "Invalid type" });

    const doc = await Model.findByIdAndDelete(id);
    if (!doc)
      return res.status(404).json({ success: false, message: "Not found" });

    updateSeriesCounts(doc.seriesId, type).catch(console.error);

    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// =============================================================================
// SERIES CRUD
// =============================================================================

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
    const doc = await TestSeries.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true },
    );
    if (!doc)
      return res.status(404).json({ success: false, message: "Not found" });
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

// =============================================================================
// FILE UPLOADS
// =============================================================================

// Route for single audio upload
// In your route file
router.post("/upload/audio", (req, res) => {
  uploadAudio.single("audio")(req, res, async (err) => {
    // Log the actual error, not [object Object]
    if (err) {
      console.error('❌ Multer error details:', {
        message: err.message,
        code: err.code,
        stack: err.stack
      });
      return res.status(400).json({
        success: false,
        message: err.message,
        code: err.code
      });
    }
    
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No audio file provided"
        });
      }
      
      console.log('✅ File received:', {
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path
      });
      
      res.json({
        success: true,
        url: req.file.path,
        publicId: req.file.filename,
        originalName: req.file.originalname,
        message: "Audio uploaded successfully"
      });
      
    } catch (error) {
      // Log the actual error object
      console.error('❌ Upload error:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      res.status(500).json({
        success: false,
        message: error.message || "Failed to upload audio",
        errorType: error.name
      });
    }
  });
});
// Route for multiple audio uploads
router.post(
  "/upload/audios",
  uploadAudio.array("audios", 5),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No audio files provided",
        });
      }

      const uploadedFiles = req.files.map((file) => ({
        url: file.path,
        publicId: file.filename,
        duration: file.duration || null,
      }));

      res.json({
        success: true,
        files: uploadedFiles,
        count: uploadedFiles.length,
        message: `${uploadedFiles.length} audio files uploaded successfully`,
      });
    } catch (error) {
      console.error("Multiple audios upload error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to upload audio files",
      });
    }
  },
);

// single image upload route using Cloudinary
router.post("/upload/image", uploadImage.single("image"), async (req, res) => {
  console.log('called')
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    res.json({
      success: true,
      url: req.file.path, // Cloudinary URL
      publicId: req.file.filename, // Cloudinary public ID
      message: "Image uploaded successfully to Cloudinary",
    });
  } catch (error) {
    console.error("Image upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to upload image",
    });
  }
});
// Route for multiple image uploads
router.post(
  "/upload/images",
  uploadImage.array("images", 10),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No image files provided",
        });
      }

      const uploadedFiles = req.files.map((file) => ({
        url: file.path,
        publicId: file.filename,
      }));

      res.json({
        success: true,
        files: uploadedFiles,
        count: uploadedFiles.length,
        message: `${uploadedFiles.length} images uploaded successfully`,
      });
    } catch (error) {
      console.error("Multiple images upload error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to upload images",
      });
    }
  },
);

// =============================================================================
// HELPER
// =============================================================================

async function updateSeriesCounts(seriesId, type) {
  if (!seriesId) return;
  const countMap = {
    listening: "totalListeningTests",
    reading: "totalReadingTests",
    writing: "totalWritingTests",
    full: "totalFullTests",
  };
  const field = countMap[type];
  if (!field) return;

  const Model = TEST_MODELS[type];
  const count = await Model.countDocuments({ seriesId, isPublished: true });
  await TestSeries.findOneAndUpdate({ seriesId }, { [field]: count });
}

module.exports = router;
