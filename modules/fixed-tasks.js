const express = require("express");
const supabase = require("../config/supabase");
const router = express.Router();
const auth = require("./auth/authMiddleware");

// Get all fixed tasks for a user
router.get("/", auth, async (req, res) => {
  try {
    const user_id = req.user.id;

    const { data: fixedTasks, error } = await supabase
      .from("fixed_tasks")
      .select("*")
      .eq("user_id", user_id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Fixed tasks fetch error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json(fixedTasks || []);

  } catch (error) {
    console.error("Fixed tasks error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Create a new fixed task
router.post("/", auth, async (req, res) => {
  try {
    const user_id = req.user.id;
      const { task_name, frequency, assigned_by } = req.body;

    if (!task_name) {
      return res.status(400).json({ error: "task_name is required" });
    }

    const { data: fixedTask, error } = await supabase
      .from("fixed_tasks")
      .insert({
        user_id,
        task_name,
        frequency: frequency || "Daily",
        assigned_by: assigned_by || null
      })
      .select()
      .single();

    if (error) {
      console.error("Fixed task creation error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json(fixedTask);

  } catch (error) {
    console.error("Fixed task creation error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Update a fixed task
router.put("/:id", auth, async (req, res) => {
  try {
    const user_id = req.user.id;
    const fixed_task_id = req.params.id;
    const { task_name, description, default_time, default_status, frequency, assigned_by } = req.body;

    const { data: fixedTask, error } = await supabase
      .from("fixed_tasks")
      .update({
        task_name,
        description,
        default_time,
        default_status,
        frequency,
        updated_at: new Date().toISOString()
      })
      .eq("fixed_task_id", fixed_task_id)
      .eq("user_id", user_id)
      .select()
      .single();

    if (error) {
      console.error("Fixed task update error:", error);
      return res.status(400).json({ error: error.message });
    }

    if (!fixedTask) {
      return res.status(404).json({ error: "Fixed task not found" });
    }

    res.json(fixedTask);

  } catch (error) {
    console.error("Fixed task update error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete a fixed task
router.delete("/:id", auth, async (req, res) => {
  try {
    const user_id = req.user.id;
    const fixed_task_id = req.params.id;

    const { error } = await supabase
      .from("fixed_tasks")
      .delete()
      .eq("fixed_task_id", fixed_task_id)
      .eq("user_id", user_id);

    if (error) {
      console.error("Fixed task deletion error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: "Fixed task deleted successfully" });

  } catch (error) {
    console.error("Fixed task deletion error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Auto-populate fixed tasks for today (called by dashboard)
router.post("/auto-populate", auth, async (req, res) => {
  try {
    const user_id = req.user.id;
    const today = new Date().toISOString().split("T")[0];

    // Get all fixed tasks for the user
    const { data: fixedTasks, error: fetchError } = await supabase
      .from("fixed_tasks")
      .select("*")
      .eq("user_id", user_id);

    if (fetchError) {
      console.error("Fixed tasks fetch error:", fetchError);
      return res.status(400).json({ error: fetchError.message });
    }

    const populatedTasks = [];

    for (const fixedTask of fixedTasks || []) {
      // Check if this fixed task already exists for the user (any date)
      const { data: existingTasks, error: checkError } = await supabase
        .from("self_tasks")
        .select("*")
        .eq("user_id", user_id)
        .eq("task_name", fixedTask.task_name)
        .order("date", { ascending: false });

      if (checkError) {
        console.error("Check existing task error:", checkError);
        continue;
      }

      if (existingTasks && existingTasks.length > 0) {
        const existing = existingTasks[0];

        // Only update if the existing task is not already for today
        if (existing.date !== today) {
          // Save to history
          try {
            await supabase
              .from("task_history")
              .insert({
                task_id: existing.task_id,
                task_name: existing.task_name,
                user_id: existing.user_id,
                history_date: existing.date,
                time_spent: existing.time,
                remarks: existing.remarks || '',
                status: existing.status || 'pending',
                created_by: existing.user_id,
              });
          } catch (historyError) {
            console.error("Failed to save to history:", historyError);
          }

          // Update the existing task with today's data
          const { data: updatedTask, error: updateError } = await supabase
            .from("self_tasks")
            .update({
              time: 0,
              status: 'Not Started',
              date: today,
              timeline: today,
              task_type: 'Fixed',
              remarks: ''
            })
            .eq("task_id", existing.task_id)
            .select()
            .single();

          if (updateError) {
            console.error("Auto-populate task update error:", updateError);
            continue;
          }

          populatedTasks.push(updatedTask);
        }
        // If already for today, skip
      } else {
        // Task doesn't exist, create new
        const { data: newTask, error: insertError } = await supabase
          .from("self_tasks")
          .insert({
            user_id,
            task_name: fixedTask.task_name,
            time: 0,
            status: 'Not Started',
            date: today,
            timeline: today,
            task_type: 'Fixed'
          })
          .select()
          .single();

        if (insertError) {
          console.error("Auto-populate task insert error:", insertError);
          continue;
        }

        populatedTasks.push(newTask);
      }
    }

    res.json({
      message: `Auto-populated ${populatedTasks.length} fixed tasks for today`,
      populated_tasks: populatedTasks
    });

  } catch (error) {
    console.error("Auto-populate error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;