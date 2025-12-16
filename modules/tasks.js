const express = require("express");
const supabase = require("../config/supabase");
const router = express.Router();
const auth = require("./auth/authMiddleware");


router.post("/filter", async (req, res) => {
  try {
    console.log('Tasks filter request received:', req.body);
    const {
      user_id,
      date_filter,
      task_type,
      status,
      custom_date,
      category
    } = req.body;
    console.log('Extracted task_type:', task_type, 'status:', status);
    console.log('User ID:', user_id);

    const format = (d) => new Date(d).toISOString().split("T")[0];

    let today = new Date();
    let formattedToday = format(today);

    let startDate = null;
    let endDate = null;

    // ---------------------- DATE FILTER LOGIC ----------------------

    if (date_filter === "today") {
      startDate = endDate = formattedToday;
    }

    if (date_filter === "yesterday") {
      let d = new Date();
      d.setDate(d.getDate() - 1);
      startDate = endDate = format(d);
    }

    if (date_filter === "custom") {
      startDate = endDate = custom_date;     // specific date only
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

    // ---------------------- FILTER BUILDER ----------------------
    const applyFilters = (table) => {
      let q;

      // 🔥 KEY DIFFERENCE → THIS FIXES YOUR MASTER TASK ISSUE
      if (table === "self_tasks") {
        q = supabase.from(table).select("*").eq("user_id", user_id);
      } else {
        q = supabase.from(table).select("*, assigned_by_user:users!assigned_by(name)").eq("assigned_to", user_id);
      }

      if (startDate && endDate) {
        q = q.gte("date", startDate).lte("date", endDate);
      }

      // Task type filter only applies to self_tasks (master_tasks don't have task_type)
      if (table === "self_tasks" && task_type && task_type !== "all") {
        q = q.eq("task_type", task_type);
      }

      if (status && status !== "all") {
        q = q.eq("status", status);
      }

      return q;
    };

    // ---------------------- FETCH TABLES BASED ON CATEGORY ----------------------
    let selfRes = null;
    let masterRes = null;

    if (category === 'self') {
      selfRes = await applyFilters("self_tasks");
    } else if (category === 'assigned') {
      masterRes = await applyFilters("master_tasks");
    } else {
      // 'all' or default
      [selfRes, masterRes] = await Promise.all([
        applyFilters("self_tasks"),
        applyFilters("master_tasks")
      ]);
    }

    console.log('Self tasks result:', selfRes?.data?.length || 0, 'items');
    console.log('Master tasks result:', masterRes?.data?.length || 0, 'items');

    if ((selfRes && selfRes.error) || (masterRes && masterRes.error)) {
      return res.status(400).json({
        error: (selfRes?.error?.message) || (masterRes?.error?.message)
      });
    }

    const response = {
      self_tasks: selfRes?.data || [],
      master_tasks: masterRes?.data || []
    };
    console.log('Final response:', {
      self_tasks_count: response.self_tasks?.length || 0,
      master_tasks_count: response.master_tasks?.length || 0
    });

    res.json(response);

  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------------------------------------------------------------------
//post new task
router.post("/create", async (req, res) => {
  try {
    const {
      user_id,
      date,
      timeline,
      task_name,
      time,
      task_type,
      status,
      file_link
    } = req.body;

    const { data, error } = await supabase
      .from("self_tasks")
      .insert([
        {
          user_id,
          date,
          timeline,
          task_name,
          time,
          task_type,
          status,
          file_link
        }
      ]).select();

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      message: "Task created successfully",
      task: data[0]
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

//update tasks 
router.put("/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const {
      user_id,
      date,
      timeline,
      task_name,
      time,
      task_type,
      status,
      file_link
    } = req.body;

    // Update row
    const { data, error } = await supabase
      .from("self_tasks")
      .update({
        user_id,
        date,
        timeline,
        task_name,
        time,
        task_type,
        status,
        file_link
      })
      .eq("task_id", taskId)        // match by task id
      .select();                   // return updated row

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      message: "Task updated successfully",
      task: data[0]
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});



module.exports = router;
