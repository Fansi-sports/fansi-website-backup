// routes/preferences.js

const express = require("express");
const router = express.Router();
const User = require("../models/User");

// GET /api/preferences/:id
// Returns { favoriteTeam: { sport, team } } or empty strings if not set
router.get("/:id", async (req, res) => {
  try {
    const u = await User.findById(req.params.id).select("favoriteTeam");
    if (!u) return res.status(404).json({ message: "User not found" });
    return res.json({ favoriteTeam: u.favoriteTeam || { sport: "", team: "" } });
  } catch (err) {
    console.error("Fetch favourite team failed:", err);
    return res.status(500).json({ message: "Failed to fetch favourite team" });
  }
});

// PUT /api/preferences/:id
// Body: { sport: string, team: string }  (send empty strings to clear)
router.put("/:id", async (req, res) => {
  try {
    const { sport = "", team = "" } = req.body || {};
    const cleanSport = String(sport || "").trim();
    const cleanTeam = String(team || "").trim();

    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ message: "User not found" });

    u.favoriteTeam = { sport: cleanSport, team: cleanTeam };
    await u.save();

    return res.json({ favoriteTeam: u.favoriteTeam });
  } catch (err) {
    console.error("Save favourite team failed:", err);
    return res.status(500).json({ message: "Failed to save favourite team" });
  }
});

module.exports = router;
