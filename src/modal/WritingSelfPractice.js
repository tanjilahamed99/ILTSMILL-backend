const mongoose = require("mongoose");
const { Schema } = mongoose;

const WritingPractice = new Schema(
  {
    title: { type: String, required: true },
    level: {
      type: String,
      enum: [
        "Academic",
        "General Training",
        "Beginner",
        "Intermediate",
        "Advanced",
      ],
      default: "Academic",
    },
    category: { type: String, required: true },
    time: { type: Number, required: true },

    // Content
    prompt: { type: String, required: true },
    minWords: { type: Number, default: 250 },

    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Medium",
    },
  },
  { timestamps: true },
);

module.exports = {
  WritingPractice:
    mongoose.models.WritingPractice ||
    mongoose.model("WritingPractice", WritingPractice),
};
