const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();
const auth = require("../auth/authMiddleware");

// Assign task to team member
router.post("/create", auth, async (req, res) => {
  try {
    const {
      user_id,
      assigned_by,
      assigned_to,
      date,
      timeline,
      task_name,
      status,
      assignee_remarks,
      upload_closing,
      remarks,
      parameter,
      end_goal
    } = req.body;

    // Insert into master_tasks
    const { data, error } = await supabase
      .from("master_tasks")
      .insert([
        {
          user_id,
          assigned_by,
          assigned_to,
          date,
          timeline,
          task_name,
          status,
          assignee_remarks,
          upload_closing,
          remarks,
          parameter,
          end_goal
        }
      ])
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      message: "Task assigned successfully",
      task: data[0]
    });

  } catch (err) {
    console.error("Assign task error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;