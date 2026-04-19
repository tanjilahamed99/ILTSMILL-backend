const mongoose = require("mongoose");
const { Schema } = mongoose;

// ─── Reusable sub-schemas shared across ALL test types ─────────────────────

// Individual fill-in field (form completion, note completion, etc.)
// label is NOT required at schema level — we validate conditionally in the route
const FormFieldSchema = new Schema(
  {
    questionNumber: { type: Number, required: true },
    label:          { type: String, default: "" },   // NOT required — MCQ questions have no label
    prefix:         { type: String, default: "" },
    suffix:         { type: String, default: "" },
    prefixSymbol:   { type: String, default: "" },
  },
  { _id: false }
);

// MCQ option
const MCQOptionSchema = new Schema(
  {
    label: { type: String, required: true },   // "A"
    text:  { type: String, default: "" },      // NOT required — may be empty during creation
  },
  { _id: false }
);

// A single question (works for all question types)
const QuestionSchema = new Schema(
  {
    questionNumber: { type: Number, required: true },

    type: {
      type: String,
      required: true,
      enum: [
        "form_completion",       // fill in a form table
        "note_completion",       // fill in notes / summary
        "sentence_completion",   // complete a sentence
        "mcq_single",            // choose ONE letter A/B/C
        "mcq_multiple",          // choose MULTIPLE letters
        "matching",              // match columns
        "map_labelling",         // label a diagram/map
        "true_false_ng",         // True / False / Not Given
        "short_answer",          // write short answer from passage
      ],
    },

    // ── Fill-in types ──────────────────────────────────────────────────────
    formFields: { type: [FormFieldSchema], default: undefined },

    // ── MCQ types ──────────────────────────────────────────────────────────
    stem:               { type: String },            // the question
    options:            { type: [MCQOptionSchema], default: undefined },
    multipleAnswerCount:{ type: Number },            // for mcq_multiple

    // ── Matching type ──────────────────────────────────────────────────────
    matchItems:   { type: [{ label: String, text: String }], default: undefined },
    matchOptions: { type: [{ label: String, text: String }], default: undefined },

    // ── True/False/NG & Short answer ───────────────────────────────────────
    statementText: { type: String },   // the statement to evaluate

    // ── ANSWER (server-only, never sent to client) ─────────────────────────
    answer: { type: Schema.Types.Mixed },  // string | string[]
  },
  { _id: false }
);

// Question block header (the instruction box above a group of questions)
const QuestionBlockSchema = new Schema(
  {
    heading:         { type: String, required: true },  // "Questions 1 – 10"
    instruction:     { type: String, required: true },  // full instruction text
    boldInstruction: { type: String },                   // part to render bold
    tableTitle:      { type: String },                   // e.g. "ORDER FORM"
    exampleRow:      {
      label: { type: String },
      value: { type: String },
    },
  },
  { _id: false }
);

module.exports = { FormFieldSchema, MCQOptionSchema, QuestionSchema, QuestionBlockSchema };