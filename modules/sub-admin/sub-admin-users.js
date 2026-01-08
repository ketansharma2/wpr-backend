const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();
const auth = require("../auth/authMiddleware");

// Get all users where user_type != 'Admin' and exclude logged-in sub-admin
router.get("/", auth, async (req, res) => {
  try {
    const loggedInUserId = req.user.user_id;

    const { data, error } = await supabase
      .from("users")
      .select("user_id, name, email, dept, role, user_type")
      .neq("user_type", "Admin")
      .neq("user_id", loggedInUserId)
      .order("name");

    if (error) return res.status(400).json({ error: error.message });

    res.json({ users: data });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;