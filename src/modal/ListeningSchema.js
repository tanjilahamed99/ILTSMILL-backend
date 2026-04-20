const mongoose = require("mongoose");
const { Schema } = mongoose;
const {
  QuestionSchema,
  QuestionBlockSchema,
} = require("./shared/questionSchemas");

// ─── Section = one Part (Part 1 / 2 / 3 / 4) ─────────────────────────────────
const ListeningSectionSchema = new Schema(
  {
    partNumber: { type: Number, required: true, min: 1, max: 4 },
    title: { type: String, required: true, default: "" }, // "Part 1"
    instruction: { type: String, required: true }, // "Listen and answer..."
    questionRange: {
      from: { type: Number, required: true },
      to: { type: Number, required: true },
    },
    questionBlock: { type: QuestionBlockSchema, required: true },
    audioUrl: { type: String, required: true, default: "" }, // S3/cloudinary URL
    audioDuration: { type: Number, default: 0 }, // seconds
    questions: { type: [QuestionSchema], required: true },
  },
  { _id: false },
);

// ─── Main Listening Test Document ─────────────────────────────────────────────
const ListeningTestSchema = new Schema(
  {
    // ── Identity ────────────────────────────────────────────────────────────
    seriesId: { type: String, required: true, index: true }, // "iltsmill-series-13"
    testNumber: { type: Number, required: true }, // 4
    title: { type: String, required: true }, // "Mock Test - 04"
    slug: { type: String, unique: true, sparse: true }, // "series-13-listening-04"

    // ── Categorization ───────────────────────────────────────────────────────
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Medium",
    },
    isPublished: { type: Boolean, default: false },
    isFreeScoring: { type: Boolean, default: false },

    // ── Test config ──────────────────────────────────────────────────────────
    totalDuration: { type: Number, default: 40 * 60 }, // 40 min
    totalQuestions: { type: Number, default: 40 },

    // ── Content (4 parts) ────────────────────────────────────────────────────
    sections: {
      type: [ListeningSectionSchema],
      required: true,
      validate: {
        validator: (arr) => arr.length === 4,
        message: "Listening test must have exactly 4 sections (Part 1-4)",
      },
    },

    // ── Stats (updated on each submission) ───────────────────────────────────
    totalAttempts: { type: Number, default: 0 },
    averageBand: { type: Number, default: 0 },

    // ── Admin ────────────────────────────────────────────────────────────────
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    tags: [{ type: String }],
  },
  { timestamps: true },
);

ListeningTestSchema.index({ seriesId: 1, testNumber: 1 }, { unique: true });
ListeningTestSchema.index({ isPublished: 1, difficulty: 1 });

module.exports =
  mongoose.models.ListeningTest ||
  mongoose.model("ListeningTest", ListeningTestSchema);
