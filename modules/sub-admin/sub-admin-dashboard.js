const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();

// Get dashboard data for SubAdmin (can view self or team member data)
router.post("/data", async (req, res) => {
  try {
    const { user_id, view_type, target_user_id, date_filter = 'today', from_date, to_date } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    // For SubAdmin, get all non-admin users except self
    const { data: teamMembers, error: teamError } = await supabase
      .from("users")
      .select("user_id")
      .neq("user_type", "Admin")
      .neq("user_id", user_id);

    if (teamError) {
      console.error("Team members error:", teamError);
      return res.status(400).json({ error: teamError.message });
    }

    // Determine whose data to fetch
    let targetUserIds = [];
    if (view_type === 'all') {
      targetUserIds = teamMembers.map(member => member.user_id);
    } else {
      targetUserIds = [view_type === 'team' && target_user_id ? target_user_id : user_id];
    }

    console.log(`Fetching SubAdmin dashboard data for ${view_type} view, target users: ${targetUserIds.join(', ')}, date_filter: ${date_filter}`);

    const formatDate = (d) => d.toISOString().split("T")[0];
    const now = new Date();

    // Calculate date range based on date_filter or custom dates
    let startDate, endDate, todayStr;

    if (from_date && to_date) {
      // Use custom date range
      startDate = from_date;
      endDate = to_date;
      todayStr = formatDate(now);
    } else if (date_filter === 'today') {
      todayStr = formatDate(now);
      startDate = todayStr;
      endDate = todayStr;
    } else if (date_filter === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      todayStr = formatDate(yesterday);
      startDate = todayStr;
      endDate = todayStr;
    } else if (date_filter === 'past_week') {
      // Current week's Monday to Saturday
      let d = new Date();
      let weekday = d.getDay();
      let monday = new Date(d);
      monday.setDate(d.getDate() - ((weekday + 6) % 7));

      let saturday = new Date(monday);
      saturday.setDate(monday.getDate() + 5);

      startDate = formatDate(monday);
      endDate = formatDate(saturday);
      todayStr = formatDate(now);
    } else {
      // Default to current month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      startDate = formatDate(startOfMonth);
      endDate = formatDate(endOfMonth);
      todayStr = formatDate(now);
    }

    // Parallel queries for efficiency
    const [
      monthlySelfTasksResult,
      monthlyMasterTasksResult,
      monthlyAssignedStatsResult,
      todayTasksResult,
      todayMeetingsResult,
      pendingTasksResult
    ] = await Promise.all([
      // Monthly statistics for self tasks
      supabase
        .from("self_tasks")
        .select("status, task_type, user_id")
        .in("user_id", targetUserIds)
        .gte("date", startDate)
        .lte("date", endDate),

      // Monthly statistics for master tasks assigned to team members
      supabase
        .from("master_tasks")
        .select("status, assigned_to")
        .in("assigned_to", targetUserIds)
        .gte("date", startDate)
        .lte("date", endDate),

      // Monthly statistics for assigned tasks
      (() => {
        let query = supabase
          .from("master_tasks")
          .select("status")
          .gte("date", startDate)
          .lte("date", endDate);

        if (view_type === 'self') {
          // My Dashboard: tasks assigned TO the subadmin
          query = query.eq("assigned_to", user_id);
        } else if (view_type === 'all') {
          // All Team Members: tasks assigned BY the subadmin
          query = query.eq("assigned_by", user_id);
        } else if (view_type === 'team' && target_user_id) {
          // Specific member: tasks assigned TO that member
          query = query.eq("assigned_to", target_user_id);
        }

        return query;
      })(),

      // Today's tasks
      supabase
        .from("self_tasks")
        .select("*, users(name)")
        .in("user_id", targetUserIds)
        .gte("date", startDate)
        .lte("date", endDate),

      // Today's meetings
      supabase
        .from("meetings")
        .select("*, users(name)")
        .in("user_id", targetUserIds)
        .gte("date", startDate)
        .lte("date", endDate),

      // Pending tasks
      supabase
        .from("master_tasks")
        .select("*, users!assigned_to(name)")
        .eq("assigned_by", user_id)
        .neq("status", "Done")
    ]);

    // Check for errors
    if (monthlySelfTasksResult.error) {
      console.error("Monthly self tasks error:", monthlySelfTasksResult.error);
      return res.status(400).json({ error: monthlySelfTasksResult.error.message });
    }

    if (monthlyMasterTasksResult.error) {
      console.error("Monthly master tasks error:", monthlyMasterTasksResult.error);
      return res.status(400).json({ error: monthlyMasterTasksResult.error.message });
    }

    if (monthlyAssignedStatsResult.error) {
      console.error("Monthly assigned stats error:", monthlyAssignedStatsResult.error);
      return res.status(400).json({ error: monthlyAssignedStatsResult.error.message });
    }

    if (todayTasksResult.error) {
      console.error("Today tasks error:", todayTasksResult.error);
      return res.status(400).json({ error: todayTasksResult.error.message });
    }

    if (todayMeetingsResult.error) {
      console.error("Today meetings error:", todayMeetingsResult.error);
      return res.status(400).json({ error: todayMeetingsResult.error.message });
    }

    if (pendingTasksResult.error) {
      console.error("Pending tasks error:", pendingTasksResult.error);
      return res.status(400).json({ error: pendingTasksResult.error.message });
    }

    // Process monthly statistics
    const monthlySelfTasks = monthlySelfTasksResult.data || [];
    const monthlyMasterTasks = monthlyMasterTasksResult.data || [];
    const monthlyAssignedTasks = monthlyAssignedStatsResult.data || [];
    const stats = {
      total_tasks: monthlySelfTasks.length,
      completed: 0,
      in_progress: 0,
      not_started: 0,
      on_hold: 0,
      cancelled: 0,
      assigned_tasks: monthlyAssignedTasks.length,
      fixed_tasks: 0,
      variable_tasks: 0,
      hod_assigned_tasks: 0,
      member_breakdown: {}
    };

    // Initialize member breakdown for all target users
    targetUserIds.forEach(userId => {
      stats.member_breakdown[userId] = 0;
    });

    // Process self tasks for status and task type counts
    monthlySelfTasks.forEach(task => {
      const status = task.status?.toLowerCase();
      if (status === 'done') {
        stats.completed++;
      } else if (status === 'in progress') {
        stats.in_progress++;
      } else if (status === 'not started') {
        stats.not_started++;
      } else if (status === 'on hold') {
        stats.on_hold++;
      } else if (status === 'cancelled') {
        stats.cancelled++;
      }

      // Count task types
      const taskType = task.task_type?.toLowerCase();
      if (taskType === 'fixed') {
        stats.fixed_tasks++;
      } else if (taskType === 'variable') {
        stats.variable_tasks++;
      } else if (taskType === 'hod assigned') {
        stats.hod_assigned_tasks++;
      }

      // Count per member for self tasks
      if (task.user_id && stats.member_breakdown.hasOwnProperty(task.user_id)) {
        stats.member_breakdown[task.user_id]++;
      }
    });

    // Process master tasks for status counts and member breakdown (assigned tasks)
    monthlyMasterTasks.forEach(task => {
      // Include master task statuses in status counts
      const status = task.status?.toLowerCase();
      if (status === 'done') {
        stats.completed++;
      } else if (status === 'in progress') {
        stats.in_progress++;
      } else if (status === 'not started') {
        stats.not_started++;
      } else if (status === 'on hold') {
        stats.on_hold++;
      } else if (status === 'cancelled') {
        stats.cancelled++;
      }

      // Count per member for assigned tasks
      if (task.assigned_to && stats.member_breakdown.hasOwnProperty(task.assigned_to)) {
        stats.member_breakdown[task.assigned_to]++;
      }
    });

    // Process today's data
    const todayTasks = (todayTasksResult.data || []).map(task => ({
      ...task,
      itemType: 'task',
      category: 'self',
      owner_name: task.users?.name || 'Unknown'
    }));

    const todayMeetings = (todayMeetingsResult.data || []).map(meeting => ({
      ...meeting,
      itemType: 'meeting',
      owner_name: meeting.users?.name || 'Unknown'
    }));

    const pendingTasks = (pendingTasksResult.data || []).map(task => ({
      ...task,
      itemType: 'task',
      category: 'assigned',
      owner_name: task.users?.name || 'Unknown'
    }));

    const response = {
      monthly_stats: {
        ...stats,
        self_tasks: stats.total_tasks,
        assigned_tasks: stats.assigned_tasks
      },
      today: {
        tasks: todayTasks,
        meetings: todayMeetings,
        date: todayStr
      },
      pending_tasks: pendingTasks
    };

    console.log(`SubAdmin dashboard data for users ${targetUserIds.join(', ')}:`, {
      monthly_tasks: stats.total_tasks,
      assigned_tasks: stats.assigned_tasks,
      today_tasks: todayTasks.length,
      today_meetings: todayMeetings.length,
      pending_tasks: pendingTasks.length
    });

    res.json(response);

  } catch (error) {
    console.error("SubAdmin dashboard data error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;