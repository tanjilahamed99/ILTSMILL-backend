const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { Schema } = mongoose;

const UserSchema = new Schema({
  email: { type: String, unique: true },
  name: String,
  password: String,
  phone: String,
  role: { type: String, default: "user" },
  picture: { type: Schema.ObjectId, ref: "images" },
  createdAt: { type: Date, default: Date.now },
  resetPasswordOTP: String,
  resetPasswordExpires: Date,
});

// ✅ FIXED: Don't use next parameter with async/await
UserSchema.pre("save", async function() {
  // Only hash if password is modified
  if (!this.isModified("password")) {
    return;
  }
  
  if (!this.password) {
    throw new Error("Password is required");
  }
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password
UserSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("User", UserSchema);