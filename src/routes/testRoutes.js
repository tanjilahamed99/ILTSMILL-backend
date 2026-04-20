// routes/testRoutes.js
// Student-facing routes — only published tests, answers always stripped

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// const ListeningTest = require("../modal/ListeningSchema");
// const ReadingTest   = require("../modal/ReadingModal");
// const WritingTest   = require("../modal/WritingModal");
// const FullTest      = require("../modal/FullTestModal");
// const TestSeries    = require("../modal/TestseriesModel");

const ListeningTest = require("../modal/ListeningSchema");
const ReadingTest = require("../modal/ReadingModal");
const WritingTest = require("../modal/WritingModal");
const FullTest = require("../modal/FullTestModal");
const TestSeries = require("../modal/TestseriesModel");
const TestAttempt = require("../modal/Testattemptmodal");

const {
  getListeningBand,
  getReadingBand,
  calcOverallBand,
  isCorrect,
} = require("../utils/bandScore");

const TEST_MODELS = {
  listening: ListeningTest,
  reading: ReadingTest,
  writing: WritingTest,
  full: FullTest,
};

// Strip answer fields before sending to student
function stripAnswers(obj) {
  if (!obj) return obj;
  const o = typeof obj.toObject === "function" ? obj.toObject() : { ...obj };
  o.sections?.forEach((s) =>
    s.questions?.forEach((q) => {
      delete q.answer;
    }),
  );
  o.passages?.forEach((p) =>
    p.questionGroups?.forEach((g) =>
      g.questions?.forEach((q) => {
        delete q.answer;
      }),
    ),
  );
  o.tasks?.forEach((t) => {
    delete t.modelAnswer;
  });
  return o;
}

