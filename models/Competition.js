// fansi-backend/models/Competition.js
import mongoose from "mongoose";

const CompetitionSchema = new mongoose.Schema(
  {
    /* === Core identity & categorisation === */
    title: { type: String, required: true },             // e.g., "Arsenal vs Manchester United"
    league: { type: String, default: "" },               // e.g., "Premier League Football"
    // ✅ allow "launch" as well
    category: {
      type: String,
      enum: ["featured", "weekly", "launch"],
      required: true,
    },

    /* === Backwards-compat with your existing fields === */
    sport: { type: String, default: "" },                // was: String
    match: { type: String, default: "" },                // was: String

    /* === Pricing & ticketing === */
    price: { type: Number, required: true, min: 0 },     // was: Number (required now)
    totalTickets: { type: Number, default: 10000, min: 1 },
    soldTickets: { type: Number, default: 0, min: 0 },
    maxPerUser: { type: Number, default: 50, min: 1 },

    /* === Dates & venue (store as strings to allow "This Week" text OR ISO) === */
    date: { type: String, default: "" },                 // was: Date; now string for flexibility
    drawDate: { type: String, default: "" },             // ISO string preferred, but not required
    venue: { type: String, default: "" },
    stadium: { type: String, default: "" },

    /* === UI content === */
    prizeBlurb: { type: String, default: "" },

    // Card image (for list card)
    prizeImage: { type: String, default: "" },

    // Gallery images (for detail page)
    images: { type: [String], default: [] },

    detailsTitle: { type: String, default: "Competition Details" },
    detailsIntro: { type: String, default: "Win Hospitality Tickets to a Top Fixture" },
    detailsItems: { type: [String], default: [] },

    /* === Operational status === */
    status: { type: String, enum: ["live", "closed", "draft"], default: "live" },

    /* === Teams (optional, used for logos) === */
    homeTeam: { type: String, default: "" },
    awayTeam: { type: String, default: "" },

    /* === Legacy fields kept so nothing breaks === */
    entries: { type: Number, default: 0 },
    winner: { type: String, default: "" },
  },
  { timestamps: true }
);

/* Return { id: "...", ... } instead of _id/__v */
CompetitionSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id?.toString();
    delete ret._id;
  },
});

/* Helpful index for listing & sorting */
CompetitionSchema.index({ status: 1, category: 1, drawDate: 1 });

export default mongoose.model("Competition", CompetitionSchema);
