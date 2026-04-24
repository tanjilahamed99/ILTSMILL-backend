const mongoose = require("mongoose");
const { Schema } = mongoose;

// ─── Full Mock Test ────────────────────────────────────────────────────────────
// A FullTest doesn't duplicate question data.
// It REFERENCES the individual test documents.
// This way: admin creates separate Listening/Reading/Writing tests,
// then assembles them into a FullTest bundle.
// ─────────────────────────────────────────────────────────────────────────────

const FullTestSchema = new Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────
    seriesId:    { type: String, required: true, index: true },  // "iltsmill-series-13"
    seriesNumber:  { type: Number, required: true },               // 1, 2, 3, 4
    title:       { type: String, required: true },               // "Mock Test - 04"
    slug:        { type: String, unique: true, sparse: true },   // "series-13-full-04"

    // ── Categorization ───────────────────────────────────────────────────
    difficulty:    { type: String, enum: ["Easy", "Medium", "Hard"], default: "Medium" },
    isPublished:   { type: Boolean, default: false },
    isFreeScoring: { type: Boolean, default: false },

    // ── Component test references ────────────────────────────────────────
    // Each is optional so you can create a FullTest with only some sections ready
    listeningTest: {
      type: Schema.Types.ObjectId,
      ref: "ListeningTest",
      default: null,
    },
    readingTest: {
      type: Schema.Types.ObjectId,
      ref: "ReadingTest",
      default: null,
    },
    writingTest: {
      type: Schema.Types.ObjectId,
      ref: "WritingTest",
      default: null,
    },

    // ── Computed totals (denormalised for fast list rendering) ────────────
    totalDuration: { type: Number, default: (40 + 60 + 60) * 60 }, // ~2h 45m
    sectionsAvailable: {
      listening: { type: Boolean, default: false },
      reading:   { type: Boolean, default: false },
      writing:   { type: Boolean, default: false },
    },

    // ── Stats ─────────────────────────────────────────────────────────────
    totalAttempts:    { type: Number, default: 0 },
    averageOverall:   { type: Number, default: 0 },

    // ── Admin ─────────────────────────────────────────────────────────────
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    tags:      [{ type: String }],
  },
  { timestamps: true }
);

FullTestSchema.index({ seriesId: 1, testNumber: 1 }, { unique: true });
FullTestSchema.index({ isPublished: 1, difficulty: 1 });

module.exports = mongoose.models.FullTest ||
  mongoose.model("FullTest", FullTestSchema);