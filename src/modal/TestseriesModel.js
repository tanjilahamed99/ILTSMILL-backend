const mongoose = require("mongoose");
const { Schema } = mongoose;

// ─── Test Series ───────────────────────────────────────────────────────────────
// A "Series" is the top-level grouping shown on the mock test listing page.
// e.g. "ILTSMILL Series - 13" with 4 Full Mock Tests inside it.
// ─────────────────────────────────────────────────────────────────────────────

const TestSeriesSchema = new Schema(
  {
    seriesId:     { type: String, required: true, unique: true },  // "iltsmill-series-13"
    seriesNumber: { type: Number, required: true },                 // 13
    name:         { type: String },                 // "ILTSMILL Series - 13"
    title:         { type: String },                 // "ILTSMILL Series - 13"

    isPublished:   { type: Boolean, default: false },
    isFreeScoring: { type: Boolean, default: false },

    // ── Counts (denormalised for fast rendering) ─────────────────────────
    totalFullTests:     { type: Number, default: 0 },
    totalListeningTests:{ type: Number, default: 0 },
    totalReadingTests:  { type: Number, default: 0 },
    totalWritingTests:  { type: Number, default: 0 },
    totalParticipants:  { type: Number, default: 0 },

    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.models.TestSeries ||
  mongoose.model("TestSeries", TestSeriesSchema);