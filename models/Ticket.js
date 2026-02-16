// models/Ticket.js
const mongoose = require("mongoose");

const TicketSchema = new mongoose.Schema(
  {
    // ✅ Keep existing field so nothing breaks right now
    // (currently stored as "1", "2", etc)
    competitionId: { type: String, required: true },

    // ✅ New field for proper linking to the Competition document
    // (future-proof: lets us show title/drawDate easily)
    competitionRef: { type: mongoose.Schema.Types.ObjectId, ref: "Competition", default: null },

    number: { type: Number, required: true }, // e.g. 1..10000
    email: { type: String, default: "" },     // optional: helpful for audits
  },
  { timestamps: true }
);

// ✅ Existing protection (keeps old flow safe)
// Ensure a number can only be used once per competition (using competitionId string)
TicketSchema.index({ competitionId: 1, number: 1 }, { unique: true });

// ✅ New protection (future-proof)
// Ensure a number can only be used once per competition (using competitionRef ObjectId)
// Only applies when competitionRef exists (partial index)
TicketSchema.index(
  { competitionRef: 1, number: 1 },
  {
    unique: true,
    partialFilterExpression: { competitionRef: { $type: "objectId" } },
  }
);

module.exports = mongoose.model("Ticket", TicketSchema);
