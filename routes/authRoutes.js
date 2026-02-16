// backend/routes/authRoutes.js
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ✅ NEW: Email service
const { sendWelcomeEmail } = require("../services/emailService");

// ---------- helpers ----------
const normalizeEmail = (e) => (e || "").toLowerCase().trim();

// Utility: only keep fields we explicitly allow to be updated
function pick(obj, keys) {
  return keys.reduce((acc, k) => {
    if (obj[k] !== undefined) acc[k] = obj[k];
    return acc;
  }, {});
}

// SIGNUP
router.post("/signup", async (req, res) => {
  try {
    const {
      name,
      firstName,
      lastName,
      email,
      phone,
      password,
      marketingOptIn,
      favouriteSport,
      favouriteTeam,
      favoriteSport,
      favoriteTeam,
      is18PlusConfirmed,
    } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    if (!is18PlusConfirmed) {
      return res.status(400).json({ message: "You must confirm you are 18+ to create an account." });
    }

    const fullName =
      (name && name.trim()) ||
      `${firstName || ""} ${lastName || ""}`.trim();

    if (!fullName) {
      return res.status(400).json({ message: "Name is required." });
    }

    const safeEmail = normalizeEmail(email);

    const existing = await User.findOne({ email: safeEmail });
    if (existing) {
      return res.status(409).json({ message: "User already exists with that email." });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({
      name: fullName,
      email: safeEmail,
      phone: phone || "",
      password: hashed,
      is18PlusConfirmed: true,
      ageConfirmedAt: new Date(),
      marketingOptIn: !!marketingOptIn,
      favouriteSport: (favouriteSport ?? favoriteSport) || "",
      favouriteTeam:  (favouriteTeam  ?? favoriteTeam)  || "",
    });

    await user.save();

    // ✅ NEW: Send welcome email (fire and forget - won't break signup if it fails)
    const resolvedFirstName = firstName || fullName.split(" ")[0] || "there";
    sendWelcomeEmail({
      to: safeEmail,
      firstName: resolvedFirstName,
    }).catch(err => console.error("Welcome email failed silently:", err));

    return res.status(201).json({ message: "User created" });
  } catch (err) {
    if (err && err.code === 11000 && err.keyPattern && err.keyPattern.email) {
      return res.status(409).json({ message: "User already exists with that email." });
    }
    console.error("Signup failed:", err);
    return res.status(500).json({ message: "Signup failed" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    return res.json({ token });
  } catch (err) {
    console.error("Login failed:", err);
    return res.status(500).json({ message: "Login failed" });
  }
});

// UPDATE USER DETAILS
router.put("/update-details/:id", async (req, res) => {
  try {
    const allowed = [
      "name",
      "email",
      "phone",
      "dob",
      "address",
      "postcode",
      "marketingOptIn",
      "favouriteSport",
      "favouriteTeam",
      "favoriteSport",
      "favoriteTeam",
    ];

    const body = req.body || {};
    const updates = pick(body, allowed);

    if (updates.favoriteSport && !updates.favouriteSport) {
      updates.favouriteSport = updates.favoriteSport;
    }
    if (updates.favoriteTeam && !updates.favouriteTeam) {
      updates.favouriteTeam = updates.favoriteTeam;
    }
    delete updates.favoriteSport;
    delete updates.favoriteTeam;

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).select("-password");

    if (!updated) return res.status(404).json({ message: "User not found" });
    return res.json(updated);
  } catch (err) {
    console.error("Update details failed:", err);
    return res.status(500).json({ message: "Failed to update details" });
  }
});

// CHANGE PASSWORD
router.put("/change-password/:id", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(400).json({ message: "Current password is incorrect" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ message: "Password updated" });
  } catch (err) {
    console.error("Change password failed:", err);
    return res.status(500).json({ message: "Failed to change password" });
  }
});

// GET USER BY ID
router.get("/user/:id", async (req, res) => {
  try {
    const u = await User.findById(req.params.id).select("-password");
    if (!u) return res.status(404).json({ message: "User not found" });
    return res.json(u);
  } catch (err) {
    console.error("Fetch user failed:", err);
    return res.status(500).json({ message: "Failed to fetch user" });
  }
});

module.exports = router;