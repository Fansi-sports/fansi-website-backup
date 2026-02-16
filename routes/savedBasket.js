// routes/savedBasket.js
const express = require("express");
const router = express.Router();
const SavedBasket = require("../models/SavedBasket");

// ✅ Save or update a user's basket
// POST /api/basket/save
router.post("/save", async (req, res) => {
  try {
    const { userId, email, firstName, items } = req.body || {};

    if (!userId || !email) {
      return res.status(400).json({ error: "userId and email are required" });
    }

    // If basket is empty, delete any saved basket for this user
    if (!Array.isArray(items) || items.length === 0) {
      await SavedBasket.deleteOne({ userId });
      return res.json({ message: "Basket cleared" });
    }

    // Save or update basket - reset reminder flags since basket changed
    await SavedBasket.findOneAndUpdate(
      { userId },
      {
        userId,
        email,
        firstName: firstName || "",
        items,
        savedAt: new Date(),
        reminderSent: false,
        reminderSentAt: null,
        checkedOut: false,
      },
      { upsert: true, new: true }
    );

    return res.json({ message: "Basket saved" });
  } catch (err) {
    console.error("Save basket error:", err);
    return res.status(500).json({ error: "Failed to save basket" });
  }
});

// ✅ Mark basket as checked out (called after successful payment)
// POST /api/basket/checkout
router.post("/checkout", async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "userId required" });

    await SavedBasket.findOneAndUpdate(
      { userId },
      { checkedOut: true },
      { new: true }
    );

    return res.json({ message: "Basket marked as checked out" });
  } catch (err) {
    console.error("Checkout basket error:", err);
    return res.status(500).json({ error: "Failed to update basket" });
  }
});

module.exports = router;