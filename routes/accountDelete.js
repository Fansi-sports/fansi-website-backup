// routes/accountDelete.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");

// IMPORTANT: In production, protect this with auth middleware to ensure
// the caller is the actual owner. For now, keeping it simple per your flow.

/**
 * DELETE /api/account/:userId
 * Permanently deletes the user account.
 * (Hard delete — removes the document entirely.)
 */
router.delete("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const existing = await User.findById(userId);
    if (!existing) {
      return res.status(404).json({ message: "User not found" });
    }

    await User.findByIdAndDelete(userId);

    return res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/account error:", err);
    return res.status(500).json({ message: "Failed to delete account" });
  }
});

module.exports = router;
