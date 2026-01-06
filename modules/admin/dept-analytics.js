const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();
const auth = require("../auth/authMiddleware");

// Get all unique departments
router.get("/departments", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('dept')
      .not('dept', 'is', null);

    if (error) return res.status(400).json({ error: error.message });

    // Get unique departments
    const uniqueDepts = [...new Set(data.map(item => item.dept).filter(dept => dept))];

    res.json({ departments: uniqueDepts });

  } catch (err) {
    console.error('Get departments error:', err);
    res.status(500).json({ error: "Server error" });
  }
});

// Department analytics filter
router.post("/filter", async (req, res) => {
  try {
    const { dept, date_from, date_to } = req.body;
    console.log('Dept analytics request:', { dept, date_from, date_to });

    if (!date_from || !date_to) {
      return res.status(400).json({ error: "date_from and date_to are required" });
    }

    // If filtering by department, first get user IDs for that department
    let userIds = null;
    if (dept !== 'all') {
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('user_id')
        .ilike('dept', dept);

      if (usersError) {
        console.error('Error fetching users for department:', usersError);
        return res.status(400).json({ error: usersError.message });
      }

      userIds = usersData.map(user => user.user_id);
      console.log(`Found ${userIds.length} users for department ${dept}:`, userIds);
    }

    // Build queries for self_tasks and master_tasks with user data for breakdown
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

    if (dept !== 'all' && userIds) {
      selfQuery = selfQuery.in('user_id', userIds);
      masterQuery = masterQuery.in('assigned_to', userIds);
    }

    // Query task types from self_tasks
    let taskTypeQuery = supabase
      .from('self_tasks')
      .select('task_type')
      .gte('date', date_from)
      .lte('date', date_to);

    if (dept !== 'all' && userIds) {
      taskTypeQuery = taskTypeQuery.in('user_id', userIds);
    }

    // Execute queries
    const [selfRes, masterRes, taskTypeRes] = await Promise.all([selfQuery, masterQuery, taskTypeQuery]);

    if (selfRes.error || masterRes.error || taskTypeRes.error) {
      return res.status(400).json({
        error: selfRes.error?.message || masterRes.error?.message || taskTypeRes.error?.message
      });
    }

    const selfTasks = selfRes.data || [];
    const masterTasks = masterRes.data || [];
    const taskTypes = taskTypeRes.data || [];
    const allTasks = [...selfTasks, ...masterTasks];

    // Calculate counts
    const total_tasks = allTasks.length;
    const done = allTasks.filter(task => task.status === 'Done').length;
    const in_progress = allTasks.filter(task => task.status === 'In Progress').length;
    const not_started = allTasks.filter(task => task.status === 'Not Started').length;
    const cancelled = allTasks.filter(task => task.status === 'Cancelled').length;
    const on_hold = allTasks.filter(task => task.status === 'On Hold').length;
    const self_tasks = selfTasks.length;
    const assigned_tasks = masterTasks.length;

    // Calculate task type counts
    const fixed = taskTypes.filter(task => task.task_type === 'Fixed').length;
    const variable = taskTypes.filter(task => task.task_type === 'Variable').length;
    const hod_assigned = taskTypes.filter(task => task.task_type === 'HOD Assigned').length;

    console.log(`Dept ${dept}: total=${total_tasks}, done=${done}, in_progress=${in_progress}, not_started=${not_started}, cancelled=${cancelled}, on_hold=${on_hold}, fixed=${fixed}, variable=${variable}, hod_assigned=${hod_assigned}`);

    // Calculate breakdown
    let response = {
      total_tasks,
      done,
      in_progress,
      not_started,
      cancelled,
      on_hold,
      self_tasks,
      assigned_tasks,
      fixed,
      variable,
      hod_assigned
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

      // Also include member_breakdown for all users
      let member_breakdown = {};
      allTasks.forEach(task => {
        if (task.users && task.users.name) {
          const userName = task.users.name;
          member_breakdown[userName] = (member_breakdown[userName] || 0) + 1;
        }
      });
      response.member_breakdown = member_breakdown;
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
