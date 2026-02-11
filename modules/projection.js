  const express = require("express");
  const supabase = require("../config/supabase");
  const router = express.Router();
  const auth = require("./auth/authMiddleware");

  // Get projections for the logged-in user (matching assigned_to) with subtasks
  router.get("/", auth, async (req, res) => {
    try {
      const logged_in_user_id = req.user.id;
      const { month } = req.query;

      // First, fetch projections
      let query = supabase
        .from("monthly_projection")
        .select("*")
        .eq("assigned_to", logged_in_user_id);

      if (month) {
        query = query.eq("month", month);
      }

      query = query.order("created_at", { ascending: true });

      const { data: projections, error: projectionsError } = await query;

      if (projectionsError) {
        console.error("Projections fetch error:", projectionsError);
        return res.status(400).json({ error: projectionsError.message });
      }

      if (!projections || projections.length === 0) {
        return res.json([]);
      }

      // Get all unique user IDs from assigned_by and assigned_to fields
      const userIds = new Set();
      projections.forEach(p => {
        if (p.assigned_by) userIds.add(p.assigned_by);
        if (p.assigned_to) userIds.add(p.assigned_to);
      });

      console.log("User IDs to fetch:", Array.from(userIds));

      // Fetch user names for these user IDs
      let usersMap = {};
      if (userIds.size > 0) {
        const { data: users, error: usersError } = await supabase
          .from("users")
          .select("user_id, name")
          .in("user_id", Array.from(userIds));

        console.log("Users fetched:", users);
        console.log("Users error:", usersError);

        if (!usersError && users) {
          users.forEach(user => {
            usersMap[user.user_id] = user.name;
          });
        }
      }

      console.log("Users map:", usersMap);

      // Get all project IDs
      const projectIds = projections.map(p => p.project_id);

      // Fetch all subtasks for these projects
      const { data: subtasks, error: subtasksError } = await supabase
        .from("project_subtasks")
        .select("*")
        .in("project_id", projectIds)
        .order("created_at", { ascending: true });

      if (subtasksError) {
        console.error("Subtasks fetch error:", subtasksError);
        // Return projections without subtasks if subtasks fetch fails
        return res.json(projections.map(p => ({ 
          ...p,
          assigned_by_name: usersMap[p.assigned_by] || p.assigned_by,
          assigned_to_name: usersMap[p.assigned_to] || p.assigned_to,
          project_subtasks: []
        })));
      }

      // Group subtasks by project_id
      const subtasksByProject = {};
      (subtasks || []).forEach(subtask => {
        if (!subtasksByProject[subtask.project_id]) {
          subtasksByProject[subtask.project_id] = [];
        }
        subtasksByProject[subtask.project_id].push(subtask);
      });

      // Merge subtasks with projections and add user names
      const projectionsWithSubtasks = projections.map(projection => ({
        ...projection,
        assigned_by_name: usersMap[projection.assigned_by] || projection.assigned_by,
        assigned_to_name: usersMap[projection.assigned_to] || projection.assigned_to,
        project_subtasks: subtasksByProject[projection.project_id] || []
      }));

      console.log("Projections with subtasks:", projectionsWithSubtasks);

      res.json(projectionsWithSubtasks);

    } catch (error) {
      console.error("Projections error:", error);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Get subtasks for a specific project by joining with project_subtasks
  router.get("/:project_id/subtasks", auth, async (req, res) => {
    try {
      const { project_id } = req.params;

      const { data: subtasks, error } = await supabase
        .from("project_subtasks")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Project subtasks fetch error:", error);
        return res.status(400).json({ error: error.message });
      }

      res.json(subtasks || []);

    } catch (error) {
      console.error("Project subtasks error:", error);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Create a new subtask for a project
  router.post("/:project_id/subtasks", auth, async (req, res) => {
    try {
      const { project_id } = req.params;
      const { task_name, status, deadline } = req.body;

      if (!task_name) {
        return res.status(400).json({ error: "task_name is required" });
      }

      const { data: subtask, error } = await supabase
        .from("project_subtasks")
        .insert({
          project_id,
          task_name,
          status: status || 'Pending',
          deadline: deadline || null
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
      const { project_id, subtask_id } = req.params;
      const { task_name, status, deadline } = req.body;

      if (!task_name) {
        return res.status(400).json({ error: "task_name is required" });
      }

      const { data: subtask, error } = await supabase
        .from("project_subtasks")
        .update({
          task_name,
          status: status || 'Pending',
          deadline: deadline || null
        })
        .eq("subtask_id", subtask_id)
        .eq("project_id", project_id)
        .select()
        .single();

      if (error) {
        console.error("Subtask update error:", error);
        return res.status(400).json({ error: error.message });
      }

      res.json(subtask);

    } catch (error) {
      console.error("Subtask update error:", error);
      res.status(500).json({ error: "Server error" });
    }
  });

  module.exports = router;
