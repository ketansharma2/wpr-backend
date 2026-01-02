const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();

// Get dashboard data for HOD (can view self or team member data)
router.post("/data", async (req, res) => {
  try {
    const { user_id, view_type, target_user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    // Determine whose data to fetch
    let targetUserIds = [];
    if (view_type === 'all') {
      // Get all team members in the department
      const { data: hodData, error: hodError } = await supabase
        .from("users")
        .select("dept")
        .eq("user_id", user_id)
        .single();

      if (hodError) {
        console.error("HOD data error:", hodError);
        return res.status(400).json({ error: hodError.message });
      }

      const { data: teamMembers, error: teamError } = await supabase
        .from("users")
        .select("user_id")
        .eq("dept", hodData.dept);

      if (teamError) {
        console.error("Team members error:", teamError);
        return res.status(400).json({ error: teamError.message });
      }

      targetUserIds = teamMembers.map(member => member.user_id);
    } else {
      targetUserIds = [view_type === 'team' && target_user_id ? target_user_id : user_id];
    }

    console.log(`Fetching HOD dashboard data for ${view_type} view, target users: ${targetUserIds.join(', ')}`);

    // Get current month date range
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const formatDate = (d) => d.toISOString().split("T")[0];
    const startDate = formatDate(startOfMonth);
    const endDate = formatDate(endOfMonth);

    // Get today's date
    const todayStr = formatDate(now);

    // Parallel queries for efficiency
    const [
      monthlyStatsResult,
      todayTasksResult,
      todayMeetingsResult,
      pendingTasksResult
    ] = await Promise.all([
      // Monthly statistics
      view_type === 'all' ?
        supabase
          .from("self_tasks")
          .select("status, user_id")
          .in("user_id", targetUserIds)
          .gte("date", startDate)
          .lte("date", endDate)
        :
        supabase
          .from("self_tasks")
          .select("status")
          .eq("user_id", targetUserIds[0])
          .gte("date", startDate)
          .lte("date", endDate),

      // Today's tasks
      supabase
        .from("self_tasks")
        .select("*, users(name)")
        .in("user_id", targetUserIds)
        .eq("date", todayStr),

      // Today's meetings
      supabase
        .from("meetings")
        .select("*, users(name)")
        .in("user_id", targetUserIds)
        .eq("date", todayStr),

      // Pending assigned tasks (for HOD's own view)
      view_type === 'self' ?
        supabase
          .from("master_tasks")
          .select("*, assigned_by_user:users!assigned_by(name)")
          .eq("assigned_to", user_id)
          .neq("status", "completed")
          .neq("status", "Not Started")
          .neq("status", "In Progress")
        : Promise.resolve({ data: [], error: null })
    ]);

    // Check for errors
    if (monthlyStatsResult.error) {
      console.error("Monthly stats error:", monthlyStatsResult.error);
      return res.status(400).json({ error: monthlyStatsResult.error.message });
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
    const monthlyTasks = monthlyStatsResult.data || [];
    const stats = {
      total_tasks: monthlyTasks.length,
      completed: 0,
      in_progress: 0,
      not_started: 0,
      on_hold: 0,
      cancelled: 0,
      self_tasks: 0,
      assigned_tasks: 0,
      fixed_tasks: 0,
      variable_tasks: 0,
      hod_assigned_tasks: 0
    };

    monthlyTasks.forEach(task => {
      const status = task.status?.toLowerCase();
      if (status === 'completed') {
        stats.completed++;
      } else if (status === 'in-progress') {
        stats.in_progress++;
      } else if (status === 'pending' || status === 'not started') {
        stats.not_started++;
      } else if (status === 'on hold') {
        stats.on_hold++;
      } else if (status === 'cancelled') {
        stats.cancelled++;
      }

      // Count self vs assigned tasks
      // Note: This assumes self_tasks table contains only self tasks
      stats.self_tasks++;

      // Count task types
      const taskType = task.task_type?.toLowerCase();
      if (taskType === 'fixed') {
        stats.fixed_tasks++;
      } else if (taskType === 'variable') {
        stats.variable_tasks++;
      } else if (taskType === 'hod assigned') {
        stats.hod_assigned_tasks++;
      }
    });

    // Get assigned tasks count from master_tasks table
    if (view_type === 'self') {
      const { data: assignedTasks, error: assignedError } = await supabase
        .from("master_tasks")
        .select("status")
        .eq("assigned_to", user_id)
        .gte("date", startDate)
        .lte("date", endDate);

      if (!assignedError && assignedTasks) {
        stats.assigned_tasks = assignedTasks.length;
        // Add assigned tasks to status counts
        assignedTasks.forEach(task => {
          const status = task.status?.toLowerCase();
          if (status === 'completed') {
            stats.completed++;
          } else if (status === 'in-progress') {
            stats.in_progress++;
          } else if (status === 'pending' || status === 'not started') {
            stats.not_started++;
          } else if (status === 'on hold') {
            stats.on_hold++;
          } else if (status === 'cancelled') {
            stats.cancelled++;
          }
        });
      }
    } else if (view_type === 'all') {
      // For 'all' view, count all assigned tasks in the department
      const { data: allAssignedTasks, error: allAssignedError } = await supabase
        .from("master_tasks")
        .select("status")
        .in("assigned_to", targetUserIds)
        .gte("date", startDate)
        .lte("date", endDate);

      if (!allAssignedError && allAssignedTasks) {
        stats.assigned_tasks = allAssignedTasks.length;
        // Add assigned tasks to status counts
        allAssignedTasks.forEach(task => {
          const status = task.status?.toLowerCase();
          if (status === 'completed') {
            stats.completed++;
          } else if (status === 'in-progress') {
            stats.in_progress++;
          } else if (status === 'pending' || status === 'not started') {
            stats.not_started++;
          } else if (status === 'on hold') {
            stats.on_hold++;
          } else if (status === 'cancelled') {
            stats.cancelled++;
          }
        });
      }
    }

    // Process today's data
    const todayTasks = ((todayTasksResult.data || []).map(task => ({
      ...task,
      itemType: 'task',
      category: 'self',
      owner_name: task.users?.name || 'Unknown'
    }))).sort((a, b) => {
      // For 'all' view, sort by owner name first, then by date
      if (view_type === 'all') {
        const nameCompare = (a.owner_name || '').localeCompare(b.owner_name || '');
        if (nameCompare !== 0) return nameCompare;
      }
      // Sort by date descending (newest first)
      return new Date(b.date) - new Date(a.date);
    });

    const todayMeetings = ((todayMeetingsResult.data || []).map(meeting => ({
      ...meeting,
      itemType: 'meeting',
      owner_name: meeting.users?.name || 'Unknown'
    }))).sort((a, b) => {
      // For 'all' view, sort by owner name first, then by date
      if (view_type === 'all') {
        const nameCompare = (a.owner_name || '').localeCompare(b.owner_name || '');
        if (nameCompare !== 0) return nameCompare;
      }
      // Sort by date descending (newest first)
      return new Date(b.date) - new Date(a.date);
    });

    // Process pending tasks (for HOD's own dashboard)
    const pendingTasks = (pendingTasksResult.data || []).map(task => ({
      ...task,
      itemType: 'task',
      category: 'assigned'
    }));

    const response = {
      monthly_stats: stats,
      today: {
        tasks: todayTasks,
        meetings: todayMeetings,
        date: todayStr
      },
      pending_tasks: pendingTasks,
      view_type: view_type,
      target_user_ids: targetUserIds
    };

    console.log(`HOD dashboard data for users ${targetUserIds.join(', ')}:`, {
      monthly_tasks: stats.total_tasks,
      today_tasks: todayTasks.length,
      today_meetings: todayMeetings.length,
      pending_tasks: pendingTasks.length
    });

    res.json(response);

  } catch (error) {
    console.error("HOD dashboard data error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get yesterday's data for HOD dashboard (smart last working day)
router.post("/yesterday-data", async (req, res) => {
  try {
    const { user_id, view_type, target_user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    // Determine whose data to fetch
    let targetUserIds = [];
    if (view_type === 'all') {
      // Get all team members in the department
      const { data: hodData, error: hodError } = await supabase
        .from("users")
        .select("dept")
        .eq("user_id", user_id)
        .single();

      if (hodError) {
        console.error("HOD data error:", hodError);
        return res.status(400).json({ error: hodError.message });
      }

      const { data: teamMembers, error: teamError } = await supabase
        .from("users")
        .select("user_id")
        .eq("dept", hodData.dept);

      if (teamError) {
        console.error("Team members error:", teamError);
        return res.status(400).json({ error: teamError.message });
      }

      targetUserIds = teamMembers.map(member => member.user_id);
    } else {
      targetUserIds = [view_type === 'team' && target_user_id ? target_user_id : user_id];
    }

    console.log(`Fetching yesterday's data for HOD dashboard, target users: ${targetUserIds.join(', ')}`);

    // Find last working day with tasks
    let checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - 1);

    // Check up to 30 days back
    for (let i = 0; i < 30; i++) {
      const dateStr = checkDate.toISOString().split("T")[0];

      // Query tasks for this date
      const tasksQuery = supabase
        .from("self_tasks")
        .select("*, users(name)")
        .in("user_id", targetUserIds)
        .eq("date", dateStr);

      const { data: tasks, error: tasksError } = await tasksQuery;

      if (tasksError) {
        console.error("Tasks error:", tasksError);
        return res.status(400).json({ error: tasksError.message });
      }

      // If we found tasks, get meetings for same date
      if (tasks && tasks.length > 0) {
        const meetingsQuery = supabase
          .from("meetings")
          .select("*, users(name)")
          .in("user_id", targetUserIds)
          .eq("date", dateStr);

        const { data: meetings, error: meetingsError } = await meetingsQuery;

        if (meetingsError) {
          console.error("Meetings error:", meetingsError);
          return res.status(400).json({ error: meetingsError.message });
        }

        const yesterdayTasks = tasks.map(task => ({
          ...task,
          itemType: 'task',
          category: 'self',
          owner_name: task.users?.name || 'Unknown'
        })).sort((a, b) => {
          // For 'all' view, sort by owner name first, then by date
          if (view_type === 'all') {
            const nameCompare = (a.owner_name || '').localeCompare(b.owner_name || '');
            if (nameCompare !== 0) return nameCompare;
          }
          // Sort by date descending (newest first)
          return new Date(b.date) - new Date(a.date);
        });

        const yesterdayMeetings = (meetings || []).map(meeting => ({
          ...meeting,
          itemType: 'meeting',
          owner_name: meeting.users?.name || 'Unknown'
        })).sort((a, b) => {
          // For 'all' view, sort by owner name first, then by date
          if (view_type === 'all') {
            const nameCompare = (a.owner_name || '').localeCompare(b.owner_name || '');
            if (nameCompare !== 0) return nameCompare;
          }
          // Sort by date descending (newest first)
          return new Date(b.date) - new Date(a.date);
        });

        console.log(`Found last working day: ${dateStr} (${i + 1} days back) with ${yesterdayTasks.length} tasks and ${yesterdayMeetings.length} meetings`);

        return res.json({
          found: true,
          date: dateStr,
          days_back: i + 1,
          tasks: yesterdayTasks,
          meetings: yesterdayMeetings
        });
      }

      // Move back one day
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // No working days found
    console.log(`No working days found in last 30 days for users ${targetUserIds.join(', ')}`);

    res.json({
      found: false,
      date: null,
      tasks: [],
      meetings: [],
      message: "No tasks found in last 30 days"
    });

  } catch (error) {
    console.error("HOD yesterday data error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get team overview for HOD dashboard
router.post("/team-overview", async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    // Get HOD's department
    const { data: hodData, error: hodError } = await supabase
      .from("users")
      .select("dept")
      .eq("user_id", user_id)
      .single();

    if (hodError) {
      console.error("HOD data error:", hodError);
      return res.status(400).json({ error: hodError.message });
    }

    const department = hodData.dept;

    // Get all team members in the department (excluding HOD)
    const { data: teamMembers, error: teamError } = await supabase
      .from("users")
      .select("user_id, name, email")
      .eq("dept", department)
      .neq("user_id", user_id);

    if (teamError) {
      console.error("Team members error:", teamError);
      return res.status(400).json({ error: teamError.message });
    }

    // Get current month stats for each team member
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const formatDate = (d) => d.toISOString().split("T")[0];
    const startDate = formatDate(startOfMonth);
    const endDate = formatDate(endOfMonth);

    const teamStats = await Promise.all(
      (teamMembers || []).map(async (member) => {
        const { data: tasks, error } = await supabase
          .from("self_tasks")
          .select("status")
          .eq("user_id", member.user_id)
          .gte("date", startDate)
          .lte("date", endDate);

        if (error) {
          console.error(`Error fetching stats for ${member.name}:`, error);
          return {
            ...member,
            stats: { total_tasks: 0, completed: 0, in_progress: 0, not_started: 0 }
          };
        }

        const stats = {
          total_tasks: tasks.length,
          completed: 0,
          in_progress: 0,
          not_started: 0
        };

        tasks.forEach(task => {
          const status = task.status?.toLowerCase();
          if (status === 'completed') stats.completed++;
          else if (status === 'in-progress') stats.in_progress++;
          else if (status === 'pending' || status === 'not started') stats.not_started++;
        });

        return {
          ...member,
          stats
        };
      })
    );

    console.log(`Team overview for HOD ${user_id}: ${teamStats.length} team members`);

    res.json({
      department,
      team_members: teamStats
    });

  } catch (error) {
    console.error("HOD team overview error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;