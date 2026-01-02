const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();
const auth = require("../auth/authMiddleware");

// Get R&R entries for admin panel (admin can view specific user's R&R or all if specified)
router.get("/", auth, async (req, res) => {
  try {
    // Only allow admin users
    if (req.user.user_type !== 'Admin') {
      return res.status(403).json({ error: "Access denied. Admin privileges required." });
    }

    const { user_id } = req.query;

    // If no user_id provided, return empty array (user must select a member first)
    if (!user_id) {
      return res.json([]);
    }

    let query = supabase
      .from("rnr")
      .select(`
        *,
        users!user_id(name, email, dept)
      `);

    // If user_id is 'all', fetch for all users; otherwise, fetch for specific user
    if (user_id !== 'all') {
      query = query.eq("user_id", user_id);
    }

    query = query.order("created_at", { ascending: true });

    const { data: rnrEntries, error } = await query;

    if (error) {
      console.error("Admin R&R fetch error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json(rnrEntries || []);

  } catch (error) {
    console.error("Admin R&R error:", error);
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