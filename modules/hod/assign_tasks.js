const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();

// Assign task to team member
router.post("/create", async (req, res) => {
  try {
    const {
      user_id, // HOD user_id
      assigned_by, // HOD user_id
      assigned_to, // team member user_id
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

// Get list of team members for assignment
router.get("/team-members/:department", async (req, res) => {
  try {
    const { department } = req.params;

    const { data, error } = await supabase
      .from("users")
      .select("user_id, name, email")
      .eq("department", department);

    if (error) return res.status(400).json({ error: error.message });

    res.json({ team_members: data });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Update assigned task (only by the HOD who assigned it)
router.put("/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const {
      assigned_by, // HOD user_id (to verify ownership)
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

    // First verify that this HOD assigned this task
    const { data: existingTask, error: fetchError } = await supabase
      .from("master_tasks")
      .select("assigned_by")
      .eq("task_id", taskId)
      .single();

    if (fetchError) return res.status(400).json({ error: fetchError.message });

    if (existingTask.assigned_by !== assigned_by) {
      return res.status(403).json({ error: "You can only update tasks you assigned" });
    }

    // Update the task
    const { data, error } = await supabase
      .from("master_tasks")
      .update({
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
      })
      .eq("task_id", taskId)
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      message: "Assigned task updated successfully",
      task: data[0]
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;