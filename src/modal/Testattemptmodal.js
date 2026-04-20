const mongoose = require("mongoose");
const { Schema } = mongoose;

const SectionScoreSchema = new Schema(
  {
    sectionNumber: { type: Number, required: true },
    correct: { type: Number, default: 0 },
    total: { type: Number, default: 10 },
    bandScore: { type: Number, default: 0 },
  },
  { _id: false },
);

const WritingTaskResultSchema = new Schema(
  {
    taskNumber: { type: Number, required: true },
    responseText: { type: String, default: "" },
    wordCount: { type: Number, default: 0 },
    bandScore: { type: Number, default: 0 },
    taskAchievement: { type: Number, default: 0 },
    coherenceCohesion: { type: Number, default: 0 },
    lexicalResource: { type: Number, default: 0 },
    grammaticalRange: { type: Number, default: 0 },
    feedback: { type: String, default: "" },
    scoredBy: { type: String, enum: ["none", "ai", "manual"], default: "none" },
    scoredAt: { type: Date },
  },
  { _id: false },
);

const TestAttemptSchema = new Schema(
  {
    // ── Who ───────────────────────────────────────────────────────────────────
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ── Which test type ───────────────────────────────────────────────────────
    testType: {
      type: String,
      required: true,
      enum: ["full", "listening", "reading", "writing"],
    },

    // ── Which test (one of these will be set) ─────────────────────────────────
    fullTestId: { type: Schema.Types.ObjectId, ref: "FullTest", default: null },
    listeningTestId: {
      type: Schema.Types.ObjectId,
      ref: "ListeningTest",
      default: null,
    },
    readingTestId: {
      type: Schema.Types.ObjectId,
      ref: "ReadingTest",
      default: null,
    },
    writingTestId: {
      type: Schema.Types.ObjectId,
      ref: "WritingTest",
      default: null,
    },

    // Denormalised for fast display (no populate needed)
    seriesId: { type: String, default: "" },
    testNumber: { type: Number, default: 0 },
    testTitle: { type: String, default: "" },

    // ── Session ───────────────────────────────────────────────────────────────
    startedAt: { type: Date, required: true, default: Date.now },
    submittedAt: { type: Date, default: null },
    timeSpent: { type: Number, default: 0 }, // seconds

    status: {
      type: String,
      enum: ["in_progress", "submitted", "scored", "abandoned"],
      default: "in_progress",
    },

    // ── Listening + Reading answers ───────────────────────────────────────────
    // { "1": "James", "2": "fiction", "15": "B", "32": ["C","E"] }
    answers: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },

    // ── Listening scores ──────────────────────────────────────────────────────
    listeningScore: { type: Number, default: null },
    listeningBand: { type: Number, default: null },
    listeningSectionScores: { type: [SectionScoreSchema], default: undefined },

    // ── Reading scores ────────────────────────────────────────────────────────
    readingScore: { type: Number, default: null },
    readingBand: { type: Number, default: null },
    readingSectionScores: { type: [SectionScoreSchema], default: undefined },

    // ── Writing scores ────────────────────────────────────────────────────────
    writingBand: { type: Number, default: null },
    writingTaskResults: { type: [WritingTaskResultSchema], default: undefined },

    // ── Overall (Full Test) ───────────────────────────────────────────────────
    overallBand: { type: Number, default: null },

    // ── Admin flags ───────────────────────────────────────────────────────────
    flagged: { type: Boolean, default: false },
    flagReason: { type: String, default: "" },
  },
  { timestamps: true },
);

// Indexes for dashboard + history queries
TestAttemptSchema.index({ userId: 1, testType: 1, createdAt: -1 });
TestAttemptSchema.index({ userId: 1, status: 1 });
TestAttemptSchema.index({ listeningTestId: 1 });
TestAttemptSchema.index({ readingTestId: 1 });
TestAttemptSchema.index({ writingTestId: 1 });
TestAttemptSchema.index({ fullTestId: 1 });

module.exports =
  mongoose.models.TestAttempt ||
  mongoose.model("TestAttempt", TestAttemptSchema);
