// const express = require("express");
// const supabase = require("../config/supabase");
// const router = express.Router();
// const auth = require("./auth/authMiddleware");
// router.use(auth);


// router.post("/", async (req, res) => {
//   try {
//     const { from_date, to_date, task_type, category, status } = req.body;
//     let user_id = req.user.id;

//     // Prepare responses
//     let selfQuery = supabase.from("self_tasks").select("*");
//     let masterQuery = supabase.from("master_tasks").select("*");

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
//       selfQuery = selfQuery.eq("user_id", user_id);
//       masterQuery = masterQuery.limit(0); // exclude assigned tasks
//     } else if (category === "assigned") {
//       masterQuery = masterQuery.eq("assigned_to", user_id);
//       selfQuery = selfQuery.limit(0); // exclude self tasks
//     } else {
//       // category = "all" or undefined
//       selfQuery = selfQuery.eq("user_id", user_id);
//       masterQuery = masterQuery.eq("assigned_to", user_id);
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

//     res.json({ tasks: finalResponse });

//   } catch (err) {
//     res.status(500).json({ error: "Server Error" });
//   }
// });

// module.exports= router;

const express = require("express");
const supabase = require("../config/supabase");
const router = express.Router();
const auth = require("./auth/authMiddleware");

router.use(auth);

router.post("/", async (req, res) => {
  try {
    const { from_date, to_date, task_type, category, status } = req.body;
    const user_id = req.user.id;

    let selfQuery = supabase.from("self_tasks").select("*");
    let masterQuery = supabase.from("master_tasks").select("*");
    if (!from_date || !to_date) {
  return res.status(200).json({ 
    error: "Date range is required",
    message: "Please provide both from_date and to_date"
  });
}


    // ---------------- DATE FILTER ----------------
    if (from_date && to_date) {
      selfQuery = selfQuery.gte("date", from_date).lte("date", to_date);
      masterQuery = masterQuery.gte("date", from_date).lte("date", to_date);
    }

    // ---------------- STATUS FILTER ----------------
    if (status && status !== "all") {
      selfQuery = selfQuery.eq("status", status);
      masterQuery = masterQuery.eq("status", status);
    }

    // ---------------- CATEGORY FILTER ----------------
    if (category === "self") {
      selfQuery = selfQuery.eq("user_id", user_id);
      masterQuery = masterQuery.limit(0);

    } else if (category === "assigned") {
      masterQuery = masterQuery.eq("assigned_to", user_id);
      selfQuery = selfQuery.limit(0);

    } else {
      selfQuery = selfQuery.eq("user_id", user_id);
      masterQuery = masterQuery.eq("assigned_to", user_id);
    }

    // ---------------- TASK TYPE FILTER ----------------
    if (task_type && task_type !== "all") {
      selfQuery = selfQuery.eq("task_type", task_type);
    }

    // ---------------- EXECUTE TASK QUERIES ----------------
    const [selfRes, masterRes] = await Promise.all([selfQuery, masterQuery]);

    if (selfRes.error || masterRes.error) {
      return res.status(400).json({
        error: selfRes.error?.message || masterRes.error?.message
      });
    }

    const selfTaskIds = selfRes.data.map(task => task.task_id);

    let latestHistoryMap = {};
    let firstHistoryMap = {};
    let remarksMap = {};
    let meetingsMap = {};

    // ---------------- FETCH HISTORY ----------------
    if (selfTaskIds.length > 0) {
      let historyQuery = supabase
        .from("task_history")
        .select("*")
        .in("task_id", selfTaskIds);

      if (from_date && to_date) {
        historyQuery = historyQuery
          .gte("history_date", from_date)
          .lte("history_date", to_date);
      }

      const { data: historyData, error: historyError } = await historyQuery
        .order("history_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (historyError) {
        return res.status(400).json({
          error: historyError.message
        });
      }

      historyData.forEach(item => {
        if (!latestHistoryMap[item.task_id]) {
          latestHistoryMap[item.task_id] = item;
        }

        firstHistoryMap[item.task_id] = item;

        if (!remarksMap[item.task_id]) {
          remarksMap[item.task_id] = [];
        }

        if (item.remarks) {
          remarksMap[item.task_id].push(
            `${item.history_date} : ${item.remarks}`
          );
        }
      });

      // ---------------- FETCH MEETINGS ----------------
      const { data: meetingsData, error: meetingsError } = await supabase
        .from("meetings")
        .select("*")
        .in("task_id", selfTaskIds)
        .order("date", { ascending: false });

      if (meetingsError) {
        return res.status(400).json({
          error: meetingsError.message
        });
      }

      meetingsData.forEach(meeting => {
        if (!meetingsMap[meeting.task_id]) {
          meetingsMap[meeting.task_id] = [];
        }

        meetingsMap[meeting.task_id].push(meeting);
      });
    }

    // ---------------- SELF TASK + HISTORY + MEETING ----------------
    const selfTasksWithHistory = selfRes.data.map(task => ({
      ...task,
      source: "self",

      start_date:
        firstHistoryMap[task.task_id]?.history_date || task.date,

      end_date:
        latestHistoryMap[task.task_id]?.history_date || null,

      latest_remarks:
        latestHistoryMap[task.task_id]?.remarks || null,

      remarks_between_dates:
        remarksMap[task.task_id]?.join(" | ") || task.remarks,

      latest_status:
        latestHistoryMap[task.task_id]?.status || task.status,

      latest_time_spent:
        latestHistoryMap[task.task_id]?.time_spent || null,

      meeting_details:
        meetingsMap[task.task_id] || []
    }));

    // ---------------- MASTER TASK ----------------
    const masterTasks = masterRes.data.map(task => ({
      ...task,
      source: "assigned"
    }));

    // ---------------- FINAL RESPONSE ----------------
    const finalResponse = [
      ...selfTasksWithHistory,
      ...masterTasks
    ];

    res.json({
      tasks: finalResponse
    });

  } catch (err) {
    res.status(500).json({
      error: "Server Error"
    });
  }
});

module.exports = router;