// const express = require("express");
// const supabase = require("../../config/supabase");
// const router = express.Router();
// const auth = require("./../auth/authMiddleware");
// router.use(auth);
// // HOD weekly report (self, team, or all)
// router.post("/", async (req, res) => {
//   try {
//         let user_id = req.user.id;

//     const {
//       view_type, // "self", "team", or "all"
//       target_user_id, // for team view: the team member whose report to generate
//       from_date,
//       to_date,
//       task_type,
//       category, // "all", "self", "assigned"
//       status
//     } = req.body;

//     // Determine whose report to generate
//     let targetUserIds = [];
//     if (view_type === 'all') {
//       // Get all team members in the department
//       const { data: hodData, error: hodError } = await supabase
//         .from("users")
//         .select("dept")
//         .eq("user_id", user_id)
//         .single();

//       if (hodError) {
//         console.error("HOD data error:", hodError);
//         return res.status(400).json({ error: hodError.message });
//       }

//       const { data: teamMembers, error: teamError } = await supabase
//         .from("users")
//         .select("user_id")
//         .eq("dept", hodData.dept);

//       if (teamError) {
//         console.error("Team members error:", teamError);
//         return res.status(400).json({ error: teamError.message });
//       }

//       targetUserIds = teamMembers.map(member => member.user_id);
//     } else {
//       targetUserIds = [view_type === "self" ? user_id : target_user_id];
//     }

//     if (view_type === "team" && !target_user_id) {
//       return res.status(400).json({ error: "target_user_id required when viewing team reports" });
//     }

//     // Prepare responses with user joins
//     let selfQuery = supabase.from("self_tasks").select("*, users(name)");
//     let masterQuery = supabase.from("master_tasks").select("*, assigned_by_user:users!assigned_by(name), assigned_to_user:users!assigned_to(name)");

//     // ---------------------- DATE FILTER ----------------------
//     if (from_date && to_date) {
//       selfQuery = selfQuery
//         .gte("date", from_date)
//         .lte("date", to_date);

//       masterQuery = masterQuery
//         .gte("date", from_date)
//         .lte("date", to_date);
//     }

//     // ---------------------- STATUS FILTER ----------------------
//     if (status && status !== "all") {
//       selfQuery = selfQuery.eq("status", status);
//       masterQuery = masterQuery.eq("status", status);
//     }

//     // ---------------------- CATEGORY FILTER (self/assigned/all) ----------------------
//     if (category === "self") {
//       selfQuery = targetUserIds.length === 1
//         ? selfQuery.eq("user_id", targetUserIds[0])
//         : selfQuery.in("user_id", targetUserIds);
//       masterQuery = masterQuery.limit(0); // exclude assigned tasks
//     } else if (category === "assigned") {
//       masterQuery = targetUserIds.length === 1
//         ? masterQuery.eq("assigned_to", targetUserIds[0])
//         : masterQuery.in("assigned_to", targetUserIds);
//       selfQuery = selfQuery.limit(0); // exclude self tasks
//     } else {
//       // category = "all" or undefined
//       selfQuery = targetUserIds.length === 1
//         ? selfQuery.eq("user_id", targetUserIds[0])
//         : selfQuery.in("user_id", targetUserIds);
//       masterQuery = targetUserIds.length === 1
//         ? masterQuery.eq("assigned_to", targetUserIds[0])
//         : masterQuery.in("assigned_to", targetUserIds);
//     }

//     // ---------------------- TASK TYPE FILTER (Fixed, Variable, etc.) ----------------------
//     // Only applies to self_tasks since master_tasks don't have task_type
//     if (task_type && task_type !== "all") {
//       selfQuery = selfQuery.eq("task_type", task_type);
//     }

//     // ---------------------- EXECUTE BOTH QUERIES ----------------------
//     const [selfRes, masterRes] = await Promise.all([
//       selfQuery,
//       masterQuery
//     ]);

//     if (selfRes.error || masterRes.error) {
//       return res.status(400).json({
//         error: selfRes.error?.message || masterRes.error?.message
//       });
//     }

//     // Merge results
//     const finalResponse = [
//       ...selfRes.data.map(t => ({ ...t, source: "self" })),
//       ...masterRes.data.map(t => ({ ...t, source: "assigned" }))
//     ];

//     res.json({
//       tasks: finalResponse,
//       report_for: targetUserIds,
//       view_type
//     });

//   } catch (err) {
//     res.status(500).json({ error: "Server Error" });
//   }
// });

// module.exports = router;

const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();
const auth = require("./../auth/authMiddleware");

router.use(auth);

