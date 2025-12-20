const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();

// Filter HOD tasks (self or team)
router.post("/filter", async (req, res) => {
  try {
    console.log('HOD tasks filter request received:', req.body);
    const {
      user_id, // HOD user_id
      view_tasks_of, // "self" or "team"
      target_user_id, // for team view: the team member whose tasks to view
      date_filter,
      task_type,
      category, // "all", "self", "assigned"
      status,
      custom_date
    } = req.body;

    // Determine whose tasks to view
    const targetUserId = view_tasks_of === "self" ? user_id : target_user_id;

    if (view_tasks_of === "team" && !target_user_id) {
      return res.status(400).json({ error: "target_user_id required when viewing team tasks" });
    }

    const format = (d) => new Date(d).toISOString().split("T")[0];

    let today = new Date();
    let formattedToday = format(today);

    let startDate = null;
    let endDate = null;

    // ---------------------- DATE FILTER LOGIC ----------------------

    if (date_filter === "today") {
      startDate = endDate = formattedToday;
    }

    if (date_filter === "yesterday") {
      let d = new Date();
      d.setDate(d.getDate() - 1);
      startDate = endDate = format(d);
    }

    if (date_filter === "custom") {
      startDate = endDate = custom_date;
    }

    if (date_filter === "past_week") {
      let d = new Date();
      d.setDate(d.getDate() - 7);

      let weekday = d.getDay();
      let monday = new Date(d);
      monday.setDate(d.getDate() - ((weekday + 6) % 7));

      let saturday = new Date(monday);
      saturday.setDate(monday.getDate() + 5);

      startDate = format(monday);
      endDate = format(saturday);
    }

    if (date_filter === "past_month") {
      let now = new Date();
      let first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      let last = new Date(now.getFullYear(), now.getMonth(), 0);

      startDate = format(first);
      endDate = format(last);
    }

    // ---------------------- FILTER BUILDER ----------------------
    const applyFilters = (table) => {
      let q;

      if (table === "self_tasks") {
        q = supabase.from(table).select("*").eq("user_id", targetUserId);
      } else {
        q = supabase.from(table).select(`
          *,
          users!assigned_by(name)
        `).eq("assigned_to", targetUserId);
      }

      if (startDate && endDate) {
        q = q.gte("date", startDate).lte("date", endDate);
      }

      // Task type filter only applies to self_tasks
      if (table === "self_tasks" && task_type && task_type !== "all") {
        q = q.eq("task_type", task_type);
      }

      if (status && status !== "all") {
        q = q.eq("status", status);
      }

      return q;
    };

    // ---------------------- FETCH BASED ON CATEGORY ----------------------
    let response = {};

    if (category === "all") {
      // Fetch both self_tasks and master_tasks
      const [selfRes, masterRes] = await Promise.all([
        applyFilters("self_tasks"),
        applyFilters("master_tasks")
      ]);

      if (selfRes.error || masterRes.error) {
        return res.status(400).json({
          error: selfRes.error?.message || masterRes.error?.message
        });
      }

      response = {
        self_tasks: selfRes.data,
        master_tasks: masterRes.data
      };
    } else if (category === "self") {
      // Fetch only self_tasks
      const { data, error } = await applyFilters("self_tasks");
      if (error) return res.status(400).json({ error: error.message });

      response = { self_tasks: data, master_tasks: [] };
    } else if (category === "assigned") {
      // Fetch only master_tasks
      const { data, error } = await applyFilters("master_tasks");
      if (error) return res.status(400).json({ error: error.message });

      response = { self_tasks: [], master_tasks: data };
    } else {
      return res.status(400).json({ error: "Invalid category. Must be 'all', 'self', or 'assigned'" });
    }

    console.log('HOD filter response:', {
      view_tasks_of,
      target_user: targetUserId,
      self_tasks_count: response.self_tasks?.length || 0,
      master_tasks_count: response.master_tasks?.length || 0
    });

    res.json(response);

  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Create self task for HOD
router.post("/create", async (req, res) => {
  try {
    const {
      user_id,
      date,
      timeline,
      task_name,
      time,
      task_type,
      status,
      file_link
    } = req.body;

    const { data, error } = await supabase
      .from("self_tasks")
      .insert([
        {
          user_id,
          date,
          timeline,
          task_name,
          time,
          task_type,
          status,
          file_link
        }
      ]).select();

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      message: "Task created successfully",
      task: data[0]
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});


// Update self task for HOD
router.put("/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const {
      user_id,
      date,
      timeline,
      task_name,
      time,
      task_type,
      status,
      file_link
    } = req.body;

    const { data, error } = await supabase
      .from("self_tasks")
      .update({
        user_id,
        date,
        timeline,
        task_name,
        time,
        task_type,
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

  // Get team members for task viewing dropdown (excluding current HOD)
  router.get("/team-members/:department/:exclude_user_id", async (req, res) => {
    try {
      const { department, exclude_user_id } = req.params;

      const { data, error } = await supabase
        .from("users")
        .select("user_id, name, email")
        .eq("dept", department)
        .neq("user_id", exclude_user_id);

      if (error) return res.status(400).json({ error: error.message });

      res.json({ team_members: data });

    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

module.exports = router;