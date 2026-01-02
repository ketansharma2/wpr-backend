const express = require("express");
const supabase = require("../config/supabase");
const router = express.Router();
const auth = require("./auth/authMiddleware");

//fetch meets with filters
router.post("/filter", async (req, res) => {
  try {
    const { user_id, date_filter, status, custom_date } = req.body;

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
      startDate = endDate = custom_date; // specific date only
    }

    if (date_filter === "past_week") {
      let d = new Date();
      d.setDate(d.getDate() - 7);

      let day = d.getDay(); // 0 = Sun, 1 = Mon

      let monday = new Date(d);
      monday.setDate(d.getDate() - ((day + 6) % 7)); // last Monday

      let saturday = new Date(monday);
      saturday.setDate(monday.getDate() + 5); // Monday + 5 days

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
    let query = supabase.from("meetings").select("*").eq("user_id", user_id);

    if (startDate && endDate) {
      query = query.gte("date", startDate).lte("date", endDate);
    }

    // STATUS FILTER
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // ---------- FETCH ----------
    const { data, error } = await query;

    if (error) return res.status(400).json({ error: error.message });

    res.json({ meetings: data });

  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

module.exports = router;

//-------------------------------------------------------------------------------------------------------------

// Create meeting
router.post("/create", async (req, res) => {
try {
  console.log('Received meeting create request:', req.body);
  const {
    user_id,
    meeting_name,
    date,
    dept,
    co_person,
    time,
    prop_slot,
    status,
    notes
  } = req.body;
  console.log('Extracted date:', date);

    const { data, error } = await supabase
      .from("meetings")
      .insert([
        {
          user_id,
          meeting_name,
          date,
          dept,
          co_person,
          time,
          prop_slot,
          status,
          notes
        }
      ])
      .select(); // returns created row

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      message: "Meeting created successfully",
      meeting: data[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});



// update meetings

router.put("/:meeting_id", async (req, res) => {
try {
  const { meeting_id } = req.params;
  console.log('Received meeting update request:', req.body);

  const {
    user_id,
    meeting_name,
    date,
    dept,
    co_person,
    time,
    prop_slot,
    status,
    notes
  } = req.body;
  console.log('Extracted date for update:', date);

    const { data, error } = await supabase
      .from("meetings")
      .update({
        user_id,
        meeting_name,
        date,
        dept,
        co_person,
        time,
        prop_slot,
        status,
        notes
      })
      .eq("meeting_id", meeting_id)
      .select();

    if (error) return res.status(400).json({ error: error.message });

    res.json({
      message: "Meeting updated successfully",
      meeting: data[0]
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Fetch members excluding current user
router.get("/members", auth, async (req, res) => {
 try {
   const currentUserId = req.user.id;

   const { data, error } = await supabase
     .from("users")
     .select("user_id, name, email, dept, role, user_type")
     .neq("user_id", currentUserId)
     .order("name");

   if (error) return res.status(400).json({ error: error.message });

   res.json({ members: data });

 } catch (err) {
   console.error(err);
   res.status(500).json({ error: "Server error" });
 }
});

module.exports = router;
