const mongoose = require("mongoose");
const { Schema } = mongoose;

// ─── Writing Task (Task 1 or Task 2) ─────────────────────────────────────────
const WritingTaskSchema = new Schema(
  {
    taskNumber:  { type: Number, required: true, enum: [1, 2] },

    // ── Prompt ───────────────────────────────────────────────────────────
    taskTitle:   { type: String, required: true },       // "Task 1" / "Task 2"
    prompt:      { type: String, required: true },       // The full question text
    wordLimit:   { type: Number, required: true },       // 150 for T1, 250 for T2
    timeGuide:   { type: Number, required: true },       // recommended minutes (20 / 40)

    // ── Task type (Academic vs General) ──────────────────────────────────
    taskType: {
      type: String,
      enum: [
        // Academic Task 1
        "bar_chart", "line_graph", "pie_chart", "table",
        "process_diagram", "map_comparison", "mixed_diagram",
        // General Task 1
        "letter_formal", "letter_informal", "letter_semi_formal",
        // Task 2 (both)
        "opinion_essay", "discussion_essay", "problem_solution",
        "advantages_disadvantages", "two_part_question",
      ],
      required: true,
    },

    // ── Diagram / image for Task 1 (Academic) ─────────────────────────
    diagramUrls:    [{ type: String }],    // can have 1-2 charts/maps
    diagramCaptions:[{ type: String }],

    // ── Model answer (admin-only, never sent to students) ─────────────
    modelAnswer:     { type: String, default: "" },
    modelAnswerBand: { type: Number, default: 0 },

    // ── Scoring criteria weights (for AI/manual grading) ─────────────
    scoringCriteria: {
      taskAchievement:   { type: Number, default: 25 }, // %
      coherenceCohesion: { type: Number, default: 25 },
      lexicalResource:   { type: Number, default: 25 },
      grammaticalRange:  { type: Number, default: 25 },
    },
  },
  { _id: false }
);

// ─── Main Writing Test Document ───────────────────────────────────────────────
const WritingTestSchema = new Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────
    seriesId:   { type: String, required: true, index: true },
    testNumber: { type: Number, required: true },
    title:      { type: String, required: true },
    slug:       { type: String, unique: true, sparse: true },

    // ── Type ─────────────────────────────────────────────────────────────
    testType:   { type: String, enum: ["Academic", "General"], default: "Academic" },

    // ── Categorization ───────────────────────────────────────────────────
    difficulty:    { type: String, enum: ["Easy", "Medium", "Hard"], default: "Medium" },
    isPublished:   { type: Boolean, default: false },
    isFreeScoring: { type: Boolean, default: false },

    // ── Config ───────────────────────────────────────────────────────────
    totalDuration: { type: Number, default: 60 * 60 },   // 60 min

    // ── Content (Task 1 + Task 2) ────────────────────────────────────────
    tasks: {
      type: [WritingTaskSchema],
      required: true,
      validate: {
        validator: (arr) => arr.length === 2,
        message: "Writing test must have exactly 2 tasks",
      },
    },

    // ── Scoring mode ─────────────────────────────────────────────────────
    scoringMode: {
      type: String,
      enum: ["manual", "ai", "none"],
      default: "none",
    },

    // ── Stats ─────────────────────────────────────────────────────────────
    totalAttempts: { type: Number, default: 0 },
    averageBand:   { type: Number, default: 0 },

    // ── Admin ─────────────────────────────────────────────────────────────
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    tags:      [{ type: String }],
  },
  { timestamps: true }
);

WritingTestSchema.index({ seriesId: 1, testNumber: 1 }, { unique: true });
WritingTestSchema.index({ isPublished: 1, testType: 1 });

module.exports = mongoose.models.WritingTest ||
  mongoose.model("WritingTest", WritingTestSchema);