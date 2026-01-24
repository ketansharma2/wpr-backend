// Fetch meetings for a specific task
const express = require("express");
const supabase = require("../config/supabase");
const router = express.Router();
const auth = require("./auth/authMiddleware");

router.get("/:task_id", auth, async (req, res) => {
  try {
    const { task_id } = req.params;

    if (!task_id) {
      return res.status(400).json({ error: "Task ID is required" });
    }

    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("task_id", task_id)
      .order("date", { ascending: false });

    if (error) {
      console.error("Error fetching meetings for task:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ meetings: data || [] });
  } catch (err) {
    console.error("Server error fetching meetings for task:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