// ─── GET /api/series  (published only) ───────────────────────────────────────
router.get("/series", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [series, total] = await Promise.all([
      TestSeries.find({ isPublished: true })
        .sort({ seriesNumber: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TestSeries.countDocuments({ isPublished: true }),
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

// ─── GET /api/tests/:type  (published only) ───────────────────────────────────
router.get("/tests/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const Model = TEST_MODELS[type];
    if (!Model)
      return res.status(400).json({ success: false, message: "Invalid type" });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const seriesId = req.query.seriesId?.trim();
    const search = req.query.search?.trim();

    const query = { isPublished: true }; // ← students see published only
    if (seriesId) query.seriesId = seriesId;
    if (search) query.title = { $regex: search, $options: "i" };

    const [tests, total] = await Promise.all([
      Model.find(query)
        .select(
          "seriesId testNumber title difficulty totalDuration totalAttempts isFreeScoring sectionsAvailable",
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

// ─── GET /api/tests/:type/:id  (answers stripped) ─────────────────────────────
router.get("/tests/:type/:id", async (req, res) => {
  try {
    const { type, id } = req.params;
    const Model = TEST_MODELS[type];
    if (!Model)
      return res.status(400).json({ success: false, message: "Invalid type" });

    const doc =
      type === "full"
        ? await FullTest.findOne({ _id: id, isPublished: true })
            .populate("listeningTest")
            .populate("readingTest")
            .populate("writingTest")
        : await Model.findOne({ _id: id, isPublished: true });

    if (!doc)
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });

    res.json({ success: true, data: stripAnswers(doc) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/attempts/start ─────────────────────────────────────────────────
router.post("/attempts/start", async (req, res) => {
  try {
    console.log("called");
    const { testType, testId, userId } = req.body;
    if (!testType || !testId || !userId)
      return res.status(400).json({
        success: false,
        message: "Missing testType, testId or userId",
      });

    const Model = TEST_MODELS[testType];
    if (!Model)
      return res
        .status(400)
        .json({ success: false, message: "Invalid test type" });

    const testDoc = await Model.findById(testId).lean();
    if (!testDoc)
      return res
        .status(404)
        .json({ success: false, message: "Test not found" });

    // Resume in_progress attempt if exists
    const existing = await TestAttempt.findOne({
      userId,
      [`${testType}TestId`]: testId,
      status: "in_progress",
    });
    if (existing)
      return res.json({
        success: true,
        attemptId: existing._id,
        resumed: true,
      });

    const attempt = await TestAttempt.create({
      userId,
      testType,
      [`${testType}TestId`]: testId,
      seriesId: testDoc.seriesId,
      testNumber: testDoc.testNumber,
      testTitle: testDoc.title,
      startedAt: new Date(),
      status: "in_progress",
    });

    res
      .status(201)
      .json({ success: true, attemptId: attempt._id, resumed: false });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── PUT /api/attempts/:attemptId/save  (auto-save) ──────────────────────────
router.put("/attempts/:attemptId/save", async (req, res) => {
  try {
    const attempt = await TestAttempt.findById(req.params.attemptId);
    if (!attempt)
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found" });
    if (attempt.status !== "in_progress")
      return res
        .status(400)
        .json({ success: false, message: "Already submitted" });

    // Merge answers
    const existing = Object.fromEntries(attempt.answers || new Map());
    attempt.answers = new Map(
      Object.entries({ ...existing, ...(req.body.answers || {}) }),
    );

    if (req.body.writingResponses?.length) {
      attempt.writingTaskResults = req.body.writingResponses.map((r) => ({
        taskNumber: r.taskNumber,
        responseText: r.responseText,
        wordCount:
          r.responseText?.trim().split(/\s+/).filter(Boolean).length || 0,
      }));
    }

    await attempt.save();
    res.json({ success: true, message: "Saved" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/attempts/:attemptId/submit ─────────────────────────────────────
router.post("/attempts/:attemptId/submit", async (req, res) => {
  try {
    const attempt = await TestAttempt.findById(req.params.attemptId);
    if (!attempt)
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found" });
    if (attempt.status !== "in_progress")
      return res
        .status(400)
        .json({ success: false, message: "Already submitted" });

    const { answers = {}, writingResponses = [], timeSpent = 0 } = req.body;
    const merged = {
      ...Object.fromEntries(attempt.answers || new Map()),
      ...answers,
    };
    attempt.answers = new Map(Object.entries(merged));
    attempt.timeSpent = timeSpent;
    attempt.submittedAt = new Date();

    const bands = [];

    // Score listening
    if (attempt.testType === "listening" || attempt.listeningTestId) {
      const testDoc = await ListeningTest.findById(
        attempt.listeningTestId ||
          (attempt.testType === "listening" &&
            (await TestAttempt.findById(attempt._id).select(
              "listeningTestId",
            ))),
      );
      if (testDoc) {
        let totalCorrect = 0;
        const sectionScores = [];
        testDoc.sections.forEach((s) => {
          let sc = 0;
          s.questions.forEach((q) => {
            if (isCorrect(merged[String(q.questionNumber)], q.answer)) {
              totalCorrect++;
              sc++;
            }
          });
          sectionScores.push({
            sectionNumber: s.partNumber,
            correct: sc,
            total: s.questions.length,
          });
        });
        attempt.listeningScore = totalCorrect;
        attempt.listeningBand = getListeningBand(totalCorrect);
        attempt.listeningSectionScores = sectionScores;
        bands.push(attempt.listeningBand);
      }
    }

    // Score reading
    if (attempt.testType === "reading" || attempt.readingTestId) {
      const testDoc = await ReadingTest.findById(attempt.readingTestId);
      if (testDoc) {
        let totalCorrect = 0;
        const sectionScores = [];
        testDoc.passages.forEach((p) => {
          let sc = 0;
          p.questionGroups?.forEach((g) =>
            g.questions?.forEach((q) => {
              if (isCorrect(merged[String(q.questionNumber)], q.answer)) {
                totalCorrect++;
                sc++;
              }
            }),
          );
          sectionScores.push({
            sectionNumber: p.passageNumber,
            correct: sc,
            total: p.questionRange.to - p.questionRange.from + 1,
          });
        });
        attempt.readingScore = totalCorrect;
        attempt.readingBand = getReadingBand(totalCorrect, testDoc.testType);
        attempt.readingSectionScores = sectionScores;
        bands.push(attempt.readingBand);
      }
    }

    // Store writing
    if (writingResponses.length > 0) {
      attempt.writingTaskResults = writingResponses.map((r) => ({
        taskNumber: r.taskNumber,
        responseText: r.responseText,
        wordCount:
          r.responseText?.trim().split(/\s+/).filter(Boolean).length || 0,
        scoredBy: "none",
      }));
    }

    if (bands.length > 0) attempt.overallBand = calcOverallBand(bands);

    attempt.status = "submitted";
    await attempt.save();

    res.json({
      success: true,
      result: {
        attemptId: attempt._id,
        listeningBand: attempt.listeningBand || null,
        readingBand: attempt.readingBand || null,
        writingBand: null,
        overallBand: attempt.overallBand || null,
        listeningScore: attempt.listeningScore || null,
        readingScore: attempt.readingScore || null,
        totalQuestions: 40,
        listeningSectionScores: attempt.listeningSectionScores || [],
        readingSectionScores: attempt.readingSectionScores || [],
        writingPending: writingResponses.length > 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/attempts/:attemptId/result  (reveals correct answers) ───────────
router.get("/attempts/:attemptId/result", async (req, res) => {
  try {
    const attempt = await TestAttempt.findById(req.params.attemptId)
      .populate("listeningTestId")
      .populate("readingTestId")
      .populate("writingTestId");
    if (!attempt)
      return res.status(404).json({ success: false, message: "Not found" });
    if (attempt.status === "in_progress")
      return res
        .status(400)
        .json({ success: false, message: "Not submitted yet" });

    const correctAnswers = {};
    attempt.listeningTestId?.sections?.forEach((s) =>
      s.questions?.forEach((q) => {
        correctAnswers[q.questionNumber] = q.answer;
      }),
    );
    attempt.readingTestId?.passages?.forEach((p) =>
      p.questionGroups?.forEach((g) =>
        g.questions?.forEach((q) => {
          correctAnswers[q.questionNumber] = q.answer;
        }),
      ),
    );

    res.json({
      success: true,
      data: {
        attempt,
        userAnswers: Object.fromEntries(attempt.answers || new Map()),
        correctAnswers,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/attempts/:attemptId/submit ─────────────────────────────────────
// FIXED: now returns correctAnswers + per-question breakdown immediately
router.post("/attempts/:attemptId/submit", async (req, res) => {
  try {
    const attempt = await TestAttempt.findById(req.params.attemptId);
    if (!attempt)
      return res
        .status(404)
        .json({ success: false, message: "Attempt not found" });
    if (attempt.status !== "in_progress")
      return res
        .status(400)
        .json({ success: false, message: "Already submitted" });

    const { answers = {}, writingResponses = [], timeSpent = 0 } = req.body;

    // Merge saved + final answers
    const merged = {
      ...Object.fromEntries(attempt.answers || new Map()),
      ...answers,
    };
    attempt.answers = new Map(Object.entries(merged));
    attempt.timeSpent = timeSpent;
    attempt.submittedAt = new Date();

    const bands = [];
    const correctAnswers = {}; // { "1": "James", "15": "B" }
    const questionResults = []; // per-question breakdown for frontend

    // ── Score Listening ────────────────────────────────────────────────────
    if (attempt.testType === "listening" && attempt.listeningTestId) {
      const testDoc = await ListeningTest.findById(attempt.listeningTestId);
      if (testDoc) {
        let totalCorrect = 0;
        const sectionScores = [];

        testDoc.sections.forEach((section) => {
          let sectionCorrect = 0;
          section.questions.forEach((q) => {
            const qNum = String(q.questionNumber);
            const userAns = String(merged[qNum] || "").trim();
            const correct = isCorrect(userAns, q.answer);
            const isSkipped = userAns === "";

            correctAnswers[q.questionNumber] = Array.isArray(q.answer)
              ? q.answer.join(" / ")
              : q.answer;

            questionResults.push({
              questionNumber: q.questionNumber,
              userAnswer: userAns,
              correctAnswer: correctAnswers[q.questionNumber],
              isCorrect: correct,
              isSkipped,
            });

            if (correct) {
              totalCorrect++;
              sectionCorrect++;
            }
          });

          sectionScores.push({
            sectionNumber: section.partNumber,
            correct: sectionCorrect,
            total: section.questions.length,
          });
        });

        attempt.listeningScore = totalCorrect;
        attempt.listeningBand = getListeningBand(totalCorrect);
        attempt.listeningSectionScores = sectionScores;
        bands.push(attempt.listeningBand);
      }
    }

    // ── Score Reading ──────────────────────────────────────────────────────
    if (attempt.testType === "reading" && attempt.readingTestId) {
      const testDoc = await ReadingTest.findById(attempt.readingTestId);
      if (testDoc) {
        let totalCorrect = 0;
        const sectionScores = [];

        testDoc.passages.forEach((passage) => {
          let passageCorrect = 0;
          passage.questionGroups?.forEach((group) => {
            group.questions?.forEach((q) => {
              const qNum = String(q.questionNumber);
              const userAns = String(merged[qNum] || "").trim();
              const correct = isCorrect(userAns, q.answer);
              const isSkipped = userAns === "";

              correctAnswers[q.questionNumber] = Array.isArray(q.answer)
                ? q.answer.join(" / ")
                : q.answer;

              questionResults.push({
                questionNumber: q.questionNumber,
                userAnswer: userAns,
                correctAnswer: correctAnswers[q.questionNumber],
                isCorrect: correct,
                isSkipped,
              });

              if (correct) {
                totalCorrect++;
                passageCorrect++;
              }
            });
          });

          sectionScores.push({
            sectionNumber: passage.passageNumber,
            correct: passageCorrect,
            total: passage.questionRange.to - passage.questionRange.from + 1,
          });
        });

        attempt.readingScore = totalCorrect;
        attempt.readingBand = getReadingBand(totalCorrect, testDoc.testType);
        attempt.readingSectionScores = sectionScores;
        bands.push(attempt.readingBand);
      }
    }

    // ── Store Writing (no auto-score) ──────────────────────────────────────
    if (writingResponses.length > 0) {
      attempt.writingTaskResults = writingResponses.map((r) => ({
        taskNumber: r.taskNumber,
        responseText: r.responseText,
        wordCount:
          r.responseText?.trim().split(/\s+/).filter(Boolean).length || 0,
        scoredBy: "none",
      }));
    }

    if (bands.length > 0) attempt.overallBand = calcOverallBand(bands);

    attempt.status = "submitted";
    await attempt.save();

    // ── Return everything the frontend needs for the result modal ──────────
    res.json({
      success: true,
      result: {
        attemptId: attempt._id,
        // Scores
        listeningBand: attempt.listeningBand || null,
        readingBand: attempt.readingBand || null,
        writingBand: null,
        overallBand: attempt.overallBand || null,
        listeningScore: attempt.listeningScore || null,
        readingScore: attempt.readingScore || null,
        totalQuestions: questionResults.length || 40,
        // Section breakdowns
        listeningSectionScores: attempt.listeningSectionScores || [],
        readingSectionScores: attempt.readingSectionScores || [],
        // Per-question detail for the modal
        questionResults, // [{ questionNumber, userAnswer, correctAnswer, isCorrect, isSkipped }]
        correctAnswers, // { "1": "James", ... }
        // Writing
        writingPending: writingResponses.length > 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/attempts?userId=&testType= ──────────────────────────────────────
router.get("/attempts", async (req, res) => {
  try {
    const { userId, testType, status } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {};
    if (userId) query.userId = userId;
    if (testType) query.testType = testType;
    if (status) query.status = status;

    const [attempts, total] = await Promise.all([
      TestAttempt.find(query)
        .select(
          "testType testTitle seriesId testNumber status listeningBand readingBand writingBand overallBand submittedAt timeSpent",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      TestAttempt.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: attempts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
