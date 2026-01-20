const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();

// Get dashboard data for HOD (can view self or team member data)
router.post("/data", async (req, res) => {
  try {
    const { user_id, view_type, target_user_id, date_filter = 'all' } = req.body;

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

    console.log(`Fetching HOD dashboard data for ${view_type} view, target users: ${targetUserIds.join(', ')}, date_filter: ${date_filter}`);

    const formatDate = (d) => d.toISOString().split("T")[0];
    const now = new Date();

    // Calculate date range based on date_filter
    let startDate, endDate, todayStr;

    if (date_filter === 'today') {
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
      // Last week's Monday to Saturday
      const dayOfWeek = now.getDay();
      const daysToLastSaturday = (dayOfWeek + 1) % 7;
      const lastSaturday = new Date(now);
      lastSaturday.setDate(now.getDate() - daysToLastSaturday);
      const lastMonday = new Date(lastSaturday);
      lastMonday.setDate(lastSaturday.getDate() - 5);
      startDate = formatDate(lastMonday);
      endDate = formatDate(lastSaturday);
      todayStr = formatDate(now);
    } else if (date_filter === 'past_month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      startDate = formatDate(monthAgo);
      endDate = formatDate(now);
      todayStr = formatDate(now);
    } else {
      // 'all' or default - use current month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      startDate = formatDate(startOfMonth);
      endDate = formatDate(endOfMonth);
      todayStr = formatDate(now);
    }

    // Build queries
    const monthlyStatsQuery = view_type === 'all' ?
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
        .lte("date", endDate);

    const todayTasksQuery = supabase
      .from("self_tasks")
      .select("*, users(name)")
      .in("user_id", targetUserIds)
      .gte("date", startDate)
      .lte("date", endDate);

    const todayMasterTasksQuery = supabase
      .from("master_tasks")
      .select("*, users!assigned_to(name)")
      .in("assigned_to", targetUserIds)
      .gte("date", startDate)
      .lte("date", endDate);

    let todayHistoryTasksQuery = null;
    if (date_filter !== 'today' && date_filter !== 'all') {
      todayHistoryTasksQuery = supabase
        .from("task_history")
        .select("*, users!task_history_user_id_fkey(name), self_tasks!task_id(task_type, users!user_id(name))")
        .in("user_id", targetUserIds)
        .gte("history_date", startDate)
        .lte("history_date", endDate);
    }

    const todayMeetingsQuery = supabase
      .from("meetings")
      .select("*, users(name)")
      .in("user_id", targetUserIds)
      .gte("date", startDate)
      .lte("date", endDate);

    // Parallel queries for efficiency
    const queries = [
      monthlyStatsQuery,
      todayTasksQuery,
      todayMasterTasksQuery,
      todayMeetingsQuery
    ];

    if (todayHistoryTasksQuery) {
      queries.splice(1, 0, todayHistoryTasksQuery); // Insert history query after monthly stats
    }

    const results = await Promise.all(queries);
    const monthlyStatsResult = results[0];
    const todayTasksResult = results[todayHistoryTasksQuery ? 2 : 1];
    const todayMasterResult = results[todayHistoryTasksQuery ? 3 : 2];
    const todayHistoryResult = todayHistoryTasksQuery ? results[1] : null;
    const todayMeetingsResult = results[results.length - 1];

    // Check for errors
    if (monthlyStatsResult.error) {
      console.error("Monthly stats error:", monthlyStatsResult.error);
      return res.status(400).json({ error: monthlyStatsResult.error.message });
    }

    if (todayTasksResult.error) {
      console.error("Today tasks error:", todayTasksResult.error);
      return res.status(400).json({ error: todayTasksResult.error.message });
    }

    if (todayMasterResult.error) {
      console.error("Today master tasks error:", todayMasterResult.error);
      return res.status(400).json({ error: todayMasterResult.error.message });
    }

    if (todayHistoryResult && todayHistoryResult.error) {
      console.error("Today history tasks error:", todayHistoryResult.error);
      return res.status(400).json({ error: todayHistoryResult.error.message });
    }

    if (todayMeetingsResult.error) {
      console.error("Today meetings error:", todayMeetingsResult.error);
      return res.status(400).json({ error: todayMeetingsResult.error.message });
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

      stats.self_tasks++;

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
    let allAssignedTasks = [];
    if (view_type === 'self') {
      const { data: assignedTasks, error: assignedError } = await supabase
        .from("master_tasks")
        .select("status")
        .eq("assigned_to", user_id)
        .gte("date", startDate)
        .lte("date", endDate);

      if (!assignedError && assignedTasks) {
        allAssignedTasks = assignedTasks;
        stats.assigned_tasks = assignedTasks.length;
        assignedTasks.forEach(task => {
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
        });
      }
    } else if (view_type === 'all') {
      const { data: assignedTasksData, error: allAssignedError } = await supabase
        .from("master_tasks")
        .select("status")
        .in("assigned_to", targetUserIds)
        .gte("date", startDate)
        .lte("date", endDate);

      if (!allAssignedError && assignedTasksData) {
        allAssignedTasks = assignedTasksData;
        stats.assigned_tasks = assignedTasksData.length;
        assignedTasksData.forEach(task => {
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
        });
      }
    }

    // Update stats for history on past dates
    if (todayHistoryResult && todayHistoryResult.data) {
      todayHistoryResult.data.forEach(item => {
        // For status
        const status = item.status?.toLowerCase();
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

        // For task_type
        const taskType = item.self_tasks?.task_type?.toLowerCase();
        if (taskType === 'fixed') {
          stats.fixed_tasks++;
        } else if (taskType === 'variable') {
          stats.variable_tasks++;
        } else if (taskType === 'hod assigned') {
          stats.hod_assigned_tasks++;
        }
      });

      stats.self_tasks += todayHistoryResult.data.length;
      stats.total_tasks += todayHistoryResult.data.length;
    }

    // Process today's data
    let todayTasks = (todayTasksResult.data || []).map(task => ({
      ...task,
      itemType: 'task',
      category: 'self',
      owner_name: task.users?.name || 'Unknown'
    }));

    const masterTasks = (todayMasterResult.data || []).map(task => ({
      ...task,
      itemType: 'task',
      category: 'assigned',
      owner_name: task.users?.name || 'Unknown'
    }));

    todayTasks = [...todayTasks, ...masterTasks];

    // Add history tasks if applicable
    if (todayHistoryResult && todayHistoryResult.data) {
      const historyTasks = todayHistoryResult.data.map(item => ({
        ...item,
        task_type: item.self_tasks?.task_type || 'Unknown',
        users: item.self_tasks?.users || { user_id: item.user_id, name: 'Unknown' },
        date: item.history_date,
        time: item.time_spent,
        timeline: null,
        itemType: 'task',
        category: 'self',
        owner_name: item.users?.name || item.self_tasks?.users?.name || 'Unknown'
      }));
      todayTasks = [...todayTasks, ...historyTasks];
    }

    // Sort tasks
    todayTasks.sort((a, b) => {
      if (view_type === 'all') {
        const nameCompare = (a.owner_name || '').localeCompare(b.owner_name || '');
        if (nameCompare !== 0) return nameCompare;
      }
      return new Date(b.date) - new Date(a.date);
    });

    const todayMeetings = ((todayMeetingsResult.data || []).map(meeting => ({
      ...meeting,
      itemType: 'meeting',
      owner_name: meeting.users?.name || 'Unknown'
    }))).sort((a, b) => {
      if (view_type === 'all') {
        const nameCompare = (a.owner_name || '').localeCompare(b.owner_name || '');
        if (nameCompare !== 0) return nameCompare;
      }
      return new Date(b.date) - new Date(a.date);
    });

    // Calculate member breakdown for team distribution cards
    let member_breakdown = {};
    if (view_type === 'all') {
      todayTasks.forEach(task => {
        const userName = task.owner_name;
        if (userName && userName !== 'Unknown') {
          member_breakdown[userName] = (member_breakdown[userName] || 0) + 1;
        }
      });
    }

    const response = {
      monthly_stats: stats,
      today: {
        tasks: todayTasks,
        meetings: todayMeetings,
        date: todayStr
      },
      view_type: view_type,
      target_user_ids: targetUserIds,
      member_breakdown: member_breakdown
    };

    console.log(`HOD dashboard data for users ${targetUserIds.join(', ')}:`, {
      monthly_tasks: stats.total_tasks,
      today_tasks: todayTasks.length,
      today_meetings: todayMeetings.length
    });

    res.json(response);

  } catch (error) {
    console.error("HOD dashboard data error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get tasks and meetings for HOD
router.post("/tasks/filter", async (req, res) => {
  try {
    const { user_id, view_tasks_of, target_user_id, date_filter = 'all', task_type = 'all', status = 'all', category = 'all' } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    // Determine whose data to fetch
    let targetUserIds = [];
    if (view_tasks_of === 'all') {
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
      targetUserIds = [view_tasks_of === 'team' && target_user_id ? target_user_id : user_id];
    }

    console.log(`Fetching HOD tasks for ${view_tasks_of} view, target users: ${targetUserIds.join(', ')}, date_filter: ${date_filter}`);

    const formatDate = (d) => d.toISOString().split("T")[0];
    const now = new Date();

    // Calculate date range based on date_filter
    let startDate, endDate;

    if (date_filter === 'today') {
      const today = formatDate(now);
      startDate = today;
      endDate = today;
    } else if (date_filter === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatDate(yesterday);
      startDate = yesterdayStr;
      endDate = yesterdayStr;
    } else if (date_filter === 'past_week') {
      const dayOfWeek = now.getDay();
      const daysToLastSaturday = (dayOfWeek + 1) % 7;
      const lastSaturday = new Date(now);
      lastSaturday.setDate(now.getDate() - daysToLastSaturday);
      const lastMonday = new Date(lastSaturday);
      lastMonday.setDate(lastSaturday.getDate() - 5);
      startDate = formatDate(lastMonday);
      endDate = formatDate(lastSaturday);
    } else if (date_filter === 'past_month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      startDate = formatDate(monthAgo);
      endDate = formatDate(now);
    } else {
      // 'all' or default - use current month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      startDate = formatDate(startOfMonth);
      endOfMonth = formatDate(endOfMonth);
    }

    // Build queries
    let selfTasksQuery = supabase
      .from("self_tasks")
      .select("*, users(name)")
      .in("user_id", targetUserIds)
      .gte("date", startDate)
      .lte("date", endDate);

    let masterTasksQuery = supabase
      .from("master_tasks")
      .select("*, users!assigned_to(name)")
      .in("assigned_to", targetUserIds)
      .gte("date", startDate)
      .lte("date", endDate);

    let historyTasksQuery = null;
    if (date_filter !== 'today' && date_filter !== 'all') {
      historyTasksQuery = supabase
        .from("task_history")
        .select("*, users!task_history_user_id_fkey(name), self_tasks!task_id(task_type, users!user_id(name))")
        .in("user_id", targetUserIds)
        .gte("history_date", startDate)
        .lte("history_date", endDate);
    }

    // Execute queries
    const [selfTasksResult, masterTasksResult, historyTasksResult] = await Promise.all([
      selfTasksQuery,
      masterTasksQuery,
      historyTasksQuery || Promise.resolve({ data: null })
    ]);

    // Check for errors
    if (selfTasksResult.error) {
      console.error("Self tasks error:", selfTasksResult.error);
      return res.status(400).json({ error: selfTasksResult.error.message });
    }

    if (masterTasksResult.error) {
      console.error("Master tasks error:", masterTasksResult.error);
      return res.status(400).json({ error: masterTasksResult.error.message });
    }

    if (historyTasksResult && historyTasksResult.error) {
      console.error("History tasks error:", historyTasksResult.error);
      return res.status(400).json({ error: historyTasksResult.error.message });
    }

    // Process self_tasks
    const self_tasks = (selfTasksResult.data || []).map(task => ({
      ...task,
      itemType: 'task',
      category: 'self',
      owner_name: task.users?.name || 'Unknown'
    }));

    // Process master_tasks
    const master_tasks = (masterTasksResult.data || []).map(task => ({
      ...task,
      itemType: 'task',
      category: 'assigned',
      owner_name: task.users?.name || 'Unknown'
    }));

    // Process history_tasks
    const history_tasks = historyTasksResult.data ? historyTasksResult.data.map(item => ({
      ...item,
      task_type: item.task_type || item.self_tasks?.task_type || 'Unknown',
      user_id: item.self_tasks?.users?.user_id || item.user_id,
      users: item.self_tasks?.users || { user_id: item.user_id, name: 'Unknown' },
      date: item.history_date,
      time: item.time_spent,
      timeline: null,
      itemType: 'task',
      category: 'self',
      owner_name: item.users?.name || item.self_tasks?.users?.name || 'Unknown'
    })) : [];

    const response = {
      self_tasks,
      master_tasks,
      history_tasks
    };

    console.log(`HOD tasks fetched: self ${self_tasks.length}, master ${master_tasks.length}, history ${history_tasks.length}`);

    res.json(response);

  } catch (error) {
    console.error("HOD tasks filter error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
