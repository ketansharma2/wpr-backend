const express = require("express");
const supabase = require("../config/supabase");
const router = express.Router();
const auth = require("./auth/authMiddleware");

// Get task statistics for a user (today, yesterday, or current month)
router.post("/monthly-stats", async (req, res) => {
  try {
    const { user_id, date_filter } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    const format = (d) => new Date(d).toISOString().split("T")[0];
    const now = new Date();
    const formattedToday = format(now);

    let startDate = null;
    let endDate = null;

    // Date filter logic
    if (date_filter === "today") {
      startDate = endDate = formattedToday;
    } else if (date_filter === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      startDate = endDate = format(yesterday);
    } else {
      // Default to current month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      startDate = format(startOfMonth);
      endDate = format(endOfMonth);
    }

    console.log(`Fetching monthly stats for user ${user_id} from ${startDate} to ${endDate}`);

    // Query only self_tasks for the user
    const { data: selfTasks, error: selfError } = await supabase
      .from("self_tasks")
      .select("status")
      .eq("user_id", user_id)
      .gte("date", startDate)
      .lte("date", endDate);

    if (selfError) {
      console.error("Self tasks error:", selfError);
      return res.status(400).json({ error: selfError.message });
    }

    // Use only self tasks
    const allTasks = selfTasks || [];

    // Count by status
    const stats = {
      total_tasks: allTasks.length,
      completed: 0,
      in_progress: 0,
      not_started: 0
    };

    allTasks.forEach(task => {
      const status = task.status?.toLowerCase();
      if (status === 'done') {
        stats.completed++;
      } else if (status === 'in progress') {
        stats.in_progress++;
      } else if (status === 'pending' || status === 'not started') {
        stats.not_started++;
      }
    });

    console.log(`Monthly stats for user ${user_id}:`, stats);

    res.json(stats);

  } catch (error) {
    console.error("Monthly stats error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get tasks for a user (today or yesterday)
router.post("/today-tasks", async (req, res) => {
  try {
    const { user_id, date_filter } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    // Get target date based on filter
    const now = new Date();
    let targetDate = now;

    if (date_filter === "yesterday") {
      targetDate = new Date(now);
      targetDate.setDate(now.getDate() - 1);
    }

    const targetDateStr = targetDate.toISOString().split("T")[0];

    const dateLabel = date_filter === "yesterday" ? "yesterday" : "today";
    console.log(`Fetching ${dateLabel}'s tasks for user ${user_id} on ${targetDateStr}`);

    // Query only self_tasks for the user (target date only)
    const { data: selfTasks, error: selfError } = await supabase
      .from("self_tasks")
      .select("*")
      .eq("user_id", user_id)
      .eq("date", targetDateStr);

    if (selfError) {
      console.error("Self tasks error:", selfError);
      return res.status(400).json({ error: selfError.message });
    }

    // Prepare tasks array
    const tasks = (selfTasks || []).map(task => ({ ...task, itemType: 'task', category: 'self' }));

    console.log(`Found ${tasks.length} ${dateLabel}'s tasks for user ${user_id}`);

    res.json({
      tasks: tasks,
      date: targetDateStr,
      count: tasks.length
    });

  } catch (error) {
    console.error("Today tasks error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get today's meetings for a user
router.post("/today-meetings", async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    console.log(`Fetching today's meetings for user ${user_id} on ${todayStr}`);

    // Query meetings for the user (today only)
    const { data: meetings, error: meetingsError } = await supabase
      .from("meetings")
      .select("*")
      .eq("user_id", user_id)
      .eq("date", todayStr);

    if (meetingsError) {
      console.error("Meetings error:", meetingsError);
      return res.status(400).json({ error: meetingsError.message });
    }

    // Prepare meetings array
    const meetingsList = (meetings || []).map(meeting => ({ ...meeting, itemType: 'meeting' }));

    console.log(`Found ${meetingsList.length} meetings for user ${user_id} today`);

    res.json({
      meetings: meetingsList,
      date: todayStr,
      count: meetingsList.length
    });

  } catch (error) {
    console.error("Today meetings error:", error);
    res.status(500).json({ error: "Server error" });
  }
});


// Get last working day's tasks for a user (smart yesterday logic)
router.post("/last-working-day-tasks", async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    console.log(`Finding last working day tasks for user ${user_id}`);

    // Start from yesterday
    let checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - 1);

    // Check up to 30 days back for safety
    for (let i = 0; i < 30; i++) {
      const dateStr = checkDate.toISOString().split("T")[0];

      console.log(`Checking date: ${dateStr} for user ${user_id}`);

      // Query self_tasks for the user on this date
      const { data: selfTasks, error: selfError } = await supabase
        .from("self_tasks")
        .select("*")
        .eq("user_id", user_id)
        .eq("date", dateStr);

      if (selfError) {
        console.error("Self tasks error:", selfError);
        return res.status(400).json({ error: selfError.message });
      }

      // Query task_history for the user on this date
      const { data: historyTasks, error: historyError } = await supabase
        .from("task_history")
        .select("*")
        .eq("user_id", user_id)
        .eq("history_date", dateStr);

      if (historyError) {
        console.error("History tasks error:", historyError);
        return res.status(400).json({ error: historyError.message });
      }

      // For team member dashboard, show both self_tasks and task_history
      const allTasks = [...(selfTasks || []), ...(historyTasks || [])];

      // If we found tasks on this date, return them
      if (allTasks.length > 0) {
        console.log(`Found ${allTasks.length} tasks for last working day: ${dateStr}`);

        // Prepare tasks array with proper field mapping
        const tasks = await Promise.all(allTasks.map(async (task) => {
          if (task.history_date) {
            // This is a history task - fetch task_type from self_tasks if possible
            let taskType = 'History'; // fallback
            if (task.task_id) {
              try {
                const { data: selfTask, error } = await supabase
                  .from("self_tasks")
                  .select("task_type")
                  .eq("task_id", task.task_id)
                  .single();
                
                if (!error && selfTask) {
                  taskType = selfTask.task_type;
                }
              } catch (err) {
                console.error("Error fetching task_type for history task:", err);
              }
            }

            return {
              task_name: task.task_name,
              date: task.history_date,
              time_in_mins: task.time_spent,
              remarks: task.remarks,
              status: task.status,
              task_type: taskType,
              itemType: 'task',
              file_link: '',
              timeline: task.history_date,
              attachments: '',
              task_id: task.task_id,
              user_id: task.user_id,
              created_at: task.created_at || null,
              updated_at: task.updated_at || null
            };
          } else {
            // This is a self task
            return {
              ...task,
              itemType: task.task_id ? 'task' : 'meeting'
            };
          }
        }));

        return res.json({
          tasks: tasks,
          date: dateStr,
          found: true,
          days_back: i + 1
        });
      }

      // Move back one day
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // No working days found in last 30 days
    console.log(`No working days found in last 30 days for user ${user_id}`);

    res.json({
      tasks: [],
      date: null,
      found: false,
      message: "No tasks found in last 30 days"
    });

  } catch (error) {
    console.error("Last working day tasks error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get meetings for a specific date for a user
router.post("/meetings-by-date", async (req, res) => {
  try {
    const { user_id, date } = req.body;

    if (!user_id || !date) {
      return res.status(400).json({ error: "user_id and date are required" });
    }

    console.log(`Fetching meetings for user ${user_id} on ${date}`);

    // Query meetings for the user on the specific date
    const { data: meetings, error: meetingsError } = await supabase
      .from("meetings")
      .select("*")
      .eq("user_id", user_id)
      .eq("date", date);

    if (meetingsError) {
      console.error("Meetings error:", meetingsError);
      return res.status(400).json({ error: meetingsError.message });
    }

    // Prepare meetings array
    const meetingsList = (meetings || []).map(meeting => ({ ...meeting, itemType: 'meeting' }));

    console.log(`Found ${meetingsList.length} meetings for user ${user_id} on ${date}`);

    res.json({
      meetings: meetingsList,
      date: date,
      count: meetingsList.length
    });

  } catch (error) {
    console.error("Meetings by date error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
