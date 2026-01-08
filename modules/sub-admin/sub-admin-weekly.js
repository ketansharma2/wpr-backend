const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();
const auth = require("../auth/authMiddleware");

// Filter weekly tasks for SubAdmin
router.post("/filter", auth, async (req, res) => {
  try {
    console.log('SubAdmin weekly filter request received:', req.body);
    const user_id = req.user.id;
    let {
      from_date,
      to_date,
      task_type = 'all',
      status = 'all',
      category = 'all',
      view_type, // 'self', 'team', 'all'
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

    // Get user IDs for SubAdmin
    let allUserIds = [];
    if (view_type === 'team' || view_type === 'all') {
      const { data: userData } = await supabase
        .from('users')
        .select('user_id')
        .neq('user_type', 'Admin');

      allUserIds = userData?.map(u => u.user_id) || [];
    }

    // ---------------------- FILTER BUILDER ----------------------
    const applyFilters = (table) => {
      let q;

      if (table === "self_tasks") {
        q = supabase.from(table).select(`
          *,
          users(name)
        `);

        if (view_type === 'self') {
          q = q.eq("user_id", user_id);
        } else if (view_type === 'team' && target_user_id && target_user_id !== 'all') {
          q = q.eq("user_id", target_user_id);
        } else if (view_type === 'all' || (view_type === 'team' && target_user_id === 'all')) {
          q = q.in("user_id", allUserIds);
        }
      } else {
        // master_tasks
        q = supabase.from(table).select(`
          *,
          assigned_to_user:users!assigned_to(name),
          assigned_by_user:users!assigned_by(name)
        `);

        if (view_type === 'self') {
          q = q.eq("assigned_to", user_id);
        } else if (view_type === 'team' && target_user_id && target_user_id !== 'all') {
          q = q.eq("assigned_to", target_user_id);
        } else if (view_type === 'all' || (view_type === 'team' && target_user_id === 'all')) {
          // For SubAdmin, master tasks are those assigned by SubAdmin to team members
          q = q.eq("assigned_by", user_id).in("assigned_to", allUserIds);
        }
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
        self_tasks: selfRes.data || [],
        master_tasks: masterRes.data || []
      };
    } else if (category === "self") {
      // Fetch only self_tasks
      const { data, error } = await applyFilters("self_tasks");
      if (error) return res.status(400).json({ error: error.message });

      response = { self_tasks: data || [], master_tasks: [] };
    } else if (category === "assigned") {
      // Fetch only master_tasks
      const { data, error } = await applyFilters("master_tasks");
      if (error) return res.status(400).json({ error: error.message });

      response = { self_tasks: [], master_tasks: data || [] };
    } else {
      return res.status(400).json({ error: "Invalid category. Must be 'all', 'self', or 'assigned'" });
    }

    console.log('SubAdmin weekly filter response:', {
      view_type,
      target_user: target_user_id || 'all',
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
    console.error('SubAdmin weekly filter error:', error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;