// models/Order.js
const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema(
  {
    competitionId: { type: String, required: true },
    title: { type: String, default: "" },
    qty: { type: Number, required: true },
    unitPrice: { type: Number, required: true }, // pence
    currency: { type: String, default: "gbp" },

    // ✅ store skill + points-per-ticket at time of purchase (provider-agnostic)
    ppt: { type: Number, default: 1, min: 1 }, // points per ticket
    skillQuestionId: { type: String, default: "" },
    skillQuestion: { type: String, default: "" },
    selectedAnswer: { type: String, default: "" },

    tickets: { type: [Number], default: [] }, // allocated ticket numbers
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    userId: { type: String, default: "" },
    email: { type: String, required: true },
    name: { type: String, default: "" },
    phone: { type: String, default: "" },
    address1: { type: String, default: "" },
    address2: { type: String, default: "" },
    city: { type: String, default: "" },
    postcode: { type: String, default: "" },

    items: { type: [OrderItemSchema], required: true },

    amountTotal: { type: Number, required: true }, // pence charged (after discounts)
    currency: { type: String, default: "gbp" },

    // ✅ provider-agnostic payment fields (Stripe is just one provider)
    paymentProvider: { type: String, default: "stripe" }, // "stripe" | "cashflows" later
    paymentSessionId: { type: String, default: "" },      // e.g. stripe session id
    paymentIntentId: { type: String, default: "" },       // e.g. stripe payment_intent

    // ✅ Keep Stripe fields for backwards compatibility with your existing data + queries
    // Make them optional so future Cashflows orders can exist without Stripe IDs.
    stripeSessionId: { type: String, default: "", unique: true, sparse: true },
    stripePaymentIntentId: { type: String, default: "" },

    // ✅ status now supports pending -> paid
    status: { type: String, default: "pending" }, // "pending" | "paid" | "failed" etc.

    // --- Points accounting ---
    pointsApplied: { type: Number, default: 0, min: 0 },
    pointsEarned: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);
