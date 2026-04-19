// utils/bandScore.js
// IELTS official band score conversion tables

// ─── Listening (out of 40) ───────────────────────────────────────────────────
const LISTENING_BAND = {
  39: 9.0, 38: 9.0, 37: 8.5, 36: 8.5,
  35: 8.0, 34: 7.5, 33: 7.5, 32: 7.0,
  31: 7.0, 30: 6.5, 29: 6.5, 28: 6.0,
  27: 6.0, 26: 5.5, 25: 5.5, 24: 5.0,
  23: 5.0, 22: 5.0, 21: 4.5, 20: 4.5,
  19: 4.0, 18: 4.0, 17: 4.0, 16: 3.5,
  15: 3.5, 14: 3.0, 13: 3.0, 12: 3.0,
  11: 2.5, 10: 2.5,
};

// ─── Reading Academic (out of 40) ────────────────────────────────────────────
const READING_ACADEMIC_BAND = {
  39: 9.0, 38: 8.5, 37: 8.5, 36: 8.0,
  35: 7.5, 34: 7.0, 33: 7.0, 32: 6.5,
  31: 6.5, 30: 6.0, 29: 6.0, 28: 5.5,
  27: 5.5, 26: 5.0, 25: 5.0, 24: 4.5,
  23: 4.5, 22: 4.0, 21: 4.0, 20: 4.0,
  19: 3.5, 18: 3.5, 17: 3.0, 16: 3.0,
};

// ─── Reading General Training (out of 40) ────────────────────────────────────
const READING_GENERAL_BAND = {
  40: 9.0, 39: 8.5, 38: 8.5, 37: 8.0,
  36: 7.5, 35: 7.0, 34: 7.0, 33: 6.5,
  32: 6.5, 31: 6.0, 30: 6.0, 29: 5.5,
  28: 5.5, 27: 5.0, 26: 5.0, 25: 4.5,
  24: 4.5, 23: 4.0, 22: 4.0, 21: 4.0,
  20: 3.5, 19: 3.5, 18: 3.0, 17: 3.0,
};

function getListeningBand(correct) {
  if (correct >= 39) return 9.0;
  return LISTENING_BAND[correct] ?? 2.5;
}

function getReadingBand(correct, testType = "Academic") {
  const table = testType === "General" ? READING_GENERAL_BAND : READING_ACADEMIC_BAND;
  if (correct >= 40) return 9.0;
  return table[correct] ?? 2.5;
}

// Round to nearest 0.5 band
function roundBand(score) {
  return Math.round(score * 2) / 2;
}

// Calculate overall band from multiple section bands
function calcOverallBand(bands) {
  const valid = bands.filter((b) => b !== null && b !== undefined);
  if (valid.length === 0) return null;
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
  return roundBand(avg);
}

// Normalise answer string for comparison
function normaliseAnswer(str) {
  if (!str) return "";
  return String(str).trim().toLowerCase().replace(/\s+/g, " ");
}

// Check if student answer matches correct answer (handles arrays)
function isCorrect(studentAnswer, correctAnswer) {
  if (!studentAnswer) return false;
  const student = normaliseAnswer(studentAnswer);
  const correct = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
  return correct.some((c) => normaliseAnswer(c) === student);
}

module.exports = {
  getListeningBand,
  getReadingBand,
  roundBand,
  calcOverallBand,
  isCorrect,
  normaliseAnswer,
};