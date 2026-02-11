const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();
const auth = require("../auth/authMiddleware");

// Get all monthly projections (HOD can fetch for their department)
router.get("/", auth, async (req, res) => {
  try {
    const logged_in_user_id = req.user.id;
    const { user_id, month } = req.query;

    let query = supabase
      .from("monthly_projection")
      .select("*");

    if (user_id) {
      query = query.eq("assigned_to", user_id);
    } else {
      if (req.user.user_type === 'Admin') {
        // For admin, show all or filter by month if provided
        if (month) {
          query = query.eq("month", month);
        }
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

        const teamMemberIds = teamMembers.map(member => member.user_id);
        query = query.in("assigned_to", teamMemberIds);

        if (month) {
          query = query.eq("month", month);
        }
      }
    }

    query = query.order("created_at", { ascending: true });

    const { data: projections, error } = await query;

    if (error) {
      console.error("Monthly projections fetch error:", error);
      return res.status(400).json({ error: error.message });
    }

    // Fetch user names for assigned_by and assigned_to
    const userIds = new Set();
    projections.forEach(p => {
      if (p.assigned_by) userIds.add(p.assigned_by);
      if (p.assigned_to) userIds.add(p.assigned_to);
    });

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("user_id, name")
      .in("user_id", Array.from(userIds));

    if (usersError) {
      console.error("Users fetch error:", usersError);
    }

    const userMap = {};
    if (users) {
      users.forEach(user => {
        userMap[user.user_id] = user.name;
      });
    }

    // Fetch subtasks for all projects
    const projectIds = projections.map(p => p.project_id);
    const { data: subtasks, error: subtasksError } = await supabase
      .from("project_subtasks")
      .select("*")
      .in("project_id", projectIds);

    if (subtasksError) {
      console.error("Subtasks fetch error:", subtasksError);
    }

    const subtaskMap = {};
    if (subtasks) {
      subtasks.forEach(subtask => {
        if (!subtaskMap[subtask.project_id]) {
          subtaskMap[subtask.project_id] = [];
        }
        subtaskMap[subtask.project_id].push(subtask);
      });
    }

    // Merge data
    const result = projections.map(projection => ({
      ...projection,
      assigned_by_name: userMap[projection.assigned_by] || null,
      assigned_to_name: userMap[projection.assigned_to] || null,
      subtasks: subtaskMap[projection.project_id] || []
    }));

    res.json(result || []);

  } catch (error) {
    console.error("Monthly projections error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Create a new monthly projection (HOD can create for team members)
router.post("/", auth, async (req, res) => {
  try {
    const logged_in_user_id = req.user.id;
    const { month, project_name, assigned_to, deadline, lock_subtasks, remarks } = req.body;

    if (!month || !project_name) {
      return res.status(400).json({ error: "month and project_name are required" });
    }

    const { data: projection, error } = await supabase
      .from("monthly_projection")
      .insert({
        month,
        project_name,
        assigned_to: assigned_to || null,
        assigned_by: logged_in_user_id,
        deadline: deadline || null,
        is_locked: lock_subtasks || false,
        remarks: remarks || null
      })
      .select()
      .single();

    if (error) {
      console.error("Monthly projection creation error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json(projection);

  } catch (error) {
    console.error("Monthly projection creation error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Update a monthly projection (HOD can update team members' projections)
router.put("/:id", auth, async (req, res) => {
  try {
    const logged_in_user_id = req.user.id;
    const project_id = req.params.id;
    const { month, project_name, assigned_to, deadline, lock_subtasks, remarks } = req.body;

    const updateData = {};
    if (month !== undefined) updateData.month = month;
    if (project_name !== undefined) updateData.project_name = project_name;
    if (assigned_to !== undefined) updateData.assigned_to = assigned_to;
    if (deadline !== undefined) updateData.deadline = deadline;
    if (lock_subtasks !== undefined) updateData.is_locked = lock_subtasks;
    if (remarks !== undefined) updateData.remarks = remarks;

    const { data: projection, error } = await supabase
      .from("monthly_projection")
      .update(updateData)
      .eq("project_id", project_id)
      .select()
      .single();

    if (error) {
      console.error("Monthly projection update error:", error);
      return res.status(400).json({ error: error.message });
    }

    if (!projection) {
      return res.status(404).json({ error: "Monthly projection not found" });
    }

    res.json(projection);

  } catch (error) {
    console.error("Monthly projection update error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Lock/unlock a monthly projection
router.put("/:id/lock", auth, async (req, res) => {
  try {
    const project_id = req.params.id;
    const { lock_subtasks } = req.body;

    if (lock_subtasks === undefined) {
      return res.status(400).json({ error: "lock_subtasks status is required" });
    }

    const { data: projection, error } = await supabase
      .from("monthly_projection")
      .update({ is_locked: lock_subtasks })
      .eq("project_id", project_id)
      .select()
      .single();

    if (error) {
      console.error("Monthly projection lock update error:", error);
      return res.status(400).json({ error: error.message });
    }

    if (!projection) {
      return res.status(404).json({ error: "Monthly projection not found" });
    }

    res.json(projection);

  } catch (error) {
    console.error("Monthly projection lock update error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete a monthly projection
router.delete("/:id", auth, async (req, res) => {
  try {
    const project_id = req.params.id;

    const { error } = await supabase
      .from("monthly_projection")
      .delete()
      .eq("project_id", project_id);

    if (error) {
      console.error("Monthly projection deletion error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: "Monthly projection deleted successfully" });

  } catch (error) {
    console.error("Monthly projection deletion error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Create a new subtask for a project
router.post("/:project_id/subtasks", auth, async (req, res) => {
  try {
    const project_id = req.params.project_id;
    const { task_name, deadline, status } = req.body;

    if (!task_name) {
      return res.status(400).json({ error: "task_name is required" });
    }

    const { data: subtask, error } = await supabase
      .from("project_subtasks")
      .insert({
        project_id,
        task_name,
        deadline: deadline || null,
        status: status || 'Pending'
      })
      .select()
      .single();

    if (error) {
      console.error("Subtask creation error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json(subtask);

  } catch (error) {
    console.error("Subtask creation error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Update a subtask
router.put("/:project_id/subtasks/:subtask_id", auth, async (req, res) => {
  try {
    const project_id = req.params.project_id;
    const subtask_id = req.params.subtask_id;
    const { task_name, deadline, status } = req.body;

    const updateData = {};
    if (task_name !== undefined) updateData.task_name = task_name;
    if (deadline !== undefined) updateData.deadline = deadline;
    if (status !== undefined) updateData.status = status;

    const { data: subtask, error } = await supabase
      .from("project_subtasks")
      .update(updateData)
      .eq("subtask_id", subtask_id)
      .eq("project_id", project_id)
      .select()
      .single();

    if (error) {
      console.error("Subtask update error:", error);
      return res.status(400).json({ error: error.message });
    }

    if (!subtask) {
      return res.status(404).json({ error: "Subtask not found" });
    }

    res.json(subtask);

  } catch (error) {
    console.error("Subtask update error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete a subtask
router.delete("/:project_id/subtasks/:subtask_id", auth, async (req, res) => {
  try {
    const project_id = req.params.project_id;
    const subtask_id = req.params.subtask_id;

    const { error } = await supabase
      .from("project_subtasks")
      .delete()
      .eq("subtask_id", subtask_id)
      .eq("project_id", project_id);

    if (error) {
      console.error("Subtask deletion error:", error);
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: "Subtask deleted successfully" });

  } catch (error) {
    console.error("Subtask deletion error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
