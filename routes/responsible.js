// routes/responsible.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");

// NOTE: In production you’d typically protect these routes with auth middleware
// and ensure the JWT userId matches the path param. For now, keeping it simple.

/**
 * GET /api/responsible/:userId
 * Return current responsible-play settings for the user.
 */
router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId, "spendLimitMonthly isFrozen").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      spendLimitMonthly: user.spendLimitMonthly ?? null,
      isFrozen: !!user.isFrozen,
    });
  } catch (err) {
    console.error("GET /responsible error:", err);
    res.status(500).json({ message: "Failed to fetch settings" });
  }
});

/**
 * PUT /api/responsible/:userId
 * Body can include { spendLimitMonthly, isFrozen }
 * - spendLimitMonthly: number >= 0 or null (to clear)
 * - isFrozen: boolean
 */
router.put("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    let { spendLimitMonthly, isFrozen } = req.body;

    const update = {};

    // Normalize spendLimitMonthly
    if (spendLimitMonthly === "" || spendLimitMonthly === undefined) {
      // ignore if omitted
    } else if (spendLimitMonthly === null) {
      update.spendLimitMonthly = null;
    } else {
      const num = Number(spendLimitMonthly);
      if (Number.isNaN(num) || num < 0) {
        return res.status(400).json({ message: "spendLimitMonthly must be a number >= 0 or null" });
      }
      update.spendLimitMonthly = num;
    }

    // Normalize isFrozen
    if (typeof isFrozen === "boolean") {
      update.isFrozen = isFrozen;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: update },
      { new: true, runValidators: true, projection: "spendLimitMonthly isFrozen" }
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      spendLimitMonthly: user.spendLimitMonthly ?? null,
      isFrozen: !!user.isFrozen,
    });
  } catch (err) {
    console.error("PUT /responsible error:", err);
    res.status(500).json({ message: "Failed to save settings" });
  }
});

module.exports = router;
