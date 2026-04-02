const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();
const auth = require("../auth/authMiddleware");

// Filter all members' tasks for admin
// router.post("/filter", async (req, res) => {
//   try {
//     console.log('Admin tasks filter request received:', req.body);
//     const {
//       date_filter,
//       task_type,
//       status,
//       category,
//       target_user_id, // specific member (optional - use 'all' for all members)
//       custom_date
//     } = req.body;
// console.log('category',category)
//     const format = (d) => new Date(d).toISOString().split("T")[0];

//     let today = new Date();
//     let formattedToday = format(today);

//     let startDate = null;
//     let endDate = null;

    
//     // ---------------------- DATE FILTER LOGIC ----------------------

//     if (date_filter === "today") {
//       startDate = endDate = formattedToday;
//     }

//     if (date_filter === "yesterday") {
//       let d = new Date();
//       d.setDate(d.getDate() - 1);
//       startDate = endDate = format(d);
//     }

//     if (date_filter === "custom") {
//       startDate = endDate = custom_date;
//     }

//     if (date_filter === "past_week") {
//       let d = new Date();
//       d.setDate(d.getDate() - 7);

//       let weekday = d.getDay();
//       let monday = new Date(d);
//       monday.setDate(d.getDate() - ((weekday + 6) % 7));

//       let saturday = new Date(monday);
//       saturday.setDate(monday.getDate() + 5);

//       startDate = format(monday);
//       endDate = format(saturday);
//     }

//     if (date_filter === "past_month") {
//       let now = new Date();
//       let first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
//       let last = new Date(now.getFullYear(), now.getMonth(), 0);

//       startDate = format(first);
//       endDate = format(last);
//     }

//     // ---------------------- FILTER BUILDER ----------------------
//     const applyFilters = (table) => {
//       let q;

//       if (table === "self_tasks") {
//         q = supabase.from(table).select(`
//           *,
//           users(name)
//         `);
//         // Filter by target user only if specified (not 'all' or null)
//         if (target_user_id && target_user_id !== 'all') {
//           q = q.eq("user_id", target_user_id);
//         }
//         // If target_user_id is 'all' or null, don't filter by user (fetch all users' tasks)
//       } else {
//         q = supabase.from(table).select(`
//           *,
//           users!assigned_to(name)
//         `);
//         // Filter by target user only if specified (not 'all' or null)
//         if (target_user_id && target_user_id !== 'all') {
//           q = q.eq("assigned_to", target_user_id);
//         }
//         // If target_user_id is 'all' or null, don't filter by user (fetch all users' tasks)
//       }

//       if (startDate && endDate) {
//         q = q.gte("date", startDate).lte("date", endDate);
//       }

//       // Task type filter only applies to self_tasks
//       if (table === "self_tasks" && task_type && task_type !== "all") {
//         q = q.eq("task_type", task_type);
//       }

//       if (status && status !== "all") {
//         q = q.eq("status", status);
//       }

//       return q;
//     };

//     // ---------------------- FETCH BASED ON CATEGORY ----------------------
//     let response = {};

//     if (category === "all") {
//       // Fetch both self_tasks and master_tasks for all/specific users
//       const [selfRes, masterRes] = await Promise.all([
//         applyFilters("self_tasks"),
//         applyFilters("master_tasks")
//       ]);

//       if (selfRes.error || masterRes.error) {
//         return res.status(400).json({
//           error: selfRes.error?.message || masterRes.error?.message
//         });
//       }

//       response = {
//         self_tasks: selfRes.data,
//         master_tasks: masterRes.data
//       };
//     } else if (category === "self") {
//       // Fetch only self_tasks
//       const { data, error } = await applyFilters("self_tasks");
//       if (error) return res.status(400).json({ error: error.message });

//       response = { self_tasks: data, master_tasks: [] };
//     } else if (category === "assigned") {
//       // Fetch only master_tasks
//       const { data, error } = await applyFilters("master_tasks");
//       if (error) return res.status(400).json({ error: error.message });

//       response = { self_tasks: [], master_tasks: data };
//     } else {
//       return res.status(400).json({ error: "Invalid category. Must be 'all', 'self', or 'assigned'" });
//     }

//     console.log('Admin filter response:', {
//       target_user: target_user_id || 'all_users',
//       self_tasks_count: response.self_tasks?.length || 0,
//       master_tasks_count: response.master_tasks?.length || 0
//     });

//     res.json(response);

//   } catch (error) {
//     res.status(500).json({ error: "Server error" });
//   }
// });

router.post("/filter", async (req, res) => {
  try {
    console.log("Admin tasks filter request received:", req.body);

    const {
      date_filter,
      task_type,
      status,
      category,
      target_user_id,
      custom_date
    } = req.body;

    const format = (d) => new Date(d).toISOString().split("T")[0];

    let today = new Date();
    let formattedToday = format(today);

    let startDate = null;
    let endDate = null;

    // ---------------- DATE FILTER ----------------

    if (date_filter === "today") {
      startDate = endDate = formattedToday;
    }

    if (date_filter === "yesterday") {
      let d = new Date();
      d.setDate(d.getDate() - 1);
      startDate = endDate = format(d);
    }

    if (date_filter === "custom") {
      startDate = endDate = custom_date;
    }

    if (date_filter === "past_week") {
      let d = new Date();
      d.setDate(d.getDate() - 7);

      let weekday = d.getDay();
      let monday = new Date(d);
      monday.setDate(d.getDate() - ((weekday + 6) % 7));

      let saturday = new Date(monday);
      saturday.setDate(monday.getDate() + 5);

      startDate = format(monday);
      endDate = format(saturday);
    }

    if (date_filter === "past_month") {
      let now = new Date();
      let first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      let last = new Date(now.getFullYear(), now.getMonth(), 0);

      startDate = format(first);
      endDate = format(last);
    }

    // ---------------- QUERY BUILDER ----------------

    const applyFilters = (table) => {
      let q;

      if (table === "self_tasks") {
        q = supabase.from("self_tasks").select(`
          *,
user:users!self_tasks_user_id_fkey(name) ,      
   task_history (
            history_id,
            history_date,
            time_spent,
            remarks,
            status,
  user:users!task_history_user_id_fkey(name),

            created_at
          )
        `);

        if (target_user_id && target_user_id !== "all") {
          q = q.eq("user_id", target_user_id);
        }

        if (task_type && task_type !== "all") {
          q = q.eq("task_type", task_type);
        }
      } else {
        q = supabase.from("master_tasks").select(`
          *,
          users!assigned_to(name)
        `);

        if (target_user_id && target_user_id !== "all") {
          q = q.eq("assigned_to", target_user_id);
        }
      }

      if (startDate && endDate) {
        q = q.gte("date", startDate).lte("date", endDate);
      }

      if (status && status !== "all" && table === "master_tasks") {
        q = q.eq("status", status);
      }

      return q;
    };

    // ---------------- FETCH ----------------

    let response = {};

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

const processedSelfTasks = selfRes.data
  .flatMap(task => {
    const originalTask = {
      ...task,
      history_date: task.date,
      itemType: "task",
      category: "self",
    };
  console.log('check',task.user?.name);
    const historyRows = (task.task_history || []).map(history => ({
      task_id: task.task_id,
      task_name: task.task_name,
      user_id: task.user_id,
      owner_name12: history.user?.name || task.user?.name || "Unknown",

      task_type: task.task_type,
      timeline: task.timeline,
      file_link: task.file_link,

      date: history.history_date,
      history_date: history.history_date,
      time: history.time_spent,
      remarks: history.remarks,
      status: history.status,

      itemType: "task",
      category: "self"
    }));

    return [originalTask, ...historyRows];
  })
  .filter(task => {
    if (status && status !== "all") {
      return task.status === status;
    }
    return true;
  })
  .sort((a, b) => new Date(b.history_date) - new Date(a.history_date));

      response = {
        self_tasks: processedSelfTasks,
        master_tasks: masterRes.data
      };
    }

    else if (category === "self") {
      const { data, error } = await applyFilters("self_tasks");

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      const processedSelfTasks = data
        .map(task => {
          const latestHistory = task.task_history?.length
            ? task.task_history.sort(
                (a, b) => new Date(b.created_at) - new Date(a.created_at)
              )[0]
            : null;

          return {
            ...task,
            status: latestHistory?.status || task.status,
            remarks: latestHistory?.remarks || task.remarks,
            time: latestHistory?.time_spent || task.time,
            history_date: latestHistory?.history_date || task.date
          };
        })
        .filter(task => {
          if (status && status !== "all") {
            return task.status === status;
          }
          return true;
        });

      response = {
        self_tasks: processedSelfTasks,
        master_tasks: []
      };
    }

    else if (category === "assigned") {
      const { data, error } = await applyFilters("master_tasks");

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      response = {
        self_tasks: [],
        master_tasks: data
      };
    }

    else {
      return res.status(400).json({
        error: "Invalid category"
      });
    }

    console.log("Final response:", {
      self_tasks: response.self_tasks.length,
      master_tasks: response.master_tasks.length
    });

    res.json(response);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Server error"
    });
  }
});

// Get all tasks count for admin dashboard
router.get("/count", async (req, res) => {
  try {
    // Get count from self_tasks table
    const { count: selfTasksCount, error: selfError } = await supabase
      .from("self_tasks")
      .select("*", { count: "exact", head: true });

    if (selfError) return res.status(400).json({ error: selfError.message });

    // Get count from master_tasks table
    const { count: masterTasksCount, error: masterError } = await supabase
      .from("master_tasks")
      .select("*", { count: "exact", head: true });

    if (masterError) return res.status(400).json({ error: masterError.message });

    res.json({
      tasks: (selfTasksCount || 0) + (masterTasksCount || 0)
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Get all members for admin task filtering dropdown
router.get("/members", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("user_id, name, email, dept, role")
      .order("name");

    if (error) return res.status(400).json({ error: error.message });

    res.json({ members: data });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;