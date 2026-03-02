// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const Stripe = require("stripe");

// Routes
const authRoutes = require("./routes/authRoutes");
const paymentRoutes = require("./routes/payment");
const orderRoutes = require("./routes/orderRoutes");
const competitionRoutes = require("./routes/competition");
const adminRoutes = require("./routes/admin");

const responsibleRoutes = require("./routes/responsible");
const accountDeleteRoutes = require("./routes/accountDelete");
const preferencesRoutes = require("./routes/preferences");

// ✅ NEW: saved basket routes
const savedBasketRoutes = require("./routes/savedBasket");

// ✅ NEW: abandoned basket cron job
const { startAbandonedBasketJob } = require("./jobs/abandonedBasket");

// Models
const Order = require("./models/Order");
const Ticket = require("./models/Ticket");
const User = require("./models/User");
const Competition = require("./models/Competition");

// ✅ Email service
const { sendOrderConfirmationEmail } = require("./services/emailService");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const SKILL_GATE_ENABLED =
  String(process.env.SKILL_GATE_ENABLED || "false").toLowerCase() === "true";

console.log("🔧 SKILL_GATE_ENABLED = " + String(SKILL_GATE_ENABLED));

function toObjectIdOrNull(id) {
  const s = String(id || "").trim();
  if (!s) return null;
  if (!mongoose.Types.ObjectId.isValid(s)) return null;
  if (!/^[a-fA-F0-9]{24}$/.test(s)) return null;
  return new mongoose.Types.ObjectId(s);
}

async function allocateUniqueTickets(competitionId, qty, email) {
  const max = Number(process.env.MAX_TICKETS_PER_DRAW || 10000);
  const assigned = [];
  const maxTries = qty * 50;
  let tries = 0;

  const competitionIdStr = String(competitionId);
  const competitionRef = toObjectIdOrNull(competitionIdStr);

  console.log(
    `🎟️ Allocating ${qty} ticket(s) for competitionId=${competitionIdStr} (max=${max}) email=${String(email || "")}`
  );

  while (assigned.length < qty && tries < maxTries) {
    tries++;
    const n = Math.floor(Math.random() * max) + 1;
    try {
      await Ticket.create({
        competitionId: competitionIdStr,
        competitionRef: competitionRef,
        number: n,
        email: (email || "").toLowerCase(),
      });
      assigned.push(n);
    } catch (err) {
      if (err && err.code === 11000) continue;
      console.error("❌ Ticket.create error:", err);
      throw err;
    }
  }

  if (assigned.length < qty) {
    throw new Error("Not enough available ticket numbers to allocate.");
  }

  console.log(
    `✅ Allocated tickets for competitionId=${competitionIdStr} -> [${assigned.join(", ")}]`
  );

  return assigned;
}

