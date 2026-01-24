const express = require("express");
const supabase = require("../config/supabase");
const router = express.Router();
const auth = require("./auth/authMiddleware");

router.use(auth);
    
// Get all subtasks for a specific task
router.get("/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({ error: "Task ID is required" });
    }

    // Fetch subtasks from subtasks table
    const { data: subtasks, error } = await supabase
      .from("subtasks")
      .select("*")
      .eq("task_id", taskId)
      .order("date", { ascending: true });

    if (error) {
      console.error("Error fetching subtasks:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: "Subtasks fetched successfully",
      subtasks: subtasks || []
    });

  } catch (err) {
    console.error("Server error fetching subtasks:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Create a new subtask
router.post("/", async (req, res) => {
  try {
    const {
      task_id,
      subtask_name,
      date,
      timeline,
      time_spent,
      file_links,
      status,
      remarks
    } = req.body;

    if (!task_id || !subtask_name) {
      return res.status(400).json({ error: "task_id and subtask_name are required" });
    }

    const { data: subtask, error } = await supabase
      .from("subtasks")
      .insert([
        {
          task_id,
          subtask_name,
          date,
          timeline,
          time_spent: time_spent || 0,
          file_links: file_links || [],
          status: status || 'pending',
          remarks: remarks || ''
        }
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating subtask:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: "Subtask created successfully",
      subtask
    });

  } catch (err) {
    console.error("Server error creating subtask:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Update a subtask
router.put("/:subtaskId", async (req, res) => {
  try {
    const { subtaskId } = req.params;
    const {
      subtask_name,
      date,
      timeline,
      time_spent,
      file_links,
      status,
      remarks
    } = req.body;

    const { data: subtask, error } = await supabase
      .from("subtasks")
      .update({
        subtask_name,
        date,
        timeline,
        time_spent,
        file_links,
        status,
        remarks
      })
      .eq("subtask_id", subtaskId)
      .select()
      .single();

    if (error) {
      console.error("Error updating subtask:", error);
      return res.status(400).json({ error: error.message });
    }

    if (!subtask) {
      return res.status(404).json({ error: "Subtask not found" });
    }

    res.json({
      message: "Subtask updated successfully",
      subtask
    });

  } catch (err) {
    console.error("Server error updating subtask:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete a subtask
router.delete("/:subtaskId", async (req, res) => {
  try {
    const { subtaskId } = req.params;

    const { error } = await supabase
      .from("subtasks")
      .delete()
      .eq("subtask_id", subtaskId);

    if (error) {
      console.error("Error deleting subtask:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: "Subtask deleted successfully"
    });

  } catch (err) {
    console.error("Server error deleting subtask:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
