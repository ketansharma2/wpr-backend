const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();
const auth = require("../auth/authMiddleware");

// Get all fixed tasks for team members (HOD can fetch for all team members in their department)
router.get("/", auth, async (req, res) => {
  try {
    const logged_in_user_id = req.user.id;
    const { user_id } = req.query;

    let target_user_ids = [];

    if (user_id) {
      // Fetch for specific user
      target_user_ids = [user_id];
    } else {
      if (req.user.user_type === 'Admin') {
        // For admin, require user selection - don't show all by default
        return res.json([]);
      } else {
        // Fetch for all team members in HOD's department
        const { data: hodData, error: hodError } = await supabase
          .from("users")
          .select("dept")
          .eq("user_id", logged_in_user_id)
          .single();

        if (hodError) {
          console.error("HOD data error:", hodError);
          return res.status(400).json({ error: hodError.message });
        }

        const { data: teamMembers, error: teamError } = await supabase
          .from("users")
          .select("user_id")
          .eq("dept", hodData.dept);

        if (teamError) {
          console.error("Team members error:", teamError);
          return res.status(400).json({ error: teamError.message });
        }

        target_user_ids = teamMembers.map(member => member.user_id);
      }
    }

    const { data: fixedTasks, error } = await supabase
      .from("fixed_tasks")
      .select(`
        *,
        users!user_id(user_id, name)
      `)
      .in("user_id", target_user_ids)
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

// Create a new fixed task for a specific user (HOD can create for team members)
router.post("/", auth, async (req, res) => {
  try {
    const logged_in_user_id = req.user.id;
    const { task_name, frequency, assigned_by, user_id } = req.body;

    // Use provided user_id or default to logged-in user
    const target_user_id = user_id || logged_in_user_id;

    // TODO: Add permission check to ensure HOD can only assign to their team members

    if (!task_name) {
      return res.status(400).json({ error: "task_name is required" });
    }

    const { data: fixedTask, error } = await supabase
      .from("fixed_tasks")
      .insert({
        user_id: target_user_id,
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

// Update a fixed task (HOD can update team members' tasks)
router.put("/:id", auth, async (req, res) => {
  try {
    const logged_in_user_id = req.user.id;
    const fixed_task_id = req.params.id;
    const { task_name, frequency, assigned_by, user_id } = req.body;

    // TODO: Add permission check to ensure HOD can only update their team members' tasks

    const { data: fixedTask, error } = await supabase
      .from("fixed_tasks")
      .update({
        task_name,
        frequency,
        assigned_by,
        updated_at: new Date().toISOString()
      })
      .eq("fixed_task_id", fixed_task_id)
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

// Delete a fixed task (HOD can delete team members' tasks)
router.delete("/:id", auth, async (req, res) => {
  try {
    const logged_in_user_id = req.user.id;
    const fixed_task_id = req.params.id;

    // TODO: Add permission check to ensure HOD can only delete their team members' tasks

    const { error } = await supabase
      .from("fixed_tasks")
      .delete()
      .eq("fixed_task_id", fixed_task_id);

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

module.exports = router;