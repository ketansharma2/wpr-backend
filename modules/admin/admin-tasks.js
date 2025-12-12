const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();
const auth = require("../auth/authMiddleware");

// Filter all members' tasks for admin
router.post("/filter", async (req, res) => {
  try {
    console.log('Admin tasks filter request received:', req.body);
    const {
      date_filter,
      task_type,
      status,
      category,
      target_user_id, // specific member (mandatory)
      custom_date
    } = req.body;

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
      let q = supabase.from(table).select("*");

      // Always filter by the specified target user
      if (table === "self_tasks") {
        q = q.eq("user_id", target_user_id);
      } else {
        q = q.eq("assigned_to", target_user_id);
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
      // Fetch both self_tasks and master_tasks for all/specific users
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

    console.log('Admin filter response:', {
      target_user: target_user_id || 'all_users',
      self_tasks_count: response.self_tasks?.length || 0,
      master_tasks_count: response.master_tasks?.length || 0
    });

    res.json(response);

  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get all members for admin task filtering dropdown
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