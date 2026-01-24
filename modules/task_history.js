const express = require("express");
const supabase = require("../config/supabase");
const router = express.Router();
const auth = require("./auth/authMiddleware");

// Get task history for a specific task_id
router.get("/:task_id", auth, async (req, res) => {
  try {
    const { task_id } = req.params;

    if (!task_id) {
      return res.status(400).json({ error: "Task ID is required" });
    }

    // Fetch task history from task_history table
    const { data: historyData, error } = await supabase
      .from("task_history")
      .select(`
        *,
        created_by_user:users!created_by(name)
      `)
      .eq("task_id", task_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching task history:", error);
      return res.status(400).json({ error: error.message });
    }

    // Transform the data to match frontend expectations
    const formattedHistory = (historyData || []).map(item => ({
      changed_at: item.created_at,
      history_date: item.history_date,
      time_spent: item.time_spent,
      remarks: item.remarks || '',
      status: item.status || '',
      changed_by: item.created_by_user?.name || 'System'
    }));

    res.json({
      history: formattedHistory
    });

  } catch (err) {
    console.error("Server error fetching task history:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;