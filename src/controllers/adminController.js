const mongoose = require("mongoose");

const ListeningTest = require("../modal/ListeningSchema");
const ReadingTest = require("../modal/ReadingModal");
const WritingTest = require("../modal/WritingModal");
const FullTest = require("../modal/FullTestModal");
const TestSeries = require("../modal/TestseriesModel");
const { uploadImage, uploadAudio } = require("../config/cloudinary");
const FullTestModal = require("../modal/FullTestModal");
const { ReadingSelfPractice } = require("../modal/ReadingSelfPractice");
const { WritingPractice } = require("../modal/WritingSelfPractice");

const TEST_MODELS = {
  listening: ListeningTest,
  reading: ReadingTest,
  writing: WritingTest,
  "full-test": FullTest,
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
      // out.formFields = out.formFields.filter(
      //   (f) => f && (f.label || "").trim() !== "",
      // );
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

exports.getTestsByType = async (req, res) => {
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
};

exports.getTestById = async (req, res) => {
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
};

exports.getSeries = async (req, res) => {
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
};

exports.createTest = async (req, res) => {
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
};

exports.updateTest = async (req, res) => {
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
};

exports.updateTestPublishStatus = async (req, res) => {
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
};

exports.deleteTest = async (req, res) => {
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
};

exports.createSeries = async (req, res) => {
  try {
    await TestSeries.create(req.body);
    const doc = await FullTestModal.create(req.body);
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSeries = async (req, res) => {
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
};

exports.deleteSeries = async (req, res) => {
  try {
    await TestSeries.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Series deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.uploadSingleAudio = (req, res) => {
  uploadAudio.single("audio")(req, res, async (err) => {
    // Log the actual error, not [object Object]
    if (err) {
      console.error("❌ Multer error details:", {
        message: err.message,
        code: err.code,
        stack: err.stack,
      });
      return res.status(400).json({
        success: false,
        message: err.message,
        code: err.code,
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No audio file provided",
        });
      }
      res.json({
        success: true,
        url: req.file.path,
        publicId: req.file.filename,
        originalName: req.file.originalname,
        message: "Audio uploaded successfully",
      });
    } catch (error) {
      // Log the actual error object
      console.error("❌ Upload error:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      res.status(500).json({
        success: false,
        message: error.message || "Failed to upload audio",
        errorType: error.name,
      });
    }
  });
};

exports.uploadMultipleAudios = async (req, res) => {
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
};

exports.uploadSingleImage = (req, res) => {
  uploadImage.single("image")(req, res, async (err) => {
    // Log any multer/Cloudinary errors
    if (err) {
      console.error("❌ Upload error details:", {
        message: err.message,
        name: err.name,
        stack: err.stack,
      });
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image file provided",
        });
      }

      if (!req.file.path) {
        return res.status(500).json({
          success: false,
          message: "File uploaded but Cloudinary URL not generated",
          file: req.file,
        });
      }

      res.json({
        success: true,
        url: req.file.path,
        publicId: req.file.filename,
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
};

exports.uploadMultipleImages = async (req, res) => {
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
};

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

// ─── CREATE ─────────────────────────────────────────────────────────────────
exports.createSelfReadingTest = async (req, res) => {
  try {
    const { title, level, category, time, passage, difficulty } = req.body;
    const { type } = req.params;

    // Validate required fields
    if (!title || !category || !time || !type) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: title, category, time, passage, type",
      });
    }

    let data;

    if (type === "reading") {
      // Create the reading test
      data = new ReadingSelfPractice(req.body);
      await data.save();
    } else if (type === "writing") {
      data = new WritingPractice(req.body);
      await data.save();
    }
    res.status(201).json({
      success: true,
      message: "test created successfully",
      data,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── UPDATE ─────────────────────────────────────────────────────────────────
exports.updateSelfReadingTest = async (req, res) => {
  try {
    const { id, type } = req.params;
    const updateData = req.body;

    let updatedTest;

    if (type === "reading") {
      // Check if test exists
      const existingTest = await ReadingSelfPractice.findById(id);
      if (!existingTest) {
        return res.status(404).json({
          success: false,
          message: "Reading test not found",
        });
      }

      // Fields that shouldn't be updated directly
      const restrictedFields = ["_id", "createdAt", "updatedAt"];
      restrictedFields.forEach((field) => delete updateData[field]);

      updatedTest = await ReadingSelfPractice.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true },
      );
    } else if (type === "writing") {
      // Check if test exists
      const existingTest = await WritingPractice.findById(id);
      if (!existingTest) {
        return res.status(404).json({
          success: false,
          message: "Reading test not found",
        });
      }

      // Fields that shouldn't be updated directly
      const restrictedFields = ["_id", "createdAt", "updatedAt"];
      restrictedFields.forEach((field) => delete updateData[field]);

      updatedTest = await WritingPractice.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });
    }

    res.json({
      success: true,
      message: "Reading test updated successfully",
      data: updatedTest,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE ─────────────────────────────────────────────────────────────────
exports.deleteSelfReadingTest = async (req, res) => {
  try {
    const { id, type } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid test ID format",
      });
    }

    if (type === "reading") {
      const test = await ReadingSelfPractice.findById(id);
      if (!test) {
        return res.status(404).json({
          success: false,
          message: "Reading test not found",
        });
      }

      await ReadingSelfPractice.findByIdAndDelete(id);
    } else if (type === "writing") {
      const test = await WritingPractice.findById(id);
      if (!test) {
        return res.status(404).json({
          success: false,
          message: "Reading test not found",
        });
      }

      await WritingPractice.findByIdAndDelete(id);
    }

    res.json({
      success: true,
      message: "Reading test deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
