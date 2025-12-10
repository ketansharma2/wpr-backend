const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();

// Get all members for analytics dropdown
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

// User analytics filter
router.post("/filter", async (req, res) => {
  try {
    const { user_id, date_from, date_to } = req.body;

    if (!user_id || !date_from || !date_to) {
      return res.status(400).json({ error: "user_id, date_from, and date_to are required" });
    }

    // Query self_tasks for the user
    const selfQuery = supabase
      .from('self_tasks')
      .select('status')
      .eq('user_id', user_id)
      .gte('date', date_from)
      .lte('date', date_to);

    // Query master_tasks assigned to the user
    const masterQuery = supabase
      .from('master_tasks')
      .select('status')
      .eq('assigned_to', user_id)
      .gte('date', date_from)
      .lte('date', date_to);

    // Execute queries
    const [selfRes, masterRes] = await Promise.all([selfQuery, masterQuery]);

    if (selfRes.error || masterRes.error) {
      return res.status(400).json({
        error: selfRes.error?.message || masterRes.error?.message
      });
    }

    const selfTasks = selfRes.data || [];
    const masterTasks = masterRes.data || [];
    const allTasks = [...selfTasks, ...masterTasks];

    // Calculate counts
    const total_tasks = allTasks.length;
    const done = allTasks.filter(task => task.status === 'done').length;
    const in_progress = allTasks.filter(task => task.status === 'in progress').length;
    const not_started = allTasks.filter(task => task.status === 'not started').length;
    const self_tasks = selfTasks.length;
    const assigned_tasks = masterTasks.length;

    res.json({
      total_tasks,
      done,
      in_progress,
      not_started,
      self_tasks,
      assigned_tasks
    });

  } catch (error) {
    console.error('User analytics error:', error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;