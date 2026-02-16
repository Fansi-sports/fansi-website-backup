// routes/payment.js
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
require("dotenv").config();

const Order = require("../models/Order");
const { sendOrderConfirmationEmail } = require("../services/emailService");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

router.post("/create-checkout-session", async (req, res) => {
  try {
    const { items = [], customer = {}, usePoints = false, points = {} } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "No items provided" });
    }

    const requestedUsePoints = !!usePoints || !!points?.requested;

    const rawApplied = requestedUsePoints ? Number(points?.pointsApplied || 0) : 0;
    const pointsApplied =
      Number.isFinite(rawApplied) && rawApplied > 0 ? Math.floor(rawApplied) : 0;

    const payableTotal =
      Number.isFinite(Number(points?.payableTotal))
        ? Number(points.payableTotal)
        : items.reduce((sum, it) => sum + Number(it.qty || 0) * Number(it.price || 0), 0);

    const discountGBP = Number.isFinite(Number(points?.discountGBP)) ? Number(points.discountGBP) : 0;

    const amountTotalPence = Math.max(0, Math.round(payableTotal * 100));

    const order = await Order.create({
      userId: (customer.userId || "").toString(),
      email: (customer.email || "").toString().trim().toLowerCase(),
      name: customer.name || "",
      phone: customer.phone || "",
      address1: customer.address1 || "",
      address2: customer.address2 || "",
      city: customer.city || "",
      postcode: customer.postcode || "",

      items: items.map((i) => ({
        competitionId: String(i.id),
        title: i.title || "",
        qty: Math.max(1, Number(i.qty || 1)),
        unitPrice: Math.round(Number(i.price || 0) * 100),
        currency: "gbp",

        ppt:
          Number.isFinite(Number(i.pointsPerTicket)) && Number(i.pointsPerTicket) > 0
            ? Number(i.pointsPerTicket)
            : 1,

        skillQuestionId: (i.skillQuestionId || "").toString(),
        selectedAnswer: (i.selectedAnswer || "").toString(),
        skillQuestion: (i.skillQuestion || "").toString(),

        tickets: [],
      })),

      amountTotal: amountTotalPence,
      currency: "gbp",

      paymentProvider: "stripe",
      status: "pending",

      pointsApplied,
      pointsEarned: 0,
    });

    let line_items = [];

    if (pointsApplied > 0) {
      const summary = items
        .map((it) => {
          const qty = Math.max(1, Number(it.qty || 1));
          const title = (it.title || "Competition").toString();
          return `${title} x${qty}`;
        })
        .join(", ");

      const descParts = [];
      if (summary) descParts.push(summary);
      if (discountGBP > 0) descParts.push(`Points discount: -£${discountGBP.toFixed(2)}`);
      const description = descParts.join(" | ");

      line_items = [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: amountTotalPence,
            product_data: {
              name: "Fansi Sports Entry",
              description: description || undefined,
            },
          },
        },
      ];
    } else {
      line_items = items.map((it) => ({
        quantity: Math.max(1, Number(it.qty || 1)),
        price_data: {
          currency: "gbp",
          unit_amount: Math.round(Number(it.price || 0) * 100),
          product_data: {
            name: it.title || "Fansi Draw Entry",
            description: it.prizeBlurb || undefined,
          },
        },
      }));
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      allow_promotion_codes: true,
      customer_email: customer.email || undefined,
      line_items,
      metadata: {
        orderId: String(order._id),
        userId: (customer.userId || "").toString(),
      },
      success_url: `${FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/checkout/cancel`,
    });

    await Order.updateOne(
      { _id: order._id },
      {
        $set: {
          paymentSessionId: session.id,
          stripeSessionId: session.id,
        },
      }
    );

    return res.json({ url: session.url, id: session.id, orderId: String(order._id) });
  } catch (err) {
    console.error("Stripe create-session error:", err);
    return res.status(400).json({ error: err.message });
  }
});

// ✅ UPDATED: Now triggers order confirmation email on confirmed payment
router.get("/session/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const session = await stripe.checkout.sessions.retrieve(id);
    const lineItems = await stripe.checkout.sessions.listLineItems(id, { limit: 100 });

    // ✅ If payment is confirmed, update order to "paid" and send confirmation email
    if (session.payment_status === "paid") {
      const order = await Order.findOneAndUpdate(
        {
          stripeSessionId: id,
          status: "pending", // only update if still pending (prevents duplicate emails)
        },
        { $set: { status: "paid" } },
        { new: true } // return the updated order
      );

      // ✅ If we found and updated the order, send confirmation email
      if (order) {
        const firstName = (order.name || "there").split(" ")[0];

        sendOrderConfirmationEmail({
          to: order.email,
          firstName,
          order,
        }).catch(err => console.error("Order confirmation email failed silently:", err));
      }
    }

    res.json({ session, lineItems });
  } catch (err) {
    console.error("Stripe get-session error:", err.message);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;