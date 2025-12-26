const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();
const auth = require("../auth/authMiddleware");

// Filter weekly tasks for admin
router.post("/filter", auth, async (req, res) => {
  try {
    console.log('Admin weekly filter request received:', req.body);
    let {
      from_date,
      to_date,
      task_type = 'all', // default to 'all' if not provided
      status = 'all', // default to 'all' if not provided
      category = 'all', // default to 'all' if not provided
      target_user_id // specific member (optional - use 'all' for all members)
    } = req.body;

    // If dates not provided, default to current week (Monday to Saturday)
    if (!from_date || !to_date) {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

      // Calculate Monday of current week
      const monday = new Date(today);
      monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

      // Calculate Saturday of current week
      const saturday = new Date(monday);
      saturday.setDate(monday.getDate() + 5);

      from_date = monday.toISOString().split('T')[0];
      to_date = saturday.toISOString().split('T')[0];
    }

    // ---------------------- FILTER BUILDER ----------------------
    const applyFilters = (table) => {
      let q;

      if (table === "self_tasks") {
        q = supabase.from(table).select(`
          *,
          users(name)
        `);
        // Filter by target user only if specified (not 'all' or null)
        if (target_user_id && target_user_id !== 'all') {
          q = q.eq("user_id", target_user_id);
        }
        // If target_user_id is 'all' or null, don't filter by user (fetch all users' tasks)
      } else {
        q = supabase.from(table).select(`
          *,
          assigned_to_user:users!assigned_to(name),
          assigned_by_user:users!assigned_by(name)
        `);
        // Filter by target user only if specified (not 'all' or null)
        if (target_user_id && target_user_id !== 'all') {
          q = q.eq("assigned_to", target_user_id);
        }
        // If target_user_id is 'all' or null, don't filter by user (fetch all users' tasks)
      }

      // Date range filter
      q = q.gte("date", from_date).lte("date", to_date);

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

    console.log('Admin weekly filter response:', {
      target_user: target_user_id || 'all_users',
      date_range: `${from_date} to ${to_date}`,
      self_tasks_count: response.self_tasks?.length || 0,
      master_tasks_count: response.master_tasks?.length || 0
    });

    res.json({
      ...response,
      date_range: {
        from_date,
        to_date
      }
    });

  } catch (error) {
    console.error('Admin weekly filter error:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all members for admin weekly filtering dropdown
router.get("/members", auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const { data, error } = await supabase
      .from("users")
      .select("user_id, name, email, dept, role")
      .neq("user_id", currentUserId) // Exclude current admin user
      .order("name");

    if (error) return res.status(400).json({ error: error.message });

    res.json({ members: data });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;