const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();
const auth = require("../auth/authMiddleware");

// Sub-admin analytics filter
router.post("/filter", auth, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { date_from, date_to } = req.body;
    console.log('Sub-admin analytics request:', { user_id, date_from, date_to });

    if (!date_from || !date_to) {
      return res.status(400).json({ error: "date_from and date_to are required" });
    }

    // Get team member IDs for SubAdmin
    const { data: teamData } = await supabase
      .from('users')
      .select('user_id')
      .neq('user_type', 'Admin')
      .neq('user_id', user_id);

    const teamUserIds = teamData?.map(u => u.user_id) || [];
    console.log(`Found ${teamUserIds.length} team members for sub-admin ${user_id}`);

    // Build queries for self_tasks and master_tasks with user data for breakdown
    let selfQuery = supabase
      .from('self_tasks')
      .select('status, task_type, users!user_id(name)')
      .gte('date', date_from)
      .lte('date', date_to)
      .in('user_id', teamUserIds);

    let masterQuery = supabase
      .from('master_tasks')
      .select('status, users!assigned_to(name)')
      .gte('date', date_from)
      .lte('date', date_to)
      .eq('assigned_by', user_id); // Tasks assigned by sub-admin

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
    const cancelled = allTasks.filter(task => task.status === 'Cancelled').length;
    const on_hold = allTasks.filter(task => task.status === 'On Hold').length;
    const self_tasks = selfTasks.length;
    const assigned_tasks = masterTasks.length;

    // Calculate task type counts from self_tasks
    const fixed = selfTasks.filter(task => task.task_type === 'Fixed').length;
    const variable = selfTasks.filter(task => task.task_type === 'Variable').length;
    const hod_assigned = selfTasks.filter(task => task.task_type === 'HOD Assigned').length;

    console.log(`Sub-admin analytics: total=${total_tasks}, done=${done}, in_progress=${in_progress}, not_started=${not_started}, cancelled=${cancelled}, on_hold=${on_hold}, fixed=${fixed}, variable=${variable}, hod_assigned=${hod_assigned}`);

    // Calculate member breakdown
    let member_breakdown = {};
    allTasks.forEach(task => {
      if (task.users && task.users.name) {
        const userName = task.users.name;
        member_breakdown[userName] = (member_breakdown[userName] || 0) + 1;
      }
    });

    const response = {
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
      hod_assigned,
      member_breakdown
    };

    res.json(response);

  } catch (error) {
    console.error('Sub-admin analytics error:', error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;