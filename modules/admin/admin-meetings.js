const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();

// Filter all members' meetings for admin
router.post("/filter", async (req, res) => {
  try {
    console.log('Admin meetings filter request received:', req.body);
    const {
      user_id, // Admin user_id (for logging)
      target_user_id, // specific member (mandatory)
      date_filter,
      status,
      custom_date
    } = req.body;

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

    // ---------------------- BUILD QUERY ----------------------
    let query = supabase.from("meetings").select("*").eq("user_id", target_user_id);

    if (startDate && endDate) {
      query = query.gte("date", startDate).lte("date", endDate);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) return res.status(400).json({ error: error.message });

    res.json({ meetings: data });

  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// Get all members for admin meeting viewing dropdown
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