const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();
const auth = require("../auth/authMiddleware");

router.post("/filter", auth, async (req, res) => {
  try {
    let {
      from_date,
      to_date,
      task_type = "all",
      status = "all",
      category = "all",
      target_user_id
    } = req.body;

    // ---------------- DATE DEFAULT ----------------
    if (!from_date || !to_date) {
      const today = new Date();
      const day = today.getDay();

      const monday = new Date(today);
      monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));

      const saturday = new Date(monday);
      saturday.setDate(monday.getDate() + 5);

      from_date = monday.toISOString().split("T")[0];
      to_date = saturday.toISOString().split("T")[0];
    }

    // ---------------- FILTER BUILDER ----------------
    const applyFilters = (table) => {
      let q;

      if (table === "self_tasks") {
        q = supabase.from(table).select(`
          *,
          users(name)
        `);

        if (target_user_id && target_user_id !== "all") {
          q = q.eq("user_id", target_user_id);
        }

      } else {
        q = supabase.from(table).select(`
          *,
          assigned_to_user:users!assigned_to(name),
          assigned_by_user:users!assigned_by(name)
        `);

        if (target_user_id && target_user_id !== "all") {
          q = q.eq("assigned_to", target_user_id);
        }
      }

      q = q.gte("date", from_date).lte("date", to_date);

      if (table === "self_tasks" && task_type !== "all") {
        q = q.eq("task_type", task_type);
      }

      if (status !== "all") {
        q = q.eq("status", status);
      }

      return q;
    };

    // ---------------- FETCH ----------------
    let selfTasks = [];
    let masterTasks = [];

    if (category === "all") {
      const [selfRes, masterRes] = await Promise.all([
        applyFilters("self_tasks"),
        applyFilters("master_tasks")
      ]);

      if (selfRes.error || masterRes.error) {
        return res.status(400).json({
          error: selfRes.error?.message || masterRes.error?.message
        });
      }

      selfTasks = selfRes.data || [];
      masterTasks = masterRes.data || [];

    } else if (category === "self") {
      const { data, error } = await applyFilters("self_tasks");
      if (error) return res.status(400).json({ error: error.message });

      selfTasks = data || [];

    } else if (category === "assigned") {
      const { data, error } = await applyFilters("master_tasks");
      if (error) return res.status(400).json({ error: error.message });

      masterTasks = data || [];
    }

    // ---------------- HISTORY ----------------
    const selfTaskIds = selfTasks.map(t => t.task_id).filter(Boolean);

    let latestHistoryMap = {};
    let firstHistoryMap = {};
    let remarksMap = {};
    let meetingsMap = {};

    if (selfTaskIds.length > 0) {
      const { data: historyData } = await supabase
        .from("task_history")
        .select("*")
        .in("task_id", selfTaskIds)
        .gte("history_date", from_date)
        .lte("history_date", to_date)
        .order("history_date", { ascending: false });

      historyData?.forEach(item => {
        if (!latestHistoryMap[item.task_id]) {
          latestHistoryMap[item.task_id] = item;
        }

        firstHistoryMap[item.task_id] = item;

        if (!remarksMap[item.task_id]) remarksMap[item.task_id] = [];

        remarksMap[item.task_id].push(
          `${item.history_date} : ${item.remarks}: ${item.time_spent}: ${item.status}`
        );
      });

      const { data: meetingsData } = await supabase
        .from("meetings")
        .select("*")
        .in("task_id", selfTaskIds);

      meetingsData?.forEach(meeting => {
        if (!meetingsMap[meeting.task_id]) meetingsMap[meeting.task_id] = [];
        meetingsMap[meeting.task_id].push(meeting);
      });
    }

    // ---------------- SELF TASK RESPONSE ----------------
    const selfTasksWithHistory = selfTasks.map(task => ({
      ...task,
      source: "self",
      start_date: firstHistoryMap[task.task_id]?.history_date || task.date,
      end_date: latestHistoryMap[task.task_id]?.history_date || null,
      latest_remarks: latestHistoryMap[task.task_id]?.remarks || null,
      remarks_between_dates: remarksMap[task.task_id]?.join(" | ") || task.remarks,
      latest_status: latestHistoryMap[task.task_id]?.status || task.status,
      latest_time_spent: latestHistoryMap[task.task_id]?.time_spent || null,
      meeting_details: meetingsMap[task.task_id] || []
    }));

    // ---------------- MASTER TASK RESPONSE ----------------
    const masterTasksWithSource = masterTasks.map(task => ({
      ...task,
      source: "assigned"
    }));

    // ---------------- FINAL RESPONSE ----------------
    res.json({
      self_tasks: selfTasksWithHistory,
      master_tasks: masterTasksWithSource,
      date_range: {
        from_date,
        to_date
      }
    });

  } catch (error) {
    console.error("Admin weekly filter error:", error);
    res.status(500).json({ error: "Server error" });
  }
});


// Get all members for admin weekly filtering dropdown
router.get("/members", auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const { data, error } = await supabase
      .from("users")
      .select("user_id, name, email, dept, role")
      .neq("user_id", currentUserId) // Exclude current admin user
      .order("name");

    if (error) return res.status(400).json({ error: error.message });

    res.json({ members: data });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;