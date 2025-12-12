const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();
const auth = require("../auth/authMiddleware");
// Admin assign task to any member
router.post("/create", async (req, res) => {
  try {
    const {
      assigned_by, // Admin user_id
      assigned_to, // Any member user_id
      date,
      timeline,
      task_name,
      time,
      status,
      file_link
    } = req.body;

    const { data, error } = await supabase
      .from("master_tasks")
      .insert([
        {
          assigned_by,
          assigned_to,
          date,
          timeline,
          task_name,
          time,
          status,
          file_link
        }
      ]).select();

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      message: "Task assigned successfully",
      task: data[0]
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Update any assigned task (admin can edit any task)
router.put("/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const {
      assigned_by,
      assigned_to,
      date,
      timeline,
      task_name,
      time,
      status,
      file_link
    } = req.body;

    const { data, error } = await supabase
      .from("master_tasks")
      .update({
        assigned_by,
        assigned_to,
        date,
        timeline,
        task_name,
        time,
        status,
        file_link
      })
      .eq("task_id", taskId)
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      message: "Task updated successfully",
      task: data[0]
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/members", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("user_id, name, email, dept, role")
      .order("name");

    if (error) return res.status(400).json({ error: error.message });

    res.json({ members: data });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;