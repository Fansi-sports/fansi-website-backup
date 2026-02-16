// models/SavedBasket.js
const mongoose = require("mongoose");

const SavedBasketSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    firstName: { type: String, default: "" },
    items: { type: Array, default: [] },
    savedAt: { type: Date, default: Date.now },
    reminderSent: { type: Boolean, default: false },
    reminderSentAt: { type: Date, default: null },
    checkedOut: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SavedBasket", SavedBasketSchema);