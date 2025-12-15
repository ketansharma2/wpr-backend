const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

router.post("/", async (req, res) => {
  try {
    const { task_id, new_deadline, reason } = req.body;
    const user_id = req.user.id;

    if (!task_id || !new_deadline || !reason) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // 1. Get current deadline
    const { data: task, error: fetchError } = await supabase
      .from("self_tasks")
      .select("timeline")
      .eq("task_id", task_id)
      .eq("user_id", user_id)
      .single();

    if (fetchError || !task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const old_deadline = task.timeline;

    // 2. Insert history
    const { error: historyError } = await supabase
      .from("task_deadline_history")
      .insert({
        task_type: "self",
        task_id: task_id,
        old_deadline: old_deadline,
        new_deadline: new_deadline,
        action: "Pushed",   
        reason: reason,
        changed_by: user_id
      });

    if (historyError) {
      return res.status(500).json({ message: "Failed to save history" });
    }

    // 3. Update task deadline
    const { error: updateError } = await supabase
      .from("self_tasks")
      .update({ timeline: new_deadline })
      .eq("task_id", task_id)
      .eq("user_id", user_id);

    if (updateError) {
      return res.status(500).json({ message: "Failed to update deadline" });
    }

    return res.status(200).json({
      message: "Deadline revised successfully"
    });

  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});




//fetch history of deadline revisions for a task
router.get("/:task_id", async (req, res) => {
  try {
    const { task_id } = req.params;
    const user_id = req.user.id;

    const { data, error } = await supabase
      .from("task_deadline_history")
      .select(`
        id,
        old_deadline,
        new_deadline,
        action,
        reason,
        changed_at
      `)
      .eq("task_type", "self")
      .eq("task_id", task_id)
      .eq("changed_by", user_id)
      .order("changed_at", { ascending: true });

    if (error) {
      return res.status(500).json({ message: "Failed to fetch history" });
    }

    return res.status(200).json({
      task_id,
      history: data
    });

  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});


module.exports = router;
