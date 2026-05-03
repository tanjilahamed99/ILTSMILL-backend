const mongoose = require("mongoose");
const { Schema } = mongoose;

const ReadingSelfPractice = new Schema(
  {
    // Basic Info
    title: { type: String, required: true }, // "Climate Change & Global Impact"
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
    category: { type: String, required: true }, // "Environment", "Science", "History", etc.
    time: { type: Number, required: true }, // Time in minutes (e.g., 20)

    // Content
    passage: { type: String, required: true }, // The reading text

    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Medium",
    },
  },
  { timestamps: true },
);

module.exports = {
  ReadingSelfPractice:
    mongoose.models.ReadingSelfPractice ||
    mongoose.model("ReadingSelfPractice", ReadingSelfPractice),
};
