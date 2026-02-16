// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  // --- Core identity ---
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  password: { type: String, required: true },

  // --- Compliance: 18+ confirmation (saved at signup) ---
  is18PlusConfirmed: { type: Boolean, default: false }, // enforced at /signup
  ageConfirmedAt: { type: Date, default: null },        // optional audit trail

  // --- Marketing consent (drives the checkbox on My Details) ---
  marketingOptIn: { type: Boolean, default: false },

  // --- Favourite Team (flat strings so the UI works as-is) ---
  // Use either spelling; the UI reads/writes favourite*, but also tolerates favorite*.
  favouriteSport: { type: String, default: "" },
  favouriteTeam:  { type: String, default: "" },

  // --- Points / Credits ---
  points: { type: Number, default: 0, min: 0 },
  pointsUpdatedAt: { type: Date, default: null },

  // --- Responsible Play settings ---
  spendLimitMonthly: { type: Number, min: 0, default: null }, // null = no limit set
  isFrozen: { type: Boolean, default: false }, // false = active
});

module.exports = mongoose.model("User", userSchema);
