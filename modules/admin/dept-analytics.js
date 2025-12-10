const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();

// Department analytics filter
router.post("/filter", async (req, res) => {
  try {
    const { dept, date_from, date_to } = req.body;

    if (!date_from || !date_to) {
      return res.status(400).json({ error: "date_from and date_to are required" });
    }

    // Build queries for self_tasks and master_tasks with department filter
    let selfQuery = supabase
      .from('self_tasks')
      .select('status, users!inner(dept)')
      .gte('date', date_from)
      .lte('date', date_to);

    let masterQuery = supabase
      .from('master_tasks')
      .select('status, users!inner(dept)')
      .gte('date', date_from)
      .lte('date', date_to);

    if (dept !== 'all') {
      selfQuery = selfQuery.eq('users.dept', dept);
      masterQuery = masterQuery.eq('users.dept', dept);
    }

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
    console.error('Department analytics error:', error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;