function normalizeAnswer(s = "") {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

// ✅ Full skill question bank matching src/data/skillQuestions.js
// Each question maps to an array of accepted normalized answers
const SKILL_QUESTIONS_MAP = {
  // Football
  "how many players are on the pitch for one team in football": ["11", "eleven"],
  "what colour card means a player is sent off": ["red", "redcard"],
  "what do you call it when a player scores three goals in one match": ["hattrick", "hatrick"],
  "how long is a standard football match excluding added time": ["90", "ninety", "90minutes"],
  "how many points does a team get for a win in most league formats": ["3", "three"],

  // Rugby
  "how many players are on the field for one team in rugby union": ["15", "fifteen"],
  "how many points is a try worth in rugby union": ["5", "five"],
  "what is the name of the set play after the ball goes into touch": ["lineout", "lineup"],
  "what do you call the set piece used to restart play after a minor infringement": ["scrum"],
  "how many points is a penalty kick worth in rugby union": ["3", "three"],

  // Tennis
  "what score comes after 30 in tennis": ["40", "forty"],
  "what is it called when the score is 4040": ["deuce"],
  "what piece of equipment do players hit the ball with in tennis": ["racket", "racquet"],
  "what do you call a serve that the opponent doesnt touch": ["ace"],
  "what is the score called when a player has 0 points": ["love"],

  // Golf
  "how many holes are in a full round of golf": ["18", "eighteen"],
  "what is a score of one under par called": ["birdie"],
  "what club is usually used on the green": ["putter"],
  "what do you call getting the ball in the hole in one shot": ["holeinone", "ace"],
  "what is a score of two under par called": ["eagle"],

  // F1
  "what does f1 stand for": ["formula1", "formulaone"],
  "how many points does the race winner score in formula 1": ["25", "twentyfive"],
  "what do we call the driver stop to change tyres": ["pitstop"],
  "what session decides the starting grid order for the race": ["qualifying", "quali"],
  "what is the car called that controls the pace when theres a major incident": ["safetycar"],
};

function isSkillAnswerCorrect(skillQuestion, selectedAnswer) {
  // Normalize the question — strip punctuation and extra spaces
  const q = (skillQuestion || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const accepted = SKILL_QUESTIONS_MAP[q];

  if (!accepted) {
    console.warn(`⚠️ Skill question not found in map: "${q}"`);
    return false;
  }

  const given = normalizeAnswer(selectedAnswer);
  const match = accepted.includes(given);

  console.log(`🔍 Skill check: q="${q}" given="${given}" accepted=${JSON.stringify(accepted)} match=${match}`);

  return match;
}

app.use(cors());

app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      if (whSecret) {
        event = stripe.webhooks.constructEvent(req.body, sig, whSecret);
      } else {
        event = JSON.parse(req.body.toString("utf8"));
        console.warn(
          "⚠️ STRIPE_WEBHOOK_SECRET not set — skipping signature verification (dev only)."
        );
      }
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;

          console.log("✅ Webhook checkout.session.completed:", session.id);

          const orderId = (session.metadata?.orderId || "").toString().trim();
          if (!orderId) {
            console.warn("⚠️ No orderId found in session.metadata. Skipping DB-first allocation.");
            break;
          }

          const order = await Order.findById(orderId);
          if (!order) {
            console.warn("⚠️ Order not found for orderId:", orderId);
            break;
          }

          const alreadyHasTickets =
            Array.isArray(order.items) && order.items.some((it) => (it.tickets || []).length > 0);
          if (order.status === "paid" && alreadyHasTickets) {
            console.log("↩️ Order already paid with tickets. orderId=", orderId);
            break;
          }

          const cd = session.customer_details || {};
          const emailSaved = (cd.email || session.customer_email || order.email || "")
            .toString()
            .trim()
            .toLowerCase();

          const updatedItems = [];
          for (let i = 0; i < (order.items || []).length; i++) {
            const it = order.items[i];

            const competitionId = String(it.competitionId || "unknown");
            const qty = Math.max(1, Number(it.qty || 1));

            const skillQuestion = (it.skillQuestion || "").toString();
            const selectedAnswer = (it.selectedAnswer || "").toString();

            const isCorrect = SKILL_GATE_ENABLED
              ? isSkillAnswerCorrect(skillQuestion, selectedAnswer)
              : true;

            console.log(
              `➡️ OrderItem[${i}] competitionId=${competitionId} qty=${qty} isCorrect=${isCorrect}`
            );

            let tickets = Array.isArray(it.tickets) ? [...it.tickets] : [];

            if (competitionId !== "unknown" && qty > 0 && isCorrect) {
              const need = Math.max(0, qty - tickets.length);
              if (need > 0) {
                const newlyAssigned = await allocateUniqueTickets(competitionId, need, emailSaved);
                tickets = [...tickets, ...newlyAssigned];
              }
            } else {
              console.log(
                `⚠️ Skipping allocation OrderItem[${i}] reason=` +
                  (competitionId === "unknown"
                    ? "competitionId=unknown"
                    : !isCorrect
                    ? "skill incorrect"
                    : "qty invalid")
              );
            }

            updatedItems.push({
              ...it.toObject(),
              tickets,
              answeredCorrectly: isCorrect,
            });
          }

          const pointsApplied = Math.max(0, Number(order.pointsApplied || 0));
          let pointsEarned = 0;
          if (pointsApplied === 0) {
            for (let i = 0; i < (order.items || []).length; i++) {
              const q = Math.max(1, Number(order.items[i]?.qty || 1));
              const ppt = Math.max(1, Number(order.items[i]?.ppt || 1));
              pointsEarned += q * ppt;
            }
          }

          await Order.updateOne(
            { _id: order._id },
            {
              $set: {
                status: "paid",
                items: updatedItems,
                pointsEarned,
                stripeSessionId: session.id,
                stripePaymentIntentId: String(session.payment_intent || ""),
                paymentSessionId: session.id,
                paymentIntentId: String(session.payment_intent || ""),
                paymentProvider: "stripe",
              },
            }
          );

          console.log("✅ Order updated to paid + tickets allocated:", order._id.toString());

          // ✅ Send order confirmation email with allocated tickets
          const updatedOrder = await Order.findById(order._id);
          if (updatedOrder) {
            const firstName = (updatedOrder.name || "there").split(" ")[0];
            sendOrderConfirmationEmail({
              to: updatedOrder.email,
              firstName,
              order: updatedOrder,
            }).catch(err => console.error("❌ Order confirmation email failed:", err));
          }

          // ✅ Mark saved basket as checked out
          const userId = (order.userId || session.metadata?.userId || "").toString().trim();
          if (userId) {
            const SavedBasket = require("./models/SavedBasket");
            await SavedBasket.findOneAndUpdate(
              { userId },
              { checkedOut: true }
            ).catch(err => console.error("❌ Failed to mark basket as checked out:", err));
          }

          // ✅ Update soldTickets count on each competition
          for (const it of updatedItems) {
            const compId = toObjectIdOrNull(String(it.competitionId || ""));
            const ticketsAllocated = (it.tickets || []).length;
            if (compId && ticketsAllocated > 0) {
              await Competition.findByIdAndUpdate(compId, {
                $inc: { soldTickets: ticketsAllocated },
              }).catch(err => console.error("❌ Failed to update soldTickets:", err));
            }
          }

          console.log("✅ soldTickets updated for all competitions in order.");

          // Update user's points balance
          if (userId) {
            const user = await User.findById(userId);
            if (user) {
              if (pointsApplied > 0) {
                user.points = Math.max(0, Number(user.points || 0) - pointsApplied);
              }
              if (pointsEarned > 0) {
                user.points = Math.max(0, Number(user.points || 0)) + pointsEarned;
              }
              await user.save();
            }
          }

          break;
        }

        default:
          break;
      }

      res.json({ received: true });
    } catch (err) {
      console.error("❌ Webhook handler error:", err);
      res.status(200).json({ received: true, note: "handler error logged" });
    }
  }
);

app.use(express.json());

app.get("/api/dev/skill-gate", (req, res) => {
  res.json({
    skillGateEnabled: SKILL_GATE_ENABLED,
    envValue: process.env.SKILL_GATE_ENABLED || null,
  });
});

app.get("/api/dev/tickets/count", async (req, res) => {
  try {
    const competitionId = String(req.query.competitionId || "").trim();
    if (!competitionId) {
      return res.status(400).json({ error: "competitionId query param required" });
    }
    const count = await Ticket.countDocuments({ competitionId });
    res.json({ competitionId, count });
  } catch (err) {
    console.error("dev/tickets/count error:", err);
    res.status(500).json({ error: "Failed to count tickets" });
  }
});

app.get("/api/dev/tickets/sample", async (req, res) => {
  try {
    const competitionId = String(req.query.competitionId || "").trim();
    if (!competitionId) {
      return res.status(400).json({ error: "competitionId query param required" });
    }
    const docs = await Ticket.find({ competitionId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({
      competitionId,
      count: docs.length,
      sample: docs.map((d) => d.number),
    });
  } catch (err) {
    console.error("dev/tickets/sample error:", err);
    res.status(500).json({ error: "Failed to fetch sample tickets" });
  }
});

app.use("/api", authRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/competitions", competitionRoutes);
app.use("/admin", adminRoutes);
app.use("/api/responsible", responsibleRoutes);
app.use("/api/account", accountDeleteRoutes);
app.use("/api/preferences", preferencesRoutes);

// ✅ NEW: saved basket route
app.use("/api/basket", savedBasketRoutes);

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

    // ✅ NEW: Start abandoned basket cron job
    startAbandonedBasketJob();
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));