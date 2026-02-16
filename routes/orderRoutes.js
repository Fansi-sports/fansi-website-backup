// routes/orderRoutes.js
const express = require("express");
const router = express.Router();
const Order = require("../models/Order");

// escape regex specials for safe matching
const escapeRe = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Dev-helper: get the most recent 10 orders
router.get("/latest", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(10).lean();
    res.json(orders);
  } catch (err) {
    console.error("orders/latest error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

/**
 * NEW: Fetch orders by userId (what the UI uses first)
 * GET /api/orders/by-user/:userId
 */
router.get("/by-user/:userId", async (req, res) => {
  try {
    const userId = String(req.params.userId || "").trim();
    if (!userId) return res.status(400).json({ error: "userId required" });

    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json(orders);
  } catch (err) {
    console.error("orders/by-user error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Case-insensitive search by email
// GET /api/orders/by-email?email=you@example.com
router.get("/by-email", async (req, res) => {
  try {
    const emailRaw = String(req.query.email || "").trim();
    if (!emailRaw) return res.status(400).json({ error: "email query param required" });

    const re = new RegExp(`^${escapeRe(emailRaw)}$`, "i");
    const orders = await Order.find({ email: { $regex: re } })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json(orders);
  } catch (err) {
    console.error("orders/by-email error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

module.exports = router;
