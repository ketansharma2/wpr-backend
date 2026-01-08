const express = require("express");
const supabase = require("../../config/supabase");
const router = express.Router();
const auth = require("../auth/authMiddleware");

// Fetch meetings with SubAdmin-specific filters
router.post("/filter", auth, async (req, res) => {
  try {
    const { user_id, view_type, target_user_id, date_filter, status, custom_date } = req.body;

    const format = (d) => new Date(d).toISOString().split("T")[0];

    let today = new Date();
    let formattedToday = format(today);

    let startDate = null;
    let endDate = null;

    // ---------- DATE FILTERS ----------

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

      let day = d.getDay();

      let monday = new Date(d);
      monday.setDate(d.getDate() - ((day + 6) % 7));

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

    // ---------- BUILD QUERY ----------
    let query;

    if (view_type === 'all') {
      // For SubAdmin, 'all' means meetings of all team members
      const { data: teamIds } = await supabase
        .from('users')
        .select('user_id')
        .neq('user_type', 'Admin')
        .neq('user_id', user_id);

      const ids = teamIds?.map(u => u.user_id) || [];
      query = supabase.from("meetings").select("*, users!meetings_user_id_fkey(name)").in("user_id", ids);
    } else if (view_type === 'team' && target_user_id) {
      // Specific user
      query = supabase.from("meetings").select("*, users!meetings_user_id_fkey(name)").eq("user_id", target_user_id);
    } else {
      // Default: own meetings
      query = supabase.from("meetings").select("*, users!meetings_user_id_fkey(name)").eq("user_id", user_id);
    }

    if (startDate && endDate) {
      query = query.gte("date", startDate).lte("date", endDate);
    }

    // STATUS FILTER
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // ---------- FETCH ----------
    const { data, error } = await query.order('date', { ascending: false });

    if (error) return res.status(400).json({ error: error.message });

    res.json({ meetings: data });

  } catch (err) {
    console.error("SubAdmin meetings filter error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;