router.post("/", async (req, res) => {
  try {
    const user_id = req.user.id;
    const { view_type, target_user_id, from_date, to_date, task_type, category, status } = req.body;

    // ---------------- VALIDATE DATE RANGE ----------------
    if (!from_date || !to_date) {
      return res.status(200).json({
        error: "Date range required",
        message: "Please provide both from_date and to_date",
      });
    }

    // ---------------- DETERMINE TARGET USERS ----------------
    let targetUserIds = [];
    if (view_type === "self") {
      targetUserIds = [user_id];
    } else if (view_type === "team") {
      if (!target_user_id)
        return res.status(400).json({ error: "target_user_id required for team view" });
      targetUserIds = [target_user_id];
    } else if (view_type === "all") {
      // Get all users in the same department
      const { data: hodData, error: hodError } = await supabase
        .from("users")
        .select("dept")
        .eq("user_id", user_id)
        .single();
      if (hodError) return res.status(400).json({ error: hodError.message });

      const { data: teamMembers, error: teamError } = await supabase
        .from("users")
        .select("user_id")
        .eq("dept", hodData.dept);
      if (teamError) return res.status(400).json({ error: teamError.message });

      targetUserIds = teamMembers.map(m => m.user_id);
    }

    // ---------------- PREPARE TASK QUERIES ----------------
    let selfQuery = supabase
      .from("self_tasks")
      .select("*, users(name)")
      .gte("date", from_date)
      .lte("date", to_date);

    let masterQuery = supabase
      .from("master_tasks")
      .select("*, assigned_by_user:users!assigned_by(name), assigned_to_user:users!assigned_to(name)")
      .gte("date", from_date)
      .lte("date", to_date);

    // Status filter
    if (status && status !== "all") {
      selfQuery = selfQuery.eq("status", status);
      masterQuery = masterQuery.eq("status", status);
    }

    // Category filter
    if (category === "self") {
      selfQuery = targetUserIds.length === 1
        ? selfQuery.eq("user_id", targetUserIds[0])
        : selfQuery.in("user_id", targetUserIds);
      masterQuery = masterQuery.limit(0);
    } else if (category === "assigned") {
      masterQuery = targetUserIds.length === 1
        ? masterQuery.eq("assigned_to", targetUserIds[0])
        : masterQuery.in("assigned_to", targetUserIds);
      selfQuery = selfQuery.limit(0);
    } else {
      selfQuery = targetUserIds.length === 1
        ? selfQuery.eq("user_id", targetUserIds[0])
        : selfQuery.in("user_id", targetUserIds);
      masterQuery = targetUserIds.length === 1
        ? masterQuery.eq("assigned_to", targetUserIds[0])
        : masterQuery.in("assigned_to", targetUserIds);
    }

    // Task type filter (only self tasks)
    if (task_type && task_type !== "all") {
      selfQuery = selfQuery.eq("task_type", task_type);
    }

    // ---------------- EXECUTE TASK QUERIES ----------------
    const [selfRes, masterRes] = await Promise.all([selfQuery, masterQuery]);
    if (selfRes.error || masterRes.error) {
      return res.status(400).json({
        error: selfRes.error?.message || masterRes.error?.message,
      });
    }

    const selfTaskIds = selfRes.data.map(task => task.task_id);

    // ---------------- FETCH HISTORY & MEETINGS ----------------
    let latestHistoryMap = {};
    let firstHistoryMap = {};
    let remarksMap = {};
    let meetingsMap = {};

    if (selfTaskIds.length > 0) {
      const { data: historyData, error: historyError } = await supabase
        .from("task_history")
        .select("*")
        .in("task_id", selfTaskIds)
        .gte("history_date", from_date)
        .lte("history_date", to_date)
        .order("history_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (historyError) return res.status(400).json({ error: historyError.message });

      historyData.forEach(item => {
  if (!item || !item.task_id) return;

  // Set latest history (most recent) if not already set
  if (!latestHistoryMap[item.task_id] || new Date(item.history_date) > new Date(latestHistoryMap[item.task_id].history_date)) {
    latestHistoryMap[item.task_id] = item;
  }

  // Set first history (earliest)
  if (!firstHistoryMap[item.task_id] || new Date(item.history_date) < new Date(firstHistoryMap[item.task_id].history_date)) {
    firstHistoryMap[item.task_id] = item;
  }

  // Initialize remarks array
  if (!remarksMap[item.task_id]) remarksMap[item.task_id] = [];

  // Format date safely
  let formattedDate = item.history_date ? new Date(item.history_date).toLocaleDateString("en-GB") : "N/A";
  let remarks = item.remarks || "-";

  remarksMap[item.task_id].push(`${formattedDate}: ${remarks}`);
});

      const { data: meetingsData, error: meetingsError } = await supabase
        .from("meetings")
        .select("*")
        .in("task_id", selfTaskIds)
        .order("date", { ascending: false });

      if (meetingsError) return res.status(400).json({ error: meetingsError.message });

      meetingsData.forEach(meeting => {
        if (!meetingsMap[meeting.task_id]) meetingsMap[meeting.task_id] = [];
        meetingsMap[meeting.task_id].push(meeting);
      });
    }

    // ---------------- MERGE SELF TASKS ----------------
    const selfTasksWithHistory = selfRes.data.map(task => ({
      ...task,
      source: "self",
      start_date: firstHistoryMap[task.task_id]?.history_date || task.date,
      end_date: latestHistoryMap[task.task_id]?.history_date || null,
      latest_remarks: latestHistoryMap[task.task_id]?.remarks || null,
      remarks_between_dates: remarksMap[task.task_id]?.join(" | ") || task.remarks,
      latest_status: latestHistoryMap[task.task_id]?.status || task.status,
      latest_time_spent: latestHistoryMap[task.task_id]?.time_spent || null,
      meeting_details: meetingsMap[task.task_id] || [],
    }));

    // ---------------- MASTER TASKS ----------------
    const masterTasks = masterRes.data.map(task => ({
      ...task,
      source: "assigned",
    }));

    // ---------------- FINAL RESPONSE ----------------
    const finalResponse = [...selfTasksWithHistory, ...masterTasks];
    console.log(finalResponse);
    res.json({
      tasks: finalResponse,
      report_for: targetUserIds,
      view_type,
    });

  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;