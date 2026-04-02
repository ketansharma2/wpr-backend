const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();
const auth = require("../auth/authMiddleware");

// Get R&R entries for admin panel (admin can view specific user's R&R or all if specified)
router.get("/", auth, async (req, res) => {
  try {
    let targetUserId = req.user.id;

    // Allow HOD, admin, and Sub Admin to fetch R&R for specific user
    if (req.query.user_id && (req.user.user_type === 'HOD' || req.user.user_type === 'Admin' || req.user.user_type === 'Sub Admin')) {
      targetUserId = req.query.user_id;
    }
console.log('chekc:',targetUserId);
    const { data: rnrEntries, error } = await supabase
      .from("rnr")
      .select("*")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("R&R fetch error:", error);
      return res.status(400).json({ error: error.message });
    }

    console.log('rnr',rnrEntries);
    res.json(rnrEntries || []);

  } catch (error) {
    console.error("R&R error:", error);
    res.status(500).json({ error: "Server error" });
  }
});
// Get all users for admin RnR filter (excluding the logged-in admin)
router.get("/members", auth, async (req, res) => {
  try {
    // Only allow admin users
    if (req.user.user_type !== 'Admin') {
      return res.status(403).json({ error: "Access denied. Admin privileges required." });
    }

    const { data, error } = await supabase
      .from("users")
      .select("user_id, name, email, dept, role")
      .neq("user_id", req.user.id) // Exclude the logged-in admin
      .order("name");

    if (error) return res.status(400).json({ error: error.message });

    res.json({ members: data });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;