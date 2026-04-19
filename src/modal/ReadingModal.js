const mongoose = require("mongoose");
const { Schema } = mongoose;
const { QuestionSchema, QuestionBlockSchema } = require("./shared/questionSchemas");

// ─── Passage = one Reading section (Passage 1 / 2 / 3) ───────────────────────
const ReadingPassageSchema = new Schema(
  {
    passageNumber: { type: Number, required: true, min: 1, max: 3 },
    title:         { type: String, required: true },          // "The Future of Urban Transport"
    subtitle:      { type: String, default: "" },
    bodyText:      { type: String, required: true },          // full passage HTML/markdown text
    wordCount:     { type: Number, default: 0 },

    // Some passages have labelled images/diagrams
    diagramUrl:    { type: String, default: "" },
    diagramCaption:{ type: String, default: "" },

    questionRange: {
      from: { type: Number, required: true },
      to:   { type: Number, required: true },
    },

    // A passage can have MULTIPLE question groups (different types)
    // e.g. Q1-7 True/False/NG,  Q8-13 Matching Headings
    questionGroups: [
      {
        questionBlock: { type: QuestionBlockSchema, required: true },
        questions:     { type: [QuestionSchema],    required: true },
      },
    ],
  },
  { _id: false }
);

// ─── Main Reading Test Document ───────────────────────────────────────────────
const ReadingTestSchema = new Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────────
    seriesId:   { type: String, required: true, index: true },
    testNumber: { type: Number, required: true },
    title:      { type: String, required: true },       // "Reading Test - 04"
    slug:       { type: String, unique: true, sparse: true },

    // ── Test type: Academic or General Training ────────────────────────────
    testType:   { type: String, enum: ["Academic", "General"], default: "Academic" },

    // ── Categorization ────────────────────────────────────────────────────
    difficulty:   { type: String, enum: ["Easy", "Medium", "Hard"], default: "Medium" },
    isPublished:  { type: Boolean, default: false },
    isFreeScoring:{ type: Boolean, default: false },

    // ── Config ───────────────────────────────────────────────────────────
    totalDuration:  { type: Number, default: 60 * 60 },   // 60 min
    totalQuestions: { type: Number, default: 40 },

    // ── Content (3 passages) ─────────────────────────────────────────────
    passages: {
      type: [ReadingPassageSchema],
      required: true,
      validate: {
        validator: (arr) => arr.length === 3,
        message: "Reading test must have exactly 3 passages",
      },
    },

    // ── Stats ────────────────────────────────────────────────────────────
    totalAttempts: { type: Number, default: 0 },
    averageBand:   { type: Number, default: 0 },

    // ── Admin ────────────────────────────────────────────────────────────
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    tags:      [{ type: String }],
  },
  { timestamps: true }
);

ReadingTestSchema.index({ seriesId: 1, testNumber: 1 }, { unique: true });
ReadingTestSchema.index({ isPublished: 1, testType: 1, difficulty: 1 });

module.exports = mongoose.models.ReadingTest ||
  mongoose.model("ReadingTest", ReadingTestSchema);