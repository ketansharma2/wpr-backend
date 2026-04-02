const express = require("express");
const supabase = require("../config/supabase");
const router = express.Router();
const auth = require("./auth/authMiddleware");

// Get SOP for a user (or specific user for HOD/Admin)
router.get("/", auth, async (req, res) => {
  try {
    let targetUserId = req.user.id;

    // Allow HOD/Admin/Sub Admin to fetch another user's SOP
    if (
      req.query.user_id &&
      (
        req.user.user_type === "HOD" ||
        req.user.user_type === "Admin" ||
        req.user.user_type === "Sub Admin"
      )
    ) {
      targetUserId = req.query.user_id;
    }

    const { data: sopEntries, error } = await supabase
      .from("sop")
      .select("*")
      .eq("user_id", targetUserId);

    if (error) {
      console.error("SOP fetch error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json(sopEntries || []);

  } catch (error) {
    console.error("SOP error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Create SOP
router.post("/", auth, async (req, res) => {
  try {
    const { links } = req.body;
    let user_id = req.user.id;

    const target_user_id = user_id || req.user.id;

    if (!links) {
      return res.status(400).json({ error: "links required" });
    }

    const { data: sopEntry, error } = await supabase
      .from("sop")
      .insert({
        user_id: target_user_id,
        links
      })
      .select()
      .single();

    if (error) {
      console.error("SOP creation error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json(sopEntry);

  } catch (error) {
    console.error("SOP creation error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Update SOP
router.put("/:id", auth, async (req, res) => {
  try {
    const logged_in_user_id = req.user.id;
    const sop_id = req.params.id;
    const { links } = req.body;

    let query = supabase
      .from("sop")
      .update({
        links
      })
      .eq("id", sop_id);

    if (
      req.user.user_type !== "HOD" &&
      req.user.user_type !== "Sub Admin"
    ) {
      query = query.eq("user_id", logged_in_user_id);
    }

    const { data: sopEntry, error } = await query.select().single();

    if (error) {
      console.error("SOP update error:", error);
      return res.status(400).json({ error: error.message });
    }

    if (!sopEntry) {
      return res.status(404).json({ error: "SOP not found" });
    }

    res.json(sopEntry);

  } catch (error) {
    console.error("SOP update error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete SOP
router.delete("/:id", auth, async (req, res) => {
  try {
    const logged_in_user_id = req.user.id;
    const sop_id = req.params.id;

    let query = supabase
      .from("sop")
      .delete()
      .eq("id", sop_id);

    if (
      req.user.user_type !== "HOD" &&
      req.user.user_type !== "Sub Admin"
    ) {
      query = query.eq("user_id", logged_in_user_id);
    }

    const { error } = await query;

    if (error) {
      console.error("SOP delete error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: "SOP deleted successfully" });

  } catch (error) {
    console.error("SOP delete error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;