const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();
const auth = require("../auth/authMiddleware");

// Get individual user analytics
router.post("/", auth, async (req, res) => {
  try {
    const { user_id, from_date, to_date } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    // Set default date range to current month if not provided
    let startDate = from_date;
    let endDate = to_date;

    if (!startDate || !endDate) {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    }

    // Get user's tasks within date range
    const [selfTasksRes, masterTasksRes] = await Promise.all([
      supabase
        .from("self_tasks")
        .select("*")
        .eq("user_id", user_id)
        .gte("date", startDate)
        .lte("date", endDate),
      supabase
        .from("master_tasks")
        .select("*")
        .eq("assigned_to", user_id)
        .gte("date", startDate)
        .lte("date", endDate)
    ]);

    if (selfTasksRes.error || masterTasksRes.error) {
      return res.status(400).json({
        error: selfTasksRes.error?.message || masterTasksRes.error?.message
      });
    }

    const selfTasks = selfTasksRes.data || [];
    const masterTasks = masterTasksRes.data || [];
    const allTasks = [...selfTasks, ...masterTasks];

    // Calculate analytics
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(task => task.status === 'Done').length;
    const inProgressTasks = allTasks.filter(task => task.status === 'In Progress').length;
    const pendingTasks = allTasks.filter(task => task.status === 'Not Started').length;

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Task type distribution
    const taskTypeStats = {};
    allTasks.forEach(task => {
      const type = task.task_type || task.type || 'Other';
      taskTypeStats[type] = (taskTypeStats[type] || 0) + 1;
    });

    // Status distribution over time (weekly breakdown)
    const weeklyStats = {};
    allTasks.forEach(task => {
      const weekStart = new Date(task.date);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weeklyStats[weekKey]) {
        weeklyStats[weekKey] = { total: 0, completed: 0, inProgress: 0, pending: 0 };
      }

      weeklyStats[weekKey].total++;
      if (task.status === 'Done') weeklyStats[weekKey].completed++;
      else if (task.status === 'In Progress') weeklyStats[weekKey].inProgress++;
      else if (task.status === 'Not Started') weeklyStats[weekKey].pending++;
    });

    // Get user info
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("name, email, dept, role")
      .eq("user_id", user_id)
      .single();

    if (userError) {
      return res.status(400).json({ error: userError.message });
    }

    res.json({
      user: userData,
      date_range: { from_date: startDate, to_date: endDate },
      summary: {
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        in_progress_tasks: inProgressTasks,
        pending_tasks: pendingTasks,
        completion_rate: completionRate
      },
      task_type_distribution: taskTypeStats,
      weekly_progress: weeklyStats,
      self_tasks: selfTasks,
      master_tasks: masterTasks,
      tasks: allTasks
    });

  } catch (error) {
    console.error('Individual analytics error:', error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;