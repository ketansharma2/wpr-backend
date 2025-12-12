const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();
const auth = require("../auth/authMiddleware");

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
      .select('status, users!user_id(name, dept)')
      .gte('date', date_from)
      .lte('date', date_to);

    let masterQuery = supabase
      .from('master_tasks')
      .select('status, users!assigned_to(name, dept)')
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
    const done = allTasks.filter(task => task.status === 'Done').length;
    const in_progress = allTasks.filter(task => task.status === 'In Progress').length;
    const not_started = allTasks.filter(task => task.status === 'Not Started').length;
    const self_tasks = selfTasks.length;
    const assigned_tasks = masterTasks.length;

    // Calculate breakdown
    let response = {
      total_tasks,
      done,
      in_progress,
      not_started,
      self_tasks,
      assigned_tasks
    };

    if (dept === 'all') {
      let dept_breakdown = {};
      allTasks.forEach(task => {
        if (task.users && task.users.dept) {
          const deptName = task.users.dept;
          dept_breakdown[deptName] = (dept_breakdown[deptName] || 0) + 1;
        }
      });
      response.dept_breakdown = dept_breakdown;
    } else {
      let member_breakdown = {};
      allTasks.forEach(task => {
        if (task.users && task.users.name) {
          const userName = task.users.name;
          member_breakdown[userName] = (member_breakdown[userName] || 0) + 1;
        }
      });
      response.member_breakdown = member_breakdown;
    }

    res.json(response);

  } catch (error) {
    console.error('Department analytics error:', error